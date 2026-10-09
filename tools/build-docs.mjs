#!/usr/bin/env node
/**
 * build-docs.mjs — generates docs/documentation.html from the markdown sources.
 *
 * The markdown files in docs/ are the single source of truth; the HTML hub is a
 * BUILD PRODUCT. Never edit docs/documentation.html by hand.
 *
 *   node tools/build-docs.mjs           # regenerate
 *   node tools/build-docs.mjs --check   # fail if the file is out of date (CI)
 *
 * Zero dependencies — a small, purpose-built markdown subset parser, because the
 * repository deliberately has no npm toolchain.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/documentation.html');
const CHECK_ONLY = process.argv.includes('--check');

/** Which markdown files become sections of the page, in reading order. */
const DOCS = [
  { id: 'oversigt',    file: 'README.md' },
  { id: 'arkitektur',  file: 'docs/ARCHITECTURE.md' },
  { id: 'transport',   file: 'docs/TRANSPORT.md' },
  { id: 'protokol',    file: 'docs/PROTOCOL.md' },
  { id: 'reliability', file: 'docs/RELIABILITY.md' },
  { id: 'auth-server', file: 'docs/AUTH-SERVER.md' },
  { id: 'ui',          file: 'docs/UI.md' },
  { id: 'roadmap',     file: 'docs/ROADMAP.md' }
];

/* ------------------------------------------------------------------ helpers */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = (s) => s.toLowerCase()
  .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70);

/** basename -> doc, so a markdown link can be turned into an in-page anchor */
const BY_NAME = new Map(DOCS.map((d) => [d.file.split('/').pop().toLowerCase(), d]));

function resolveLink(href) {
  if (/^(https?:|mailto:|#|data:)/i.test(href)) return href;
  const path = href.split('#')[0];
  const name = path.split('/').pop().toLowerCase();

  if (name === 'documentation.html') return 'documentation.html';
  if (name === 'architecture-map.html') return 'architecture-map.html';
  if (name === 'license') return '../LICENSE';

  const doc = BY_NAME.get(name);
  if (doc) return `#${doc.id}`;      // we don't preserve the source fragment

  return href;                        // unknown: leave the relative link alone
}

/** Inline formatting: html-escape, then code spans, links, bold, italic. */
function inline(text) {
  let t = esc(text);

  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });

  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:/i.test(href);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    return `<a class="inline" href="${resolveLink(href)}"${attrs}>${label}</a>`;
  });

  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${codes[+n]}</code>`);
}

/** Split a markdown table row on `|`, ignoring pipes inside `code spans`. */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let tick = false;
  for (const ch of s) {
    if (ch === '`') { tick = !tick; cur += ch; continue; }
    if (ch === '|' && !tick) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const indentOf = (l) => l.length - l.replace(/^\s*/, '').length;

const isMarker = (l) => /^\s*([-*+]|\d+\.)\s+/.test(l);

const isBlockStartLine = (l) =>
  /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) ||
  isMarker(l) || /^\s*\|/.test(l) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);

/* --------------------------------------------------------- block parser */

/** Parse a block of markdown lines -> { html, toc }. `prefix` scopes heading ids. */
function parseBlocks(lines, prefix) {
  const out = [];
  const toc = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    // --- fenced code block ------------------------------------------------
    if (/^\s*```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++; // consume closing fence
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    // --- heading ----------------------------------------------------------
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      const id = slug(`${prefix}-${h[2]}`);
      toc.push({ level, text: h[2], id });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // --- horizontal rule --------------------------------------------------
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr />'); i++; continue; }

    // --- blockquote -------------------------------------------------------
    if (/^\s*>/.test(line)) {
      const raw = [];
      while (i < lines.length && (/^\s*>/.test(lines[i]) || lines[i].trim() === '')) {
        raw.push(lines[i].trim() === '' ? '' : lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      const paras = [];
      let cur = [];
      for (const l of raw) {
        if (l.trim() === '') { if (cur.length) { paras.push(cur.join(' ')); cur = []; } }
        else cur.push(l.trim());
      }
      if (cur.length) paras.push(cur.join(' '));
      const body = paras.map((p) => `<p>${inline(p)}</p>`).join('');
      if (body) out.push(`<blockquote class="callout">${body}</blockquote>`);
      continue;
    }

    // --- table ------------------------------------------------------------
    if (/^\s*\|/.test(line) && i + 1 < lines.length &&
        /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = splitRow(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      const cells = (r) => head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('');
      out.push(
        '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + rows.map((r) => `<tr>${cells(r)}</tr>`).join('') +
        '</tbody></table>'
      );
      continue;
    }

    // --- list -------------------------------------------------------------
    if (isMarker(line)) {
      const r = parseList(lines, i, prefix);
      out.push(r.html);
      toc.push(...r.toc);
      i = r.next;
      continue;
    }

    // --- paragraph --------------------------------------------------------
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStartLine(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++; // safety: never spin forever
  }

  return { html: out.join('\n'), toc };
}

/**
 * Parse one list (bullet or ordered), including indented continuations and one
 * level of nesting. Returns the html, its toc entries and the next line index.
 */
function parseList(lines, start, prefix) {
  const markerRe = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  const items = [];
  let i = start;
  let ordered = null;
  let baseIndent = null;
  const toc = [];

  while (i < lines.length) {
    const m = lines[i].match(markerRe);
    if (!m) break;
    const indent = m[1].length;
    if (baseIndent === null) baseIndent = indent;
    if (indent !== baseIndent) break;
    if (ordered === null) ordered = /^\d/.test(m[2]);

    // Gather this item's body: any following line indented deeper than the
    // marker, plus blank lines that are followed by deeper content.
    const body = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      if (l.trim() === '') {
        let k = j + 1;
        while (k < lines.length && lines[k].trim() === '') k++;
        if (k < lines.length && indentOf(lines[k]) > indent) { body.push(''); j++; continue; }
        break;
      }
      if (indentOf(l) > indent) { body.push(l.slice(Math.min(l.length, indent + 2))); j++; continue; }
      break;
    }

    // Lines before the first blank/block that just continue the sentence.
    const lead = [];
    while (body.length && body[0].trim() !== '' && !isBlockStartLine(body[0])) {
      lead.push(body.shift().trim());
    }
    const text = [m[3], ...lead].join(' ');

    let inner = '';
    if (body.some((l) => l.trim() !== '')) {
      const sub = parseBlocks(body, prefix);
      inner = sub.html;
      toc.push(...sub.toc);
    }

    items.push({ text, inner });
    i = j;

    // Allow blank line(s) between two items at the same level.
    let k = i;
    while (k < lines.length && lines[k].trim() === '') k++;
    const nm = k < lines.length ? lines[k].match(markerRe) : null;
    if (nm && nm[1].length === baseIndent) { i = k; continue; }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const html = `<${tag}>` + items.map((it) => {
    const task = it.text.match(/^\[([ xX])\]\s*(.*)$/);
    if (task) {
      const done = task[1].toLowerCase() === 'x';
      return `<li class="task${done ? ' done' : ''}">`
        + `<span class="checkbox">${done ? '☑' : '☐'}</span>`
        + `${inline(task[2])}${it.inner}</li>`;
    }
    return `<li>${inline(it.text)}${it.inner}</li>`;
  }).join('') + `</${tag}>`;

  return { html, toc, next: i };
}

/** Turn one markdown file into { title, html, toc }. The leading H1 becomes the title. */
function markdownToDoc(raw, docId) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  let title = docId;
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const h1 = lines[i].match(/^#\s+(.*?)\s*#*\s*$/);
    if (h1) { title = h1[1]; start = i + 1; }
    break;
  }

  const parsed = parseBlocks(lines.slice(start), docId);
  return { title, html: parsed.html, toc: parsed.toc };
}

/* --------------------------------------------------------------- template */

const CSS = `
  :root{
    --bg:#0d1117; --bg2:#0a0e14; --panel:#161b22; --panel2:#1c2230;
    --border:#30363d; --border2:#3d444d; --text:#e6edf3; --muted:#8b949e;
    --accent:#58a6ff; --app:#1f6feb; --server:#8957e5;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth; scroll-padding-top:86px}
  body{
    margin:0; font-family:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,sans-serif;
    background:radial-gradient(1200px 700px at 20% -10%,#131a24 0%,var(--bg) 55%,var(--bg2) 100%);
    background-attachment:fixed; color:var(--text); line-height:1.65;
  }
  header{
    position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:20px;
    flex-wrap:wrap; padding:12px 24px; border-bottom:1px solid var(--border);
    background:rgba(13,17,23,.82); backdrop-filter:blur(12px);
  }
  .brand{display:flex; align-items:center; gap:10px; font-weight:600; font-size:15px}
  .brand .dot{width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg,var(--app),var(--server))}
  .brand small{color:var(--muted);font-weight:400;margin-left:6px}
  nav.tabs{display:flex; gap:6px; flex-wrap:wrap; margin-left:auto}
  nav.tabs a{
    display:inline-block; background:var(--panel); color:var(--muted); border:1px solid var(--border);
    padding:7px 14px; border-radius:999px; font-size:13px; font-weight:500;
    text-decoration:none; transition:.15s;
  }
  nav.tabs a:hover{color:var(--text); border-color:var(--border2)}
  nav.tabs a.active{background:var(--accent); color:#06131f; border-color:var(--accent); font-weight:600}
  .layout{display:flex; align-items:flex-start; gap:26px; max-width:1400px; margin:0 auto; padding:28px 24px 80px}
  nav#toc{
    position:sticky; top:86px; flex:0 0 280px; width:280px; font-size:12.5px;
    border-right:1px solid var(--border); padding-right:16px;
    max-height:calc(100vh - 110px); overflow:auto;
  }
  nav#toc .toc-title{font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:10px}
  nav#toc a{display:block; color:var(--muted); text-decoration:none; padding:3px 0 3px 10px;
            border-left:2px solid transparent; transition:.15s; line-height:1.4}
  nav#toc a:hover{color:var(--text)}
  nav#toc a.active{color:var(--accent); border-left-color:var(--accent); font-weight:600}
  nav#toc a.lvl0{margin-top:12px; color:var(--text); font-weight:600; font-size:13px}
  nav#toc a.lvl2{padding-left:22px; font-size:12px}
  .toc-note{margin-top:16px; font-size:11px; color:var(--muted); line-height:1.5;
            border-top:1px solid var(--border); padding-top:12px}
  main#content{flex:1; min-width:0; max-width:920px}
  .doc{padding:6px 0 34px; border-bottom:1px solid rgba(48,54,61,.5); scroll-margin-top:86px}
  .doc:last-child{border-bottom:0}
  .doc-source{font-size:11.5px; color:var(--muted); margin:0 0 14px}
  h1.doc-title{font-size:26px; margin:0 0 4px; scroll-margin-top:86px}
  h2{font-size:19px; margin:26px 0 10px; scroll-margin-top:86px}
  h3{font-size:15.5px; margin:20px 0 8px; color:#c9d1d9; scroll-margin-top:86px}
  h4,h5,h6{font-size:14px; margin:16px 0 6px; color:#c9d1d9}
  p{margin:10px 0; font-size:14px; color:#c9d1d9}
  ul,ol{margin:10px 0; padding-left:22px; font-size:14px; color:#c9d1d9}
  li{margin:4px 0}
  li>ul,li>ol{margin:6px 0}
  li.task{list-style:none; margin-left:-20px}
  li.task .checkbox{color:var(--accent); font-weight:700; margin-right:6px}
  li.task.done{color:var(--muted); text-decoration:line-through}
  hr{border:0; border-top:1px solid rgba(48,54,61,.7); margin:24px 0}
  code{font-family:"Cascadia Code","Consolas",monospace; font-size:12.5px;
       background:var(--panel2); border:1px solid var(--border); border-radius:5px;
       padding:1px 5px; color:#d2a8ff}
  pre{background:var(--panel); border:1px solid var(--border); border-radius:10px;
      padding:14px 16px; overflow:auto; font-size:12.5px; line-height:1.6}
  pre code{background:none; border:0; padding:0; color:#c9d1d9; font-size:12.5px}
  table{width:100%; border-collapse:collapse; margin:14px 0; font-size:13.5px}
  th,td{text-align:left; padding:9px 12px; border-bottom:1px solid var(--border); vertical-align:top}
  th{color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.05em}
  tr:hover td{background:rgba(88,166,255,.045)}
  blockquote.callout{border:1px solid var(--border2); border-left:3px solid var(--accent);
    background:var(--panel); border-radius:0 10px 10px 0; padding:4px 16px; margin:16px 0}
  blockquote.callout p{font-size:13.5px}
  blockquote.callout p:first-child{margin-top:10px}
  blockquote.callout p:last-child{margin-bottom:10px}
  a.inline{color:var(--accent); text-decoration:none}
  a.inline:hover{text-decoration:underline}
  .generated{margin:0 auto; max-width:1400px; padding:10px 24px 0; font-size:11.5px; color:var(--muted)}
  .generated code{font-size:11px}
  @media (max-width:1000px){
    nav#toc{display:none}
    .layout{padding:20px 16px 60px}
  }
`;

/* ------------------------------------------------------------- page build */

function renderPage(sections) {
  const tocHtml = sections.map((s) => {
    const subs = s.toc
      .filter((t) => t.level === 2)
      .map((t) => `<a class="lvl2" href="#${t.id}">${inlinePlain(t.text)}</a>`)
      .join('');
    return `<a class="lvl0" href="#${s.doc.id}">${inlinePlain(s.doc.title)}</a>${subs}`;
  }).join('');

  const bodyHtml = sections.map((s) => {
    const src = s.doc.file.replace(/^docs\//, '');
    return `<section class="doc" id="${s.doc.id}">
      <h1 class="doc-title">${inlinePlain(s.doc.title)}</h1>
      <p class="doc-source">Kilde: <a class="inline" href="${src}">${src}</a></p>
${s.doc.html}
    </section>`;
  }).join('\n');

  return `<!doctype html>
<!-- ============================================================
     GENERERET FIL — REDIGER IKKE DIREKTE.
     Kilden er markdown-filerne i docs/ (+ README.md).
     Regenerér med:  node tools/build-docs.mjs
     ============================================================ -->
<html lang="da">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ScreenGrid · Dokumentation</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="brand"><span class="dot"></span>ScreenGrid<small>· dokumentation</small></div>
  <nav class="tabs">
    <a class="active" href="documentation.html">Dokumentation</a>
    <a href="architecture-map.html">Arkitektur-kort ↗</a>
    <a href="https://github.com/Maxithx/Screen-Grid" target="_blank" rel="noopener">GitHub ↗</a>
  </nav>
</header>

<div class="generated">
  Genereret fra markdown af <code>tools/build-docs.mjs</code> — redigér <code>docs/*.md</code>,
  ikke denne fil.
</div>

<div class="layout">
  <nav id="toc">
    <div class="toc-title">Indhold</div>
${tocHtml}
    <div class="toc-note">
      Markdown-filerne i <code>docs/</code> er den <b>kanoniske kilde</b>. Denne side
      genereres ud fra dem — derfor kan den aldrig komme ud af sync.
    </div>
  </nav>

  <main id="content">
${bodyHtml}
  </main>
</div>

<script>
const tocLinks = [...document.querySelectorAll('#toc a[href^="#"]')];
const byId = new Map(tocLinks.map(a => [a.getAttribute('href').slice(1), a]));
const targets = [...byId.keys()].map(id => document.getElementById(id)).filter(Boolean);

function syncToc(){
  if(!targets.length) return;
  const y = window.scrollY + 150;
  let active = targets[0];
  for(const t of targets){
    if(t.getBoundingClientRect().top + window.scrollY <= y) active = t;
  }
  tocLinks.forEach(a => a.classList.remove('active'));
  const link = byId.get(active.id);
  if(link) link.classList.add('active');
}
window.addEventListener('scroll', syncToc, {passive:true});
window.addEventListener('resize', syncToc);
syncToc();
</script>
</body>
</html>
`;
}

/** Strip markdown for plain-text contexts (toc labels, titles). */
function inlinePlain(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');
}

/* -------------------------------------------------------------------- main */

function build() {
  const sections = [];

  for (const doc of DOCS) {
    const file = resolve(ROOT, doc.file);
    if (!existsSync(file)) {
      console.error(`build-docs: missing source file ${doc.file}`);
      process.exitCode = 1;
      return null;
    }
    const parsed = markdownToDoc(readFileSync(file, 'utf8'), doc.id);
    sections.push({ doc: { ...doc, title: parsed.title, html: parsed.html }, toc: parsed.toc });
  }

  return renderPage(sections);
}

const html = build();
if (html === null) process.exit(1);

const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';

if (CHECK_ONLY) {
  if (existing.replace(/\r\n/g, '\n') !== html.replace(/\r\n/g, '\n')) {
    console.error('build-docs: docs/documentation.html is OUT OF DATE.');
    console.error('             run: node tools/build-docs.mjs');
    process.exit(1);
  }
  console.log('build-docs: documentation.html is up to date.');
} else {
  writeFileSync(OUT, html, 'utf8');
  const lines = html.split('\n').length;
  console.log(`build-docs: wrote docs/documentation.html (${lines} lines, ${DOCS.length} documents).`);
}



