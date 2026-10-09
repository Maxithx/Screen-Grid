# ScreenGrid — Auth & Approval Service (design proposal)

> Status: **proposal** — not implemented. This document describes the planned
> central identity / two-factor approval service and how it fits the phased
> roadmap (Phase 2 and Phase 5).

## 1. Purpose

ScreenGrid needs a small **control-plane** service that:

1. Gives every device a stable **identity** and a way to find peers by ID
   (rendezvous / directory).
2. Enforces **two-factor approval** before a remote session is allowed to start.
3. Issues short-lived, signed **session grants** that the host can verify
   *offline* (no round-trip per input or frame).

It is **not** a media server. Video, audio and input always travel directly
between the two peers (P2P / hole-punched, with a relay only when NAT forces it).
The service must never proxy the media stream.

## 2. Why a Raspberry Pi 3 is a good host

The Pi 3 (Cortex-A53, 1 GB RAM) is far too weak to relay video, but it is
**more than enough** for a control plane that handles:

* device registration / directory lookups,
* email-code / TOTP verification, GeoIP lookups (sub-millisecond),
* Ed25519 / HMAC token signing,
* a tiny SQLite database and an admin web page.

Expected footprint: **~120–200 MB RAM**, near-idle CPU. Runs happily as a
`systemd` service. This keeps the whole trust root on hardware **you own**,
instead of a third-party cloud.

## 3. Roles

| Component            | Where          | Responsibility                                              |
| -------------------- | -------------- | ----------------------------------------------------------- |
| `Auth.Server`        | Raspberry Pi   | Directory, 2FA, session-grant issuance, admin UI            |
| `Host.Agent`         | Windows host   | Register device, answer incoming sessions, verify grants    |
| `Controller.Client`  | Windows viewer | Resolve peer, request session, present factor-1 credential  |
| `Approver.App` (opt) | Phone          | Push approval (factor 2), "tap to allow"                    |

## 4. Component & protocol overview

```
        register / heartbeat        resolve peer + public key
 Host.Agent ───────────────▶┌──────────────┐◀─────────────── Controller
                            │  Auth.Server │
      verify grant (offline)│  (Pi 3)      │  push approval
              ┌────────────▶│ SQLite+Email │◀─────────────── Approver.App
              │             └──────────────┘
              │
   Host.Agent ◀─── direct P2P media/input session ───▶ Controller
```

**Identity:** on first run each device generates a long-lived **Ed25519 key
pair**. The public key is registered with the server together with a device
ID. All device→server calls are signed with the private key (or sent over a
pinned-TLS channel).

## 5. Authentication & approval flows

All flows are **risk-based (step-up)**: the common case is friction-free, and a
second factor is demanded *only* when something changed (new device, new
location). This mirrors how Path of Exile, Steam and Discord behave.

### Flow A — email code + trusted device/location (recommended first cut)

Used for account login and first-time device enrolment:

1. User enters email → server sends a **short numeric code** (6–8 digits) by
   email. Codes are single-use, hashed at rest, TTL ~10 min, resend-throttled.
2. User types the code in the app. On success the **device is remembered**: it
   generates an Ed25519 key pair and receives a long-lived refresh token bound
   to that public key ("this is now a trusted device").
3. Subsequent logins from a **known device *and* known location** skip the code
   entirely — the device signature is enough.

*Why this first:* no authenticator app to install, everyone already has email,
and it doubles as account recovery. It is a strong fit for what PoE does.

### Flow A2 — optional TOTP upgrade

Power users can add a **TOTP** secret (Aegis / Google Authenticator) on top of
email. When present, TOTP replaces the email code as the second factor (fewer
emails, works offline). Email remains the fallback. Server verifies
`HOTP`/`TOTP` with a ±1 step window, rate-limited.

### Flow B — per-session push approval

Used to protect **incoming** remote sessions (unattended access):

1. Controller resolves Host and opens a transport to it.
2. Host creates an **approval request** on the server (challenge id, controller
   device id, host device id, TTL ~60 s).
3. Server sends a **push** to the account owner's `Approver.App` (or shows a
   code in the Pi admin page). *Email is a poor fit here — too slow and too
   fragile for a "connect now" flow.*
4. Owner taps **Approve** → server signs a **SessionGrant**.
5. Host verifies the grant signature against the server's public key and starts
   the session. Grant is single-use and expires in minutes.

### Flow C — offline / LAN fallback

When no internet is reachable, the host falls back to a local password
(Factor 1) **+ host-side on-screen approval** (Factor 2 = physical presence).
The service is an enabler, never a hard dependency for LAN sessions.

### Location change detection

Location is a **risk signal that triggers step-up**, never a factor by itself.

* Derive a coarse location from the source **IP** using an offline **GeoLite2**
  database (country + region + ASN) — no third-party API calls, works offline
  on the Pi. IP geolocation is approximate; use coarse buckets, not cities.
* Keep a per-account set of **trusted locations** (country/region + ASN).
* On login: if device is trusted **and** location matches a trusted entry →
  proceed. Otherwise → send the **email code** (Flow A). On success the new
  location is added to the trusted set.
* Reduce false positives (or users get nagged constantly):
  - match on **country/region + ASN**, not precise coordinates;
  - ignore mobile-carrier rotation and known dynamic-IP ranges where reasonable;
  - offer "trust this location" + let the user manage/revoke trusted entries in
    the admin UI;
  - a password/OAuth change should invalidate trusted devices/locations.

> **Security note (important):** email is *not* a strong second factor on its
> own — if the attacker owns the mailbox, they pass. Its real strength here comes
> from combining it with the **trusted-device key** (something you have that the
> attacker does not, unless they also have the physical machine). That pairing is
> what makes the PoE-style flow actually defensible.

## 6. Session grant (token)

* **Algorithm:** Ed25519 (fast, tiny signatures) — fallback HS256 shared secret.
* **Claims:** `sub` (session id), `host` (host device id), `client` (controller
  device id), `iat`, `exp` (short, e.g. 5 min), `scope`.
* **Verification:** host validates the signature *offline* using the server's
  public key (cached). No per-frame or per-input call to the server.
* Media/input themselves are end-to-end encrypted with the two device keys;
  the grant only authorises *starting* the session.

## 7. Data model (SQLite)

```
Account        (id, email, totp_secret_enc, pin_hash, created_utc)
Device         (id, account_id, display_name, pubkey, last_seen_utc, approved)
TrustedDevice  (device_id, refresh_token_hash, first_seen_utc, last_seen_utc)
TrustedLocation(account_id, country, region, asn, first_seen_utc, last_seen_utc)
EmailCode      (id, account_id, code_hash, purpose, expires_utc, attempts)
Grant          (jti, host_id, client_id, issued_utc, expires_utc, used)
AuditEvent     (id, account_id, kind, detail, ip, geo, utc)
```

Secrets (TOTP, PIN) are encrypted at rest; PIN/password stored as **Argon2id**
hashes only. Email codes and refresh tokens are stored **hashed**. Never store a
raw password or a raw code.

## 8. Technology choices

| Concern            | Choice                                                       |
| ------------------ | ------------------------------------------------------------ |
| Server runtime     | ASP.NET Core Minimal API (.NET 10, ARM64)                    |
| Transport          | HTTPS (Kestrel) behind a self-signed or Let's Encrypt cert   |
| Storage            | SQLite (`Microsoft.Data.Sqlite`), no external DB             |
| Email code         | `MailKit` over SMTP (587) or a provider HTTP API             |
| Email provider     | Brevo / Postmark / Mailjet / SES (home ISPs block outbound 25)|
| GeoIP              | `MaxMind.GeoIP2` + GeoLite2-City.mmdb (bundled, offline)     |
| TOTP (opt-in)      | `Otp.NET`                                                     |
| Tokens             | `NSec.Cryptography` (Ed25519) or `System.IdentityModel` JWT  |
| Hashing            | `Konscious.Security.Cryptography.Argon2`                     |
| Push (Flow B)      | WebSocket to `Approver.App`, or self-hosted ntfy/UnifiedPush |
| Admin UI           | Minimal Razor Pages served by the same process               |
| Hosting on the Pi  | `systemd` unit, auto-start on boot, AOT-friendly             |

## 9. Raspberry Pi 3 deployment

```bash
# On the Pi (64-bit Raspberry Pi OS)
dotnet publish src/ScreenGrid.Auth.Server -c Release -r linux-arm64
sudo cp -r publish/* /opt/screengrid-auth/
sudo systemctl enable --now screengrid-auth.service
```

* Put it behind the home router; expose only HTTPS (via a reverse tunnel or
  port-forward + Let's Encrypt).
* Keep a nightly `sqlite3 .backup` to USB storage.
* Monitor memory: if it ever exceeds ~300 MB, something is wrong (media must not
  be flowing through it).

## 10. Security checklist

* [ ] TLS everywhere; certificate pinning for device↔server.
* [ ] Argon2id for secrets; TOTP secrets encrypted at rest.
* [ ] Email codes hashed at rest, single-use, TTL-bounded, resend-throttled.
* [ ] Rate-limit + lockout on failed logins / codes / TOTP; alert on new-location
      step-ups so a compromise is visible.
* [ ] Session grants single-use, short TTL, bound to host+client ids.
* [ ] Audit log of every approval / denial and every location step-up.
* [ ] No media or input ever relayed by the service.
* [ ] Signed, verifiable releases of the server binary.

## 11. Roadmap integration

The service is introduced across two phases rather than as new ones:

* **Phase 2 (Signaling):** ship `Auth.Server` in its minimal form — device
  registration, directory/rendezvous, and **email-code login + trusted device /
  location** (Flow A). This immediately unblocks peer discovery by ID.
* **Phase 5 (Security):** add `Approver.App` push approval (Flow B), optional
  TOTP (Flow A2), session grants with Ed25519, offline verification in
  `Host.Agent`, and the audit log.

## 12. Open questions

1. Do we want our **own mobile approver app** for Flow B, or is on-screen host
   approval enough for v1? (Email is chosen as the *account-login* factor; it is
   too slow for per-session approval.)
2. Is the Pi reachable from the internet (port-forward) or should it sit behind
   a tunnel (Tailscale / Cloudflare Tunnel)? — the same choice drives the v1
   remote path for media, see [`PROTOCOL.md §8 D2`](PROTOCOL.md) (overlay tunnel
   for v1; STUN/ICE in v2, TURN in v3).
3. Which **email provider** do we standardise on for sending codes (deliverability
   from a home connection is the main risk)?
4. Should accounts be optional (device-ID only, no email) to keep friction low,
   like AnyDesk's anonymous mode?
