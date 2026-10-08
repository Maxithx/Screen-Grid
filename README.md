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
  RELIABILITY.md                      Memory / resource-safety rules
  architecture-map.html               Interactive architecture node map
  UI.md                               Phase 1 UI documentation
  ROADMAP.md                          Phase plan
  AUTH-SERVER.md                      Auth & approval service design
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

* [`docs/architecture-map.html`](docs/architecture-map.html) — **interactive node map** (phases, dependencies,
  dataflow, runtime topology). Open it in a browser — no server or build needed.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — project layout & coding rules (module + file-size budget).
* [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — connection handshake & session protocol design.
* [`docs/RELIABILITY.md`](docs/RELIABILITY.md) — memory / resource-safety and DoS rules.
* [`docs/UI.md`](docs/UI.md) — what Phase 1 looks like and how to extend it.
* [`docs/ROADMAP.md`](docs/ROADMAP.md) — the phased delivery plan.
* [`docs/AUTH-SERVER.md`](docs/AUTH-SERVER.md) — the 2FA approval service design.

## License

ScreenGrid is intended to be released under **AGPL-3.0-or-later** (a `LICENSE`
file will be added before the first public release). ScreenGrid links against
**WPF-UI**, which is MIT licensed.
