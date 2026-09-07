# ADR 0007 — The object store stays MinIO, and its successor is chosen

**Status** Accepted · 7 September 2026

ADR 0002 §1 runs the raw store as MinIO, and its Consequences record that the upstream is archived
and that the tracker carries the risk. The risk is now answered, so it leaves the tracker and takes
a decision. T3 puts the raw file in an S3 store; it names no product, so nothing here contradicts
the locked register.

### 1. The bucket stays on MinIO for the first build

It stays on the pinned release `RELEASE.2025-09-07T16-13-09Z`. The store works, ADR 0002 §4 binds
it to `127.0.0.1`, and a move costs a migration of the bytes for a fault nobody has met.

### 2. One trigger moves it, and it is written before it fires

Any CVE published against the MinIO server that touches the pinned release. The upstream is
archived — `repos/minio/minio` reports `archived=true`, last push 24 April 2026 — so "published"
and "no patch" are the same day, and no waiting period exists to spend.

A second trigger: the day the bucket leaves the loopback address, or a second person writes to it.

### 3. The successor is tested, and not assumed

**SeaweedFS** `chrislusf/seaweedfs:3.97`, Apache-2.0. Proven on 7 September 2026 under Docker
Desktop on Windows 11: it held the private bucket `raw` with anonymous GET and anonymous list both
refused with 403, and it answered the unmodified project client with the credentials already in
`infra/.env` — `PUT OK`, `LIST OK 1`. No source file changed.

**Garage** `dxflrs/garage:v2.1.0`, AGPL-3.0, also passed, and it refused the project key with
`Invalid key format ... starts with GK`. It therefore costs new credentials, and it is the fallback.

AGPL-3.0 has no effect on PU1 either way. The image is unmodified, the port is bound to the
loopback address, and the S3 protocol is the boundary. §13 of that licence binds a modifier who
lets remote users interact, and there is no modification and no remote user.

## Consequences

- **The move is a Compose-file edit and a copy of the bytes**, for as long as no caller uses a
  MinIO-only surface: the admin API, bucket notification, or the console as a product surface. The
  first such caller makes this decision more expensive, and it is the fact that proves it wrong.
- **The trigger must be watched by a person.** No feed is subscribed, and no check runs. An
  archived upstream publishes no advisory of its own.
- **The candidate ages.** The proof above keeps its date. A move made long after it needs the same
  two commands run again, and not a fresh comparison.
