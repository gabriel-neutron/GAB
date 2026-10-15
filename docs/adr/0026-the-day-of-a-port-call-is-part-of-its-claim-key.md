# ADR 0026 — The day of a port call is part of its claim key

**Status** Accepted · 14 October 2026

## Context

The claim key of a relation holds its type and its two ends (see the spec). Two calls of
one vessel at one port, on two days, had one key. A rejection, a denial by a party and the source
count of one call then reached the other. Decision M3 says that a port call is a relation, so the
key must tell two calls apart. The key is frozen with the act, and each read of the record uses
it, so a change of the rule is costly to reverse.

## Decision

- The key of a new relation of type `berthed_at`, `loads_at` or `discharges_at` holds the day
  (`attrs.observed_on.v`) after the two ends, when the act gives one. The value enters as the act
  writes it.
- Only these three types take the day. `flagged_falsely` also holds `observed_on`, and its key
  does not change. The list is in the key function and in one constant of the propose tool.
- An old key does not move. The key of an act with no day, and of each other type, is the same
  byte for byte.
- The rejection, the denial, the source count and the digit read the key, so they now work for
  each call alone. No other rule changes.
- Migration 0080 writes the new key of each dated port call, and of each act that names a moved
  act, level after level. It does not write each key again, because the name of an entity can
  change its key. If the new rule would move the key of any other relation, the migration stops
  and writes nothing. It prints the count of the old dated port calls.
- The day is exact. The propose tool keeps `observed_on` on a port call only when it is one real
  calendar day that a cited passage states. Else it removes the day, and `droppedBounds` names
  it. This applies to the research AI and to the extractor, as for an unstated start date. A
  guessed day would make a false second fact. A call with no day has the old key. A day that takes
  its year from the publication day stays, and the item is disputed.

## Alternatives

- **A column in the relation type table.** A new port-call type needs a new key migration anyway,
  because the key is frozen. A list in the code is the smaller change.
- **A window of days.** It needs a product choice about how far two days are one call. Refused.
- **A port call as an event node.** This is a different claim. It stays out.

## Cost

- Two sources that give two days for one call make two facts. A reader of the review queue sees
  both.
- A call with a day and the same call with no day are two facts. A source that states the day and
  a source that does not corroborate nothing for each other. A rejection or a denial of the call
  with no day does not reach a later call with a day of the same vessel and port, and the reverse.
- A day that a later `update_attrs` adds to a promoted undated call does not change the key of
  that call. The key is frozen with the act.
- A new port-call type needs a new migration that writes each key again, and a change of the
  constant of the propose tool.
