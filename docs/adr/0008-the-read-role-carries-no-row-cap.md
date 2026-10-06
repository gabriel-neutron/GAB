# ADR 0008 — The read role carries no row cap, and time is the only bound

**Status** Accepted · 7 September 2026

## Context

ADR 0003 exempts two reads from the default row limit: the full graph and the full map. It does
not tell how. This ADR decides the mechanism. It does not reopen the exemption.

## Decision

**No row cap is set on the read role.** The API serves the read role with no row ceiling.

**Time is the only bound.** The read role has a short statement timeout. The database stops a read
that runs away, and nothing else stops it.

## Reason

PostgREST sets a row cap for each role, not for each view. A cap that is large enough for the full
graph is the same cap for each other read of that role. So the cap is not a fence for the other
reads. It is only a number that will become wrong one day, with no warning.

A measurement on 7 September 2026 supports this. With a synthetic corpus of 10,000 entities and
25,000 relations, the full graph and the full map each returned in less than one tenth of a second.
That is far inside the timeout. A row cap would not have stopped any measured read before the
timeout.

## Consequences

- **A cap that is too low can no longer cut a full read with no warning.** The exempt views exist
  to prevent that failure. The opposite failure is now possible: a read that returns more than a
  surface can hold, inside the timeout.
- **Each read of the read role has no row cap**, not only the two exempt views. The register names
  default limits as a fence for a publicly readable database. The local database is not public: its
  ports are on the loopback address, and one operator holds the machine. On the day the read port
  leaves the loopback address, a new ADR reopens this decision and the exemption.
- **What proves it wrong:** a read that stays inside the timeout and returns more rows than a
  surface can draw. On that day, a measured cap comes back with a new ADR.
