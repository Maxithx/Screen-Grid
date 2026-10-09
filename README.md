# ScreenGrid

An open-source, cross-platform **remote desktop** application (AnyDesk / Supremo style)
built with **C# / .NET 10 / WPF**.

> **Status: Phase 1 — user interface.** The application currently contains the complete
> front-page UI (sharing + connecting) and a placeholder session screen. There is **no
> networking, encryption, screen capture or input control yet.**

---

## Why

ScreenGrid is designed around a small set of reusable libraries so that the same
capture → encode → transport → decode → render pipeline can later power a
Discord-style community/streaming application, not just remote control.

## Technology

| Area              | Choice                                                            |
| ----------------- | ----------------------------------------------------------------- |
| Runtime           | .NET 10 (`net10.0-windows`)                                       |
| UI framework      | WPF                                                               |
| MVVM              | `CommunityToolkit.Mvvm` (source-generated properties & commands)  |
| Theming / chrome  | `WPF-UI` (lepo.co, MIT) — Fluent theme, custom title bar, Mica    |
| Localization      | `.resx` based (`Resources/Strings.resx`, English = neutral)       |

## Repository layout

```
ScreenGrid.slnx                       Solution (new XML format)
Directory.Build.props                 Shared build properties
LICENSE                               PolyForm Noncommercial 1.0.0
THIRD-PARTY-NOTICES.md                Licenses of the components we depend on
src/
  ScreenGrid.Client.App/              WPF front-end (viewer + host UI)
    App.xaml(.cs)                     Application + theme dictionaries
    Views/                            MainWindow, HomeView, SessionView, SettingsView
    ViewModels/                       MVVM view models (shell + panels)
    Controls/VideoSurface.xaml        Reusable video presentation control
    Services/IAppNavigator.cs         Navigation abstraction
    Models/RecentConnection.cs        Recent-connection model
    Resources/Strings.resx            Localized strings (English)
    Resources/Brand.xaml              Brand palette + shared styles
docs/
  ARCHITECTURE.md                     Project layout & coding rules
  PROTOCOL.md                         Handshake & connection protocol design
  TRANSPORT.md                        QUIC / TLS 1.3 explained (what & why)
  RELIABILITY.md                      Memory / resource-safety rules
  AUTH-SERVER.md                      Auth & approval service design
  HOSTING-PI.md                       Deploying the Auth.Server on a Raspberry Pi
  architecture-map.html               Interactive architecture node map
  documentation.html                  Browsable documentation hub — GENERATED
  UI.md                               Phase 1 UI documentation
  ROADMAP.md                          Phase plan
tools/
  build-docs.mjs                      Generates docs/documentation.html from the markdown
```

Later phases add `Host.Agent`, `Signaling.Server` and the reusable
`Crypto`, `Transport`, `Media`, `Protocol` and `RemoteControl` libraries.

## Building & running

```powershell
# restore + build
dotnet build ScreenGrid.slnx -c Debug

# run the UI
dotnet run --project src/ScreenGrid.Client.App
```

Requirements: Windows 10/11 and the .NET 10 SDK.

## Documentation

* [`docs/documentation.html`](docs/documentation.html) — **browsable documentation hub** with a
  table of contents. **Generated** from the markdown below — open it in a browser.
* [`docs/architecture-map.html`](docs/architecture-map.html) — **interactive node map** (phases, dependencies,
  dataflow, runtime topology). Open it in a browser — no server or build needed.
* [`docs/TRANSPORT.md`](docs/TRANSPORT.md) — **QUIC / TLS 1.3** explained: what it is, what it gives us, deployment.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — project layout & coding rules (module + file-size budget).
* [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — connection handshake & session protocol design.
* [`docs/RELIABILITY.md`](docs/RELIABILITY.md) — memory / resource-safety and DoS rules.
* [`docs/UI.md`](docs/UI.md) — what Phase 1 looks like and how to extend it.
* [`docs/ROADMAP.md`](docs/ROADMAP.md) — the phased delivery plan.
* [`docs/AUTH-SERVER.md`](docs/AUTH-SERVER.md) — the 2FA approval service design.
* [`docs/HOSTING-PI.md`](docs/HOSTING-PI.md) — hosting the Auth.Server on a Raspberry Pi 3.

### Regenerating the HTML documentation

The markdown files above are the **single source of truth**; `docs/documentation.html`
is a build product and must never be edited by hand.

```powershell
node tools/build-docs.mjs           # regenerate docs/documentation.html
node tools/build-docs.mjs --check   # verify it is up to date (CI does this)
```

Requires Node.js. `docs/architecture-map.html` is **not** generated — it is a
hand-authored, self-contained interactive diagram.

## License

ScreenGrid is **source-available** under the **PolyForm Noncommercial License
1.0.0** — see [`LICENSE`](LICENSE).

* ✅ **Free** for personal use, hobby projects, study, research, and use by
  charities, educational institutions, public research / public safety / health /
  environmental organizations and government bodies.
* ❌ **Commercial use and commercial redistribution require a separate license.**

Third-party components keep their own licenses — see
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md). ScreenGrid links against
**WPF-UI** and **CommunityToolkit.Mvvm**, both MIT licensed.

> **Note:** versions released before this change were licensed under
> AGPL-3.0-or-later. That grant is irrevocable for those versions; the PolyForm
> terms apply going forward.

For commercial licensing, contact the maintainer.
