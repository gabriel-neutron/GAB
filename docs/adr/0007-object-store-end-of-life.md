# ADR 0007 — The object store is SeaweedFS

**Status** Accepted · 7 September 2026 · Amended 5 October 2026 (#243)

The raw store is an S3 server. T3 puts the raw file in an S3 store; it names no product, so nothing
here contradicts the locked register.

### 1. SeaweedFS holds the bucket raw

`chrislusf/seaweedfs:4.48`, pinned by tag and by digest, Apache-2.0. One service runs `weed mini`.
The S3 API is on `127.0.0.1:9000` (ADR 0002 §4). `-bucket=raw` makes the private bucket at start,
and no init job runs. The admin UI, WebDAV, Iceberg and Lance are off. The bytes are in the named
volume `gab-raw-data`.

The store stays an S3 server. A deployment can use any S3 provider through `RAW_STORE_ENDPOINT` and
`RAW_STORE_REGION`. No provider is chosen here.

### 2. Three accounts, written in one file

`infra/seaweedfs/s3.json` holds the accounts and no key. Each key is a `${RAW_STORE_*}` reference
to the environment. The application account `gab-app` has one managed policy, `gab-app-put-list`:
`s3:PutObject` on `raw/*` and `s3:ListBucket` on `raw`. The action `Write` is not used, because it
also grants `DeleteObject`. The test account `gab-admin` has `Read:raw`, `Write:raw` and
`List:raw`. The research account `gab-research` (#192) has one managed policy, `gab-research-put`:
`s3:PutObject` on `raw/*`, and nothing else. No anonymous identity exists.

### 3. The proof

Proven on 5 October 2026 on `4.48`, on the disposable stack of the VPS, with the project client.
`PUT` and `LIST` pass as `gab-app`. Anonymous `GET` and anonymous `LIST` get 403. `gab-app` gets
`AccessDenied` on `GET`, `DELETE` and `PutBucketPolicy`. The test
`packages/store/src/object.db-test.ts` holds this proof.

### 4. One trigger moves it, and it is written before it fires

Any CVE or end of support that touches the pinned SeaweedFS release. A second trigger: the day the
bucket leaves the loopback address, or a second person writes to it.

**Garage** `dxflrs/garage:v2.1.0`, AGPL-3.0, passed a smaller proof on 7 September 2026: a private bucket, put and list.
It refused the project key with `Invalid key format ... starts with GK`, so it costs new credentials, and it
is the fallback. AGPL-3.0 has no effect on PU1 either way. The image is unmodified, the port is
bound to the loopback address, and the S3 protocol is the boundary.

## Consequences

- **The compose file does not start without the six `RAW_STORE_*` key values.** Each key may hold
  only letters, digits, `.`, `_`, `+` and `-`. The operator writes them in `infra/.env`.
- **The managed policy depends on the IAM engine of SeaweedFS 4.x.** A later tag that changes it
  must pass `object.db-test.ts` before the pin moves. A failure there is the fact that proves this
  decision wrong.
- **The upstream image can go.** The operator copies the pinned image to
  `ghcr.io/gabriel-neutron/seaweedfs` (#213 point 4), and the compose file then points to the copy.
- **A move to another S3 server is a Compose-file edit and a copy of the bytes**, for as long as no
  caller uses a SeaweedFS-only surface. The first such caller makes this decision more expensive.
- **The trigger must be watched by a person.** No feed is subscribed, and no check runs.
