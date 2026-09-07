# ADR 0008 — The read role carries no row cap, and time is the only bound

**Status** Accepted · 7 September 2026

ADR 0003 §9 exempts two reads from the default `LIMIT` — the full-graph view and the full map view
— and leaves the mechanism of that exemption open. This settles it. The exemption itself is not
reopened; only its mechanism is decided here.

### 1. No row cap is set

`db-max-rows` is not configured. `infra/docker-compose.yml` carries no such line, and PostgREST
serves `gabriel_read` with no row ceiling.

PostgREST caps rows **per role and never per view**, so any cap large enough for the full graph is
a cap on every read of that role. A number that covers the biggest read is not a fence for the
others; it is the same absence, written as a number that will one day be wrong in silence.

### 2. `statement_timeout` is the bound

5 seconds on the read role, as ADR 0003 §9 already states. A read that runs away is stopped by
time, and by nothing else.

**The measurement that produced this**, taken on 7 September 2026 in one rolled-back transaction
against 10,000 entities and 25,000 relations: the full graph returned 35,044 rows and 9.6 MB in
77 ms; the full map returned 5,024 rows and 819 kB in 11 ms. Both sit three orders of magnitude
inside the timeout, so a row cap would not have fired before the timeout on any read measured.

## Consequences

- **A cap set too low truncates a full read in silence**, which is the failure the exempt views
  exist to prevent. That failure is now impossible, and the opposite one is open: a read that
  returns more than a surface can hold, inside 5 seconds.
- **Every read of `gabriel_read` is uncapped, and not only the two exempt views.** The register
  names default limits among the fences for a *publicly readable* database. This database is not
  one: ADR 0002 §4 binds every port to `127.0.0.1`, and one operator holds the machine. The tension
  is recorded and not dismissed. The day the port leaves the loopback address, this decision is
  reopened by a new ADR, together with the exemption itself.
- **What proves it wrong.** A read that stays inside 5 seconds and still returns more rows than a
  surface can draw. A cap returns on that day, with a measured number and a new ADR.
