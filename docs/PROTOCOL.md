# ScreenGrid — Connection protocol (handshake & session design)

> Status: **proposal** — not implemented. Covers Phase 2 (Signaling / Transport)
> and Phase 5 (Security).

## 1. Why this document exists

The handshake is the single most important security decision in a
remote-desktop product: it is where identity is proven and where the keys that
protect every later frame and keystroke are established. A subtle mistake here
(a missing nonce, a downgrade path, a DIY cipher) compromises the **entire**
session, so it is written down and reviewed *before* any code is written.

It also fixes the **resource limits** that the handshake and message framing must
enforce so a hostile peer cannot exhaust memory — see
[`RELIABILITY.md`](RELIABILITY.md).

## 2. Principles

1. **Do not roll your own crypto.** No custom block ciphers, no custom MAC
   constructions, no custom key derivation.
2. **Prefer a vetted handshake.** Use TLS 1.3 (via QUIC) or the Noise Protocol
   Framework — never an ad-hoc "send key, hope for the best" exchange.
3. **Mutual authentication.** Both host and controller prove possession of their
   long-lived device key. Neither trusts the other blindly.
4. **Forward secrecy.** Ephemeral (per-session) key agreement, so a later leak of
   a device key cannot decrypt recorded past sessions.
5. **Authenticate the metadata too.** Version, roles, device IDs and the session
   grant are bound into the handshake transcript, so they cannot be tampered
   with in flight.
6. **Fail closed.** Any verification failure tears the connection down
   immediately — there is no "continue anyway" path.

## 3. Transport & handshake building blocks

| Layer             | Recommendation                                     | Notes                                                                              |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Secure transport  | **QUIC** (`System.Net.Quic`, MsQuic)               | Built-in TLS 1.3, independent streams, per-stream + connection flow control, loss recovery. |
| Key agreement     | X25519 (ephemeral)                                 | Handled inside TLS 1.3.                                                            |
| Device identity   | **Ed25519** device keys (`NSec.Cryptography`)      | Registered with `Auth.Server`, verified by the peer.                               |
| Payload crypto    | AEAD: ChaCha20-Poly1305 (preferred) or AES-256-GCM | Per-record nonce, never reused.                                                    |
| Directory/signals | HTTPS to `Auth.Server`                             | Device resolution + signed records.                                                |

**Why QUIC first:** it removes almost all hand-rolled risk (TLS 1.3, replay
protection, rekeying and flow control are handled by the stack), multiplexes the
control / video / audio / input / clipboard channels as **separate streams** with
independent back-pressure, and behaves well on lossy links. A WebRTC stack is the
alternative; a raw UDP + Noise implementation is the fallback only where QUIC is
unavailable.

> **Reject this pattern:** "here is my public key, here is a random session key
> encrypted with it." It has no forward secrecy, no transcript binding, and is
> trivial to get wrong.

## 4. Connection phases

```
Directory (HTTPS)          QUIC handshake           App handshake         Data phase
resolve host + pubkey  →   TLS 1.3 + cert pin   →   device-key proof  →   AEAD streams
```

### 4.1 Pre-handshake — resolution
1. The controller asks `Auth.Server` for the host record (endpoint hints +
   Ed25519 public key). The directory response is **signed by the server**; the
   client pins the server public key.
2. The controller verifies the server signature and the record freshness
   (`last_seen`, TTL). Stale records force a re-resolve.

### 4.2 Secure transport — TLS 1.3 (QUIC)
* Each device presents a self-signed certificate **bound to its Ed25519
  identity**; both sides **pin the peer certificate to the public key obtained
  from the directory** instead of trusting a public CA.
* ALPN selects the protocol version, e.g. `screengrid/1`.

### 4.3 Application handshake — identity binding & grant
Runs over the first bi-directional control stream:

1. `hello` — protocol version, role, device id, random 32-byte nonce `Nc`.
2. Host replies with its own nonce `Nh`, and (Phase 5) the **SessionGrant**.
3. Both sides compute
   `transcript = H(Nc || Nh || version || hostId || clientId || grant)`.
4. Each side sends an Ed25519 signature over the transcript, proving possession
   of its device key; the peer verifies it against the **pinned** public key.
5. The client verifies the SessionGrant signature offline (cached server public
   key) and that it is fresh, single-use (`jti`) and scoped to this host+client
   pair.
6. On success both sides switch to the data phase. Any failure → immediately
   close the connection.

> With QUIC/TLS the transport record keys already exist — this app handshake
> establishes **identity and authorisation**, not transport keys. Only in a raw
> UDP/Noise fallback are data-phase keys derived here (via HKDF).

### 4.4 Data phase
* Separate QUIC streams per channel: `control`, `video`, `audio`, `input`,
  `clipboard`. Independent flow control means a stalled video stream cannot block
  input.
* The TLS 1.3 record layer provides AEAD per record. Any custom layer uses
  ChaCha20-Poly1305 with a **monotonic 64-bit nonce** that never repeats.
* **Rekeying:** rotate data keys after N bytes or T minutes (QUIC key-update, or
  an explicit rekey for a custom layer).

## 5. Replay, freshness & downgrade protection

| Risk                 | Mitigation                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Replayed handshake   | Per-session random nonces from both sides, bound into transcript  |
| Replayed data        | AEAD nonce never repeats (counter / QUIC packet numbers)          |
| Replayed grant       | `jti` recorded in the `Grant` table, single-use, short TTL        |
| Reordered / stale    | Monotonic counters; drop anything below the high-water mark       |
| Clock skew           | TTLs tolerate small skew (±60 s); prefer counters over wall-clock |
| Version downgrade    | Negotiated version + ALPN bound into the signed transcript        |
| Cross-session reuse  | Ephemeral keys per connection; keys destroyed on teardown         |

## 6. Message framing & limits

* Control messages are length-prefixed (`u32` big-endian length + payload).
* **The declared length is validated against a hard cap before any allocation**
  (see [`RELIABILITY.md`](RELIABILITY.md) §3). A frame larger than the cap is a
  protocol error and closes the connection.
* Recommended caps (single source of truth in `ScreenGrid.Protocol`):

  | Message class    | Max size |
  | ---------------- | -------- |
  | control          | 64 KiB   |
  | input event      | 4 KiB    |
  | clipboard chunk  | 1 MiB    |
  | video frame meta | 64 KiB   |
  | video payload    | 8 MiB    |

* Serialization is explicit and versioned; unknown fields are ignored only when
  the negotiated version allows it.

## 7. Failure handling

* Every network read awaits with a **timeout** and a `CancellationToken`.
* A handshake has a total budget (e.g. 10 s); exceeding it closes the connection.
* Half-open connections are torn down; no state is retained for a peer that
  stopped responding beyond its TTL.
* Errors are versioned / tagged codes — never raw exception text sent to the peer.

## 8. Open questions

1. QUIC (`System.Net.Quic`) vs. a WebRTC stack vs. Noise-over-UDP for the media
   path — decide once in Phase 2 and record it here.
2. Certificate model for QUIC: self-signed-per-device + pinning, or a private
   `Auth.Server` CA issuing short-lived device certificates?
3. Do we need a separate data-phase key beyond the TLS 1.3 records, or is the
   QUIC record layer sufficient for v1?
