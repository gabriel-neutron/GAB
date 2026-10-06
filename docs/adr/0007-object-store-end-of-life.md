# ADR 0007 — The object store is SeaweedFS

**Status** Accepted · 7 September 2026 · Amended 5 October 2026

## Decision

The raw store is an S3 server. SeaweedFS runs it in the local stack. The image is pinned, and one
service holds one private bucket for the raw files. The service makes the bucket when it starts.
The bucket is reachable on the loopback address only.

The code speaks S3 and nothing else. A deployment can use any S3 provider through configuration.
This ADR chooses no provider for a deployment. `decisions.md` T3 asks for an S3 store and names no
product, so this ADR does not contradict the register.

## Least privilege

One file in `infra/` holds the accounts and their policies. It holds no key: each key comes from the
environment.

- **The application** can put an object and list the bucket. It cannot read back, delete or change
  a policy. A raw file is evidence, so the application never removes or replaces one.
- **The research role** can only put an object.
- **A test account** has full access to the bucket, for the tests only.
- **No anonymous access** exists.

A test against the real store proves these limits. It is the proof of this decision.

## Reason

SeaweedFS is open source under a permissive licence, runs as one small service and supports managed
policies. A managed policy lets the application write without the right to delete.

**Garage** is the fallback. It passed a smaller proof: a private bucket, put and list. It refused
the format of the project keys, so a move to Garage costs new credentials. Its licence has no effect
on the publication rules, because the image is unmodified and the S3 protocol is the boundary.

## When to move

The operator moves away from SeaweedFS when one of these occurs:

- a security fault or an end of support touches the pinned release;
- the bucket leaves the loopback address, or a second person writes to it.

## Consequences

- The stack does not start without the store keys in the environment.
- The managed policies depend on the IAM engine of SeaweedFS. A new release must pass the store
  test before the pin moves. A failure of that test proves this decision wrong.
- The upstream image can disappear. Then the operator copies the pinned image to the project
  registry, and the Compose file points to the copy.
- A move to another S3 server is a change to the Compose file and a copy of the bytes, while no
  caller uses a function that only SeaweedFS has. The first such caller makes a move more costly.
- A person must watch the triggers. No feed and no check does it.
