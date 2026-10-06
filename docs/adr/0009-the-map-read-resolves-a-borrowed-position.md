# ADR 0009 — The map read resolves a borrowed position, and the walk stands inside the view

**Status** Accepted · 9 September 2026

## Context

Some units have no position of their own. For some of them, the best statement about their location
is the position of their parent. The source data marks this case. It is a judgement about the
evidence, not a display choice: other units have a positioned parent too, and the source refused to
let them inherit.

This ADR decides how that judgement reaches the map. It does not reopen ADR 0005 or ADR 0008.

## Decision

**The stated word decides, and a missing geometry never does.** Only an entity whose position
precision says "inherited" borrows a point from an ancestor. An entity with no geometry and no such
statement borrows nothing. A rule of the form "no geometry, and a parent with a point" draws many
more entities than the ones that make the claim, and it destroys the difference that this ADR
protects. The graph cannot rebuild the judgement, because the judgement is not in the graph.

**The walk up the ancestors stands inside the map view**, in SQL, as `spec.md` T4 asks for a
graph traversal. It does not stand in a separate function. A function that the view calls must
exist before the view, and it must read a view that is made in the same step. The two then need
each other, and a database built from zero fails.

**Four rules hold the walk, and a test holds each rule:**

- Only the stated word borrows a point.
- An own point wins. An entity that states the word and has a point keeps its own point and names
  no parent.
- Only a point is taken. The walk climbs past an ancestor that has an area. An entity that has an
  area takes the borrowed point, because a borrowed position stays a point.
- The climb has a fixed depth limit. The limit stops a loop in the data, because the schema does not
  refuse a ring of relations. When two ancestors are at the same distance, the identifier breaks the
  tie, so the answer is the same on each run.

**The surface shows that a position is borrowed, and from which parent.** A halo is drawn under the
point, and the hover label, the map index and the detail panel tell "position from" the parent. The
point mark, its colour, its outline and its size do not change. The map does not draw a ring in
metres, a ring that changes with the zoom, a faded fill or a line to the parent. Opacity already
has other meanings, and a line to the parent has zero length.

**An absent word is never a measured position.** An entity that has a point and states no word
reads as the cautious state. No layer of the read path supplies a default word.

## Reason

The difference between a measured and a borrowed position is part of the evidence. The database
holds the judgement, so the database resolves it, once, for every surface.

A measurement on 9 September 2026, with a synthetic corpus of about 10,000 entities, gave a full
map read of about 150 ms. The timeout of ADR 0008 stays the only bound.

## Consequences

- The map view gives one row for each entity, not only for each entity with a geometry. The
  exemption of ADR 0003 and the time bound of ADR 0008 still hold at that size.
- The map read decides what is drawn, and the geometry of the entity does not. A surface that
  filters on the geometry is wrong for the rows that this ADR is about.
- The application repeats none of the walk. Only the committed fixture for the stories walks the
  tree in TypeScript, because it replaces the database.
- An entity that nobody located, and whose ancestors have no point, has no position. The map does
  not draw it. That is not a fault.
- **What proves it wrong:** an analyst who cannot tell a borrowed position from a measured one on
  the map. The halo then gets more opacity or a larger radius. The point never gets less colour.
