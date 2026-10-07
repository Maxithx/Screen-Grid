# ScreenGrid — Roadmap

Delivery is split into phases. Each phase should build and run on its own.

| Phase | Scope                                  | Status         |
| ----- | -------------------------------------- | -------------- |
| 0     | Repository setup, solution, docs       | Done           |
| 1     | **Front-page UI** (this phase)         | Done           |
| 2     | Signaling + ICE / NAT traversal        | Not started    |
| 3     | Screen capture + video encoding        | Not started    |
| 4     | Remote input (mouse / keyboard)        | Not started    |
| 5     | Security hardening (E2EE, identity)    | Not started    |
| 6     | Community / streaming application      | Not started    |

## Phase 0 — Setup

* Solution (`ScreenGrid.slnx`), `Directory.Build.props`, `.editorconfig`, `.gitignore`.
* Documentation (`README.md`, `docs/`).
* Chosen stack: .NET 10 / WPF / `CommunityToolkit.Mvvm` / `WPF-UI`.

## Phase 1 — Front-page UI

* Custom-chrome shell (`FluentWindow`), dark theme by default, light toggle.
* Home screen: **Share Your Computer** + **Get Access to Computer** panels.
* Placeholder session screen hosting the reusable `VideoSurface` control.
* Placeholder settings screen.
* `.resx` localization (English neutral).

## Phase 2 — Signaling & connectivity

Planned components: `Signaling.Server`, `Host.Agent`, `ScreenGrid.Transport`.

* Device registration and rendezvous by ID.
* Session negotiation and ICE candidate exchange.
* TURN/STUN for NAT traversal.
* Direct (LAN) and relayed (WAN) paths.
* `Auth.Server` (control plane, Raspberry Pi): device directory + TOTP login —
  see [`docs/AUTH-SERVER.md`](AUTH-SERVER.md).

## Phase 3 — Capture & media

Planned component: `ScreenGrid.Media`.

* Windows Desktop Duplication API capture.
* Hardware-accelerated H.264/AV1 encoding.
* Frame pacing and adaptive bitrate.
* `VideoSurface` fed by a real decoder.
* Monitor selection, multi-monitor support.

## Phase 4 — Remote input

Planned component: `ScreenGrid.RemoteControl`.

* Mouse, keyboard and clipboard injection (`SendInput`).
* Input channel over the data session.
* Session permission prompts on the host.

## Phase 5 — Security

Planned component: `ScreenGrid.Crypto`.

* Per-device identity keys and address book.
* End-to-end encryption of the media and input channels.
* Session passwords and one-time tokens.
* Audit logging and lock-screen behaviour.
* Two-factor session approval + signed grants — see
  [`docs/AUTH-SERVER.md`](AUTH-SERVER.md).

## Phase 6 — Community app

* Reuse `Transport` + `Media` for a Discord-style SFU application.
* Group streams / screen sharing.
* Presence and chat.
