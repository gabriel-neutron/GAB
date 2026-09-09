# ADR 0009 — The map read resolves a borrowed position, and the walk stands inside the view

**Status** Accepted · 9 September 2026

An entity that nobody located is not drawn on the map. **Measured over the v1 corpus on 8
September 2026**, it states as data that 142 units of 1,010 have no position of their own **and** that the best available statement about where
they are is the position of their parent. `position_mode = 'parent'` is not a display preference;
it is an epistemic state, and 599 further units marked `none` prove it is a judgement, because 319
of those have a positioned parent one hop up and v1 still refused to inherit for them.

This decides how that state reaches a surface. It does not reopen ADR 0008, which measured the
shape this read replaces, and it does not reopen ADR 0005.

### 1. The word decides, and a null geometry never does

Only an entity whose `position_precision` attribute reads `inherited` borrows a point. **Not**
every entity with no geometry.

**Measured over the v1 corpus on 8 September 2026**: every unpositioned unit has a positioned
ancestor. A rule of
the shape "no geometry, plus a parent with a point" therefore draws 740 entities where 142 make
the claim, and it destroys the distinction this decision exists to protect. The graph cannot
reproduce the judgement, because the judgement is not in the graph.

### 2. The walk stands inside `api.full_map`, and not in a function beside it

T4 puts a graph traversal in SQL, and this walk stays there. It does **not** stand in a function
of the shape of `api.neighbourhood`, which is what the build ticket asked for, and the reason is
an ordering one that only a database built from zero exposes:

A function that the view calls must exist before the view, so it takes a file that runs before
`20_views.sql`. It must then read `api.entity`, which `20_views.sql` creates. The two files each
need the other, and `pnpm db:reset` stopped with `relation "api.entity" does not exist`.

**Its cost was measured**, on 9 September 2026, in a transaction that rolled back: 10,027 entities
and 9,999 `subordinate_to` relations, of which 7,996 rows took a borrowed point, in 145 to 155 ms.
The five-second statement timeout of ADR 0008 remains the only bound.

### 3. Four rules, and each one is held by a test

- **The word alone borrows.** An entity that states nothing takes no point from an ancestor.
- **An own point wins.** An entity that states the word and carries a point keeps its own point and
  names no parent, or a reader states an origin the point never had.
- **Only a point is taken, at either end.** An ancestor that carries an area is climbed through,
  and an entity that carries an area takes the borrowed point over its own area, because a surface
  that draws a dot reads any other shape as no position at all.
- **The climb stops after four hops.** The unit tree is four deep, and the 142 need three at most.
  The bound is what stops the recursion: no CHECK refuses a relation from a row to itself, and none
  refuses a ring of three. The guard against a row that becomes its own parent is a separate test
  on the two identifiers.

Two ancestors may stand at one distance. `min(hop)` alone would then answer twice for one entity,
so the tie is broken on the identifier and the answer repeats on every run.

### 4. The surface says THAT a position is borrowed, and WHOSE it is

A halo under the point, and the words `position from <parent label>` in the hover label, in the map
index row and in the detail panel. The point mark, the hue, the black outline and the radius ramp
do not change.

**No ring baked in metres**, because at latitude 55 a ring of 10 px at zoom 3 is 112 km, which is
41,000 px at zoom 15. **No ring recomputed on zoom**, because a position is precomputed and never
computed in the browser at each open. **No faded fill**: opacity already means *type off* in the
rail and *outside the neighbourhood* in the graph, and a fade removes ink where a halo adds it.

**No stub drawn to the parent.** The child is drawn at the parent point, so a stub is a line of
zero length, and the bearing of a zero-length line is due north for all 142.

### 5. An absent word is never a measured position

An entity that carries a point and states no word must draw and read as the cautious state. No
layer of the read path supplies a default word: not the view, not the wire schema, not the mapper,
not the projection. `41st Combined Arms Army` of the corpus that waits is that row — it holds a
geometry and `position_mode = 'none'` — and it is the reason this is written down.

## Consequences

- **`api.full_map` now answers for every entity**, and no longer for the ones that carry a
  geometry. Its row count is the entity row count. ADR 0003 §9 exempts it from the row cap and
  ADR 0008 leaves time as the only bound, so both still hold at the larger size.
- **The map read decides what is drawn, and `Entity.geom` no longer does.** The two disagree by
  design for an entity that borrows its point. A surface that filters on the geometry column is
  wrong for exactly the rows this decision is about, and the detail panel was one of them.
- **The application repeats none of the walk.** The projection reads the answer and decides
  nothing. The one walk in TypeScript is in the committed fixture, which earns it by standing in
  for the database of a story.
- **A row may still carry no position, and that is not a fault.** An entity nobody located and
  whose ancestors carry no point reaches the browser with none, and the map draws it nowhere.
- **What proves it wrong.** An analyst who cannot tell a borrowed position from a measured one on
  the canvas. The halo is the whole of that claim, and ink is the only thing it can be tuned with:
  a fade is refused, so a halo that reads too quietly gets more opacity or more radius, never less
  colour on the point.
