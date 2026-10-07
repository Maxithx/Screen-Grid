# ScreenGrid — Architecture & coding guidelines

This document defines **how** the code is structured and the rules every
contribution (human or AI) must follow. It exists so that the codebase can grow
across six phases without turning into a monolith.

---

## 1. Guiding principles

1. **Small, focused components.** Each project/library has a single
   responsibility. Reusable pieces (transport, media, crypto) never depend on the
   WPF UI.
2. **One reason to change per file.** If you cannot name a file's single
   responsibility in ~3 words, it should be split.
3. **View-model first navigation.** The UI shows view models; WPF resolves the
   matching view through `DataTemplate`s. View models never touch `Window` /
   `UserControl`.
4. **No secrets in the client.** Identity, signing and trust live on the server
   side (see [`AUTH-SERVER.md`](AUTH-SERVER.md)).

---

## 2. File-size budget (the "1000-line rule")

A hard ceiling alone is a bad design rule, so ScreenGrid uses **two thresholds**
plus a primary rule:

| Rule                          | Limit      | Enforcement                          |
| ----------------------------- | ---------- | ------------------------------------ |
| **Primary rule**              | —          | one responsibility per file          |
| Soft ceiling (review trigger) | **600 lines** | split unless justified            |
| Hard ceiling                  | **1000 lines** | must be split                    |

* The soft ceiling is a **smoke alarm**: when a file approaches 600 lines, stop
  and ask *"does this still have one responsibility?"*.
* The hard ceiling is **mandatory** — a file over 1000 lines must be split
  before merge.
* **Exceptions** (do not split, document why in the PR): auto-generated files,
  `.resx` / `.Designer.cs` accessors, localization resource tables, and pure
  XAML layout that is genuinely one screen.

A file that fits the rule is usually **100–300 lines**. If a file is small but
handles two concerns, split it anyway — the line count is a *symptom*, not the
goal.

---

## 3. Project layout (planned)

The solution grows over the phases. Target layout:

```
src/
  ScreenGrid.Client.App/        WPF viewer + host UI (Phase 1)            ✔ exists
  ScreenGrid.Protocol/          Shared DTOs & wire contracts              Phase 2
  ScreenGrid.Auth.Server/       Control plane: directory, 2FA, grants     Phase 2
  ScreenGrid.Host.Agent/        Windows host: capture + input + grants    Phase 2
  ScreenGrid.Transport/         Sockets/QUIC, ICE, TURN/STUN              Phase 2
  ScreenGrid.Media/             Capture + encode (Desktop Duplication)    Phase 3
  ScreenGrid.RemoteControl/     Mouse/keyboard/clipboard injection        Phase 4
  ScreenGrid.Crypto/            Identity keys, E2EE of media + input      Phase 5
tests/
  ScreenGrid.<Component>.Tests/ One test project per library
```

Rules:

* **Dependencies flow inwards:** `Client.App` / `Host.Agent` may depend on
  `Transport`, `Media`, `Crypto`, `Protocol`; the libraries never depend on the
  apps or on WPF.
* `Protocol` is the only project referenced by *both* client and server; it
  contains data + interfaces, never behaviour that needs a platform.
* Only platform-specific projects set `TargetFramework` to `*-windows`.

---

## 4. Folder conventions inside a component

Once a component grows, split by responsibility:

```
ScreenGrid.<Component>/
  <Component>...        public entry points (few, small files)
  Endpoints/            (servers) transport endpoints / Minimal API routes
  Services/             orchestration + business logic
  Models/  or  Entities/ one type per file
  Security/             hashing, signing, verification
  Data/                 persistence (SQLite context, migrations)
  Contracts/            DTOs, options objects
  <Topic>/              a feature slice (e.g. Capture/, Encode/)
```

---

## 5. C# coding conventions

* **Nullable** and **implicit usings** are on for every project (see
  `Directory.Build.props`); do not disable them per file.
* **File-scoped namespaces**, `var` only when the type is apparent (see
  `.editorconfig`).
* **MVVM**: `CommunityToolkit.Mvvm` — `[ObservableProperty]`, `[RelayCommand]`,
  `ObservableObject`. Keep view models free of `System.Windows` except where a
  Phase-1 convenience already exists (e.g. clipboard).
* **Async**: name methods `...Async`, pass `CancellationToken`, and never block
  on `.Result` / `.Wait()` in UI code.
* **Disposal**: anything owning a socket, handle or bitmap is `IDisposable`.
* **Logging**: use `Microsoft.Extensions.Logging` abstractions, never
  `Console.WriteLine` in libraries.

---

## 6. Line-count / quality checks

Recommended (add in Phase 2 CI):

* A simple script / Roslyn analyzer that fails the build when a `.cs` file
  exceeds **1000 lines**.
* `dotnet format --verify-no-changes` against `.editorconfig`.
* Build on both `windows` (client) and `linux-arm64` (server) targets.

---

## 7. Documentation map

| Document              | Contents                                   |
| --------------------- | ------------------------------------------ |
| `README.md`           | Project overview + build instructions      |
| `docs/ARCHITECTURE.md`| This file — structure & coding rules       |
| `docs/ROADMAP.md`     | Phase plan                                 |
| `docs/UI.md`          | Phase-1 UI reference                       |
| `docs/AUTH-SERVER.md` | Auth / approval control-plane design       |
