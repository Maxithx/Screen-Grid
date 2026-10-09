# ScreenGrid — Transport & cryptography: QUIC / TLS 1.3

> Status: **decided, not implemented** — see [`PROTOCOL.md`](PROTOCOL.md) §8 (D1–D4).
>
> This document explains **what** QUIC and TLS 1.3 are, **what they give us**, and
> **how** ScreenGrid uses them. It is the background behind the transport decision.
> [`PROTOCOL.md`](PROTOCOL.md) remains the normative handshake specification; this
> file is the readable reference for anyone who has not worked with QUIC before.

---

## 1. In one paragraph

ScreenGrid carries **every** channel — `control`, `video`, `audio`, `input` and
`clipboard` — over a single **QUIC** connection. QUIC is a modern transport built
on top of UDP that includes **TLS 1.3 as its mandatory, non-negotiable encryption
layer**. That gives us a vetted, standards-based authenticated key exchange for
free, plus multiplexed independent streams, and it means we never write a line of
cryptography ourselves.

---

## 2. What is QUIC?

QUIC (originally "Quick UDP Internet Connections", now an IETF standard, RFC 9000)
is a general-purpose transport protocol. Think of it as **"TCP + TLS + HTTP/2-style
multiplexing, redesigned from scratch on top of UDP"** — but with the important
difference that encryption is *built in* rather than bolted on.

| Property                       | TCP + TLS                  | QUIC                                   |
| ------------------------------ | -------------------------- | -------------------------------------- |
| Carried over                   | Raw IP packets             | UDP datagrams                          |
| Encryption                     | Optional, added as a layer | **Mandatory**, integrated              |
| Handshake                      | 2–3 round-trips            | 1 round-trip (0-RTT optional)          |
| Multiple independent streams   | No (one byte stream)       | **Yes** — many streams per connection  |
| Head-of-line blocking          | Connection-wide            | **Per-stream only**                    |
| Connection survives IP change  | No                         | Yes (connection IDs / migration)       |
| Replay protection              | Application's job          | Built in (packet numbers)              |

Because QUIC runs on UDP it can be deployed and upgraded without touching the
operating system's networking stack, and because TLS 1.3 is *inside* the protocol
there is no way to accidentally run it unencrypted or negotiate a weak cipher.

---

## 3. What is TLS 1.3?

TLS 1.3 (RFC 8446) is the current version of **Transport Layer Security** — the
protocol that turns an insecure channel into an authenticated, encrypted one. It
is the layer that performs:

* **the handshake** — the other side proves who it is;
* **key agreement** — both sides derive fresh session keys that an eavesdropper
  cannot compute (X25519 ephemeral Diffie-Hellman);
* **record encryption** — every byte after the handshake is sealed with an AEAD
  cipher.

TLS 1.3 removed everything that had become dangerous in older versions:

* **No downgrade.** It cannot fall back to TLS 1.2 or 1.1; a peer that only
  supports old versions simply fails.
* **No weak options.** Obsolete ciphers (RC4, 3DES, static RSA key exchange,
  CBC-mode constructions) are gone. Only AEAD ciphers remain
  (AES-GCM, ChaCha20-Poly1305).
* **Forward secrecy is required.** Session keys are ephemeral — leaking a
  long-term key tomorrow cannot decrypt a session recorded today.
* **Most of the handshake is encrypted**, including the server certificate. In
  older TLS versions anyone on the wire could see which certificate was in use.

These are exactly the properties listed as principles in
[`PROTOCOL.md`](PROTOCOL.md) §2 — which is why we let the stack provide them
instead of implementing them ourselves.

---

## 4. Why QUIC for a remote desktop?

### 4.1 Security — the main reason

| Guarantee              | How QUIC/TLS 1.3 provides it                             | Why it matters to us                                      |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Confidentiality        | AEAD record encryption (AES-GCM / ChaCha20-Poly1305)     | Frames and keystrokes are unreadable on the wire          |
| Integrity              | AEAD authentication tag per record                       | A tampered frame is rejected, never rendered or injected  |
| Mutual authentication  | Certificates bound to our Ed25519 identity (§8 D3)       | Both sides prove possession of their device key           |
| Forward secrecy        | Ephemeral X25519 key agreement                           | A future device-key leak cannot decrypt recorded sessions |
| Replay protection      | Monotonic packet numbers inside the protocol             | Captured packets cannot be replayed to re-inject input    |
| No downgrade           | TLS 1.3 only, ALPN-bound version negotiation             | An attacker cannot force a weaker configuration           |
| Encrypted handshake    | Everything after the first flight is protected           | Device IDs, roles and version never travel in cleartext   |

**We do not implement any of this.** That is the point: no custom key schedule, no
"encrypt the key with my public key" pattern (explicitly rejected in
[`PROTOCOL.md`](PROTOCOL.md) §3).

### 4.2 Performance — where it actually wins

* **Multiplexing without head-of-line blocking.** Each channel is its own QUIC
  *stream* with its own flow-control window and its own retransmission. If the
  `video` stream is stalled waiting for a lost packet, `input` and `control`
  streams keep flowing. On TCP a single lost packet stalls *everything* — which
  for a remote-desktop session means the mouse freezes while the screen recovers.
  **This is the single most important property we gain.**
* **Fast establishment.** One round-trip instead of two or three. On a 60 ms link
  that is ~120 ms saved before the first frame.
* **Better loss recovery** with modern congestion control (CUBIC / BBR in MsQuic),
  which is what keeps the picture usable on a flaky Wi-Fi link.
* **Connection migration.** A session is identified by a connection ID, not by the
  IP/port four-tuple, so a laptop moving from Wi-Fi to cellular can keep the same
  session (subject to the NAT-traversal caveat in §5).

### 4.3 Honest limitations

* **Peak throughput is not the selling point.** On a clean LAN, a single bulk video
  stream moves about as fast as TCP. QUIC's advantage is latency *under loss* and
  multiplexing, not maximum bandwidth.
* **UDP throttling.** A minority of ISPs and corporate networks treat UDP as
  second-class or block it outright. A TCP fallback stays on the roadmap
  ([`PROTOCOL.md`](PROTOCOL.md) §8 D1).
* **0-RTT is replayable.** QUIC can re-send application data in the very first
  flight, but such data can be captured and replayed. So **input events and session
  grants must never be sent in 0-RTT**; for v1 we disable 0-RTT entirely.

---

## 5. What QUIC does *not* do: NAT traversal

QUIC secures and multiplexes a connection that **already exists** between two
reachable endpoints. It does not by itself solve *"how do two devices behind home
routers find each other?"* — that is the job of **ICE / STUN / TURN**, techniques
that originated with WebRTC:

| Acronym | Job                                                                  |
| ------- | -------------------------------------------------------------------- |
| STUN    | Ask a public server "what is my address as seen from the outside?"   |
| ICE     | Try all candidate address pairs and pick the one that actually works |
| TURN    | Last resort: relay the traffic through a public server               |

Pairing ICE with QUIC is **not a standardised, well-trodden path**: ICE nominates
a UDP candidate pair, while QUIC assumes it owns its socket and migrates by
connection ID. To keep that risk out of the critical path we stage NAT traversal
([`PROTOCOL.md`](PROTOCOL.md) §8 D2):

| Stage  | Mechanism                                                              |
| ------ | ---------------------------------------------------------------------- |
| **v1** | LAN only; remote access via an overlay tunnel (WireGuard / Tailscale)  |
| **v2** | STUN + UDP hole-punching (ICE-lite: `host` + `srflx` candidates)       |
| **v3** | TURN relay as the last resort behind symmetric NAT / CGNAT             |

`ScreenGrid.Transport` keeps the ICE/STUN/TURN seam in its interface from day one,
but only the QUIC path is implemented in v1.


---

## 6. How ScreenGrid uses QUIC

### 6.1 One connection, one stream per channel

```
                    ┌──────────────────── QUIC connection (TLS 1.3) ────────────────────┐
Host.Agent  ◀──────▶│  stream 0: control   ←→  handshake, session events, keep-alive     │◀─────▶ Client.App
                    │  stream 1: video     ──▶  encoded frames (host → controller)       │
                    │  stream 2: audio     ──▶  audio frames                             │
                    │  stream 3: input     ◀──  mouse / keyboard events (controller→host)│
                    │  stream 4: clipboard ←→  text / images, bounded chunks             │
                    └────────────────────────────────────────────────────────────────────┘
```

Each stream has independent flow control and retransmission. Streams are created
lazily and torn down per channel, but they all share **one** TLS 1.3 session.

### 6.2 Two handshakes, one purpose each

| Layer       | Protocol             | Establishes                                                       |
| ----------- | -------------------- | ----------------------------------------------------------------- |
| Transport   | QUIC / TLS 1.3       | Session keys, confidentiality, integrity, replay protection        |
| Application | ScreenGrid handshake | **Identity + authorisation only** — device-key proof and the grant |

Critical detail: because QUIC already produced the transport keys, our application
handshake **does not exchange keys**. It proves who is on the other end and that
this session is allowed. (In a hypothetical raw-UDP/Noise fallback, data-phase keys
*would* be derived here via HKDF — see [`PROTOCOL.md`](PROTOCOL.md) §4.3 and §8 D4.)

### 6.3 Certificate model: self-signed per device + pinning

Each device generates a **self-signed certificate bound to its Ed25519 identity
key**. The peer never consults a public CA: it verifies the certificate against the
public key it fetched from the directory and **pins** it
([`PROTOCOL.md`](PROTOCOL.md) §8 D3). Revoking a device is a directory action, not a
CA operation — which keeps the Raspberry Pi free of revocation infrastructure.

### 6.4 Policy summary

| Policy                  | Decision                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| 0-RTT                   | **Disabled** in v1 (replay risk; never used for input or grants)   |
| ALPN                    | A single ScreenGrid protocol id, bound into the signed transcript  |
| Separate data-phase key | Not needed for v1 — TLS 1.3 record layer is sufficient (§8 D4)      |
| Rekeying                | QUIC key update after N bytes / T minutes                           |
| Plaintext bootstrap data| None — server certificate and version ride inside the handshake     |

---

## 7. Deployment facts (why this is cheap for us)

`System.Net.Quic` in .NET is a managed wrapper over **MsQuic**, Microsoft's
production QUIC implementation.

| Platform                  | What is needed                                           |
| ------------------------- | -------------------------------------------------------- |
| Windows 11 / Server 2022+ | **Nothing** — MsQuic ships with the OS                   |
| Windows 10                | MsQuic redistributable (only if it stays a target)       |
| Linux                     | `libmsquic` package                                      |

ScreenGrid's QUIC endpoints are `Client.App` and `Host.Agent`, **both Windows** —
so there is no extra dependency to ship. `Auth.Server` runs on the Pi but speaks
plain **HTTPS (Kestrel) + SQLite** and never touches QUIC, so **no `libmsquic` is
needed on `linux-arm64`** — which keeps its `MemoryMax=300M` budget clean
([`RELIABILITY.md`](RELIABILITY.md) §4).

---

## 8. Alternatives we rejected

| Option                                        | Why not (for v1)                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| **TCP + TLS 1.3**                             | One byte stream → connection-wide head-of-line blocking (mouse freezes) |
| **WebRTC** (DTLS/SCTP)                        | Heavy stack; SCTP-over-DTLS is less flexible than QUIC streams          |
| **UDP + Noise**                               | We would own key schedule, nonces, rekeying and replay windows — what §2 forbids |
| **Overlay only** (WireGuard/Tailscale, no QUIC) | Gives reachability but no per-stream flow control or identity binding  |

An overlay tunnel is **complementary**, not an alternative: the v1 remote path uses
a tunnel for reachability and QUIC for the session itself.

---

## 9. Glossary

| Term       | Meaning                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| AEAD       | Authenticated Encryption with Associated Data — encrypts *and* detects tampering |
| ALPN       | Application-Layer Protocol Negotiation — how the app id is agreed in the handshake |
| CGNAT      | Carrier-Grade NAT — a second NAT layer that defeats simple port-forwarding |
| DTLS       | TLS for datagrams (UDP) — used by WebRTC                                   |
| Ed25519    | Edwards-curve signature algorithm — our long-lived **device identity**     |
| HKDF       | HMAC-based Key Derivation Function — derives keys from a shared secret      |
| MsQuic     | Microsoft's cross-platform QUIC implementation, used by `System.Net.Quic`  |
| RTT        | Round-Trip Time — how long a packet takes to the peer and back             |
| Stream     | A QUIC primitive: an ordered, flow-controlled byte channel inside a connection |
| X25519     | The elliptic curve used for ephemeral key agreement in TLS 1.3             |

---

## 10. References

* [`PROTOCOL.md`](PROTOCOL.md) — normative handshake & session design (§8 = decisions).
* [`RELIABILITY.md`](RELIABILITY.md) — buffer / queue / DoS rules every channel obeys.
* [`AUTH-SERVER.md`](AUTH-SERVER.md) — identity, directory and session grants.
* RFC 9000 (QUIC transport), RFC 9001 (QUIC + TLS), RFC 8446 (TLS 1.3).


