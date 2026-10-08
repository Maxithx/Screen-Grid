# ScreenGrid — Reliability & resource safety (memory, CPU, DoS)

> Status: **proposal** — coding rules that apply from Phase 2 onwards.

## 1. Why this document exists

ScreenGrid is a **managed** (.NET) application, so classic C/C++ buffer overflows
(writing past the end of an array) cannot happen the way they do in native code.
That does **not** make memory safe. In a remote-desktop app the real risks are
**resource exhaustion driven by untrusted input**:

* a peer announces a 4 GiB "frame" and we allocate a buffer that size → OOM;
* a decompression bomb expands a few KB into gigabytes;
* an unbounded queue fills faster than it drains under a flood → OOM;
* many half-open sessions each hold buffers and exhaust the host;
* the **Raspberry Pi 3 has 1 GB RAM and no swap** — one mistake takes the trust
  root offline.

This document turns "be careful with memory" into concrete, reviewable rules.

## 2. Threat model

The adversary controls everything that arrives over the network: message lengths,
field values, timing and volume. **Assume any peer can be hostile.** Local files
and the database are semi-trusted; in-memory secrets are a target but are covered
by [`AUTH-SERVER.md`](AUTH-SERVER.md).

## 3. Hard invariants (the rules)

### R1 — Validate every remote-supplied size before allocating
Never allocate directly from a value read off the wire. Check it against a hard
cap defined in `ScreenGrid.Protocol` first.

```csharp
// WRONG
byte[] payload = new byte[reader.ReadUInt32()];

// RIGHT
uint len = reader.ReadUInt32();
if (len > ProtocolLimits.MaxVideoFrame)
{
    throw new ProtocolException("frame too large");
}

byte[] payload = ArrayPool<byte>.Shared.Rent((int)len);
try
{
    // read exactly len bytes into payload
}
finally
{
    ArrayPool<byte>.Shared.Return(payload);
}
```

### R2 — Bound every queue and channel
Use `Channel.CreateBounded<T>` (with `BoundedChannelFullMode.DropOldest` or
`Wait`) for the video / input / clipboard pipelines. **Never**
`Channel.CreateUnbounded`.

### R3 — Back-pressure, never unbounded growth
When a consumer is slower than the producer, either drop frames, coalesce, or
slow the producer. A buffer must never grow without bound.

### R4 — No `stackalloc` with an untrusted length
`stackalloc` is allowed only with a compile-time constant or a validated small cap
(e.g. ≤ 1 KiB). Otherwise use a pooled heap buffer.

### R5 — Pool large / pinned buffers
Frame-sized buffers come from `ArrayPool<byte>.Shared` (or a custom pool) and are
always returned in a `finally`. Avoid new allocations on the per-frame hot path
to keep the Large Object Heap quiet.

### R6 — Cap decompression
If any channel compresses, limit **both** the output size and the expansion ratio
(e.g. 64 MiB and 100×). Reject anything beyond that.

### R7 — Limit concurrency
Cap concurrent sessions, streams per session and in-flight messages per peer.

### R8 — Timeout everything
Every network read/write awaits with a `CancellationToken` **and** a timeout. No
operation may wait forever for a hostile peer.

### R9 — Dispose deterministically
Anything owning a socket, handle, `Memory<byte>` lease or bitmap is
`IDisposable` and is used with `using` / `await using`.

### R10 — Fail closed and clean up
On any integrity or limit violation: stop reading, release buffers, close the
connection. Do not keep state "just in case".

## 4. Resource budgets

| Host                  | RAM      | Budget for the process           | Notes                        |
| --------------------- | -------- | -------------------------------- | ---------------------------- |
| Windows client / host | 8–32 GB  | < 500 MB steady                  | capture + decode pipelines   |
| Raspberry Pi 3 (Auth) | 1 GB     | < 200 MB steady, `MemoryMax=300M`| no media ever flows through it |

The per-frame working set must be proportional to the **negotiated** resolution,
never to what the peer *claims*.

## 5. Verification

* `dotnet-counters monitor` (GC heap size, working set) on both platforms.
* Instrument peak buffer usage; assert queue depths stay bounded under load.
* **Adversarial tests (Phase 2 CI):** oversized length prefixes, decompression
  bombs, slow-loris handshakes, message floods, many half-open connections — the
  process must stay within budget and keep serving.
* Enable analyzers: `EnableNETAnalyzers`, `AnalysisLevel=latest`, and treat the
  relevant CA rules as errors (e.g. dispose correctness, large-allocation rules).

## 6. Review checklist

- [ ] Every wire-supplied size validated before allocation.
- [ ] No `Channel.CreateUnbounded` / unbounded `List` growth fed by the network.
- [ ] `stackalloc` only with constant or validated small sizes.
- [ ] Pooled buffers returned in `finally`.
- [ ] All network I/O has a timeout + `CancellationToken`.
- [ ] Concurrency caps enforced (sessions, streams, in-flight).
- [ ] Decompression bounded by size **and** ratio.
- [ ] A load / DoS test added for every new network-facing code path.
