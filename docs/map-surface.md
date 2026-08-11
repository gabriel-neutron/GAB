# Map surface — build specification

**Status** Accepted as a build order · **Version** 1 · 11 August 2026
**Source** The throwaway prototype in `src/features/map/`, on branch `prototypes/2026-08-11`,
driven and accepted by the operator on 11 August 2026. **Tickets** Reports to #36, #33, #12 and #15.
Settles none of them.

## Contents

1. [What this document is, and what it is not](#1-what-this-document-is-and-what-it-is-not)
2. [What the analyst does here](#2-what-the-analyst-does-here)
3. [What the prototype found](#3-what-the-prototype-found)
4. [The components](#4-the-components)
5. [The rules the rebuild must not lose](#5-the-rules-the-rebuild-must-not-lose)
6. [What is scaffolding, and must not be rebuilt](#6-what-is-scaffolding-and-must-not-be-rebuilt)
7. [What this document must not settle](#7-what-this-document-must-not-settle)
8. [The order to build in](#8-the-order-to-build-in)
9. [Not decided here](#9-not-decided-here)

## 1. What this document is, and what it is not

This document says **how to build the map view, component by component**. It is written from a
prototype that the operator drove and accepted. The prototype is the reference, and it is deleted
when the rebuild lands.

**The reference is not in `main`.** It is on branch `prototype/map-2026-08-11`. It runs with
`pnpm dev`, then `/map`. `docs/graph-surface.md` §4.4 points at `features/map/prototype-bar.ts`
for the rail; that file is on this branch, and no longer in `main`.

**It settles no open question.** `CLAUDE.md` forbids that. Every question the prototype touched is
in §7 with its ticket. Where the prototype found something, the finding is in §3 as evidence for a
ticket, and never as a decision.

**It does not replace `spec.md`.** `spec.md` holds the invariants, the read path and the write
path. This document holds one view.

## 2. What the analyst does here

The analyst is **locating**: finding one entity, and seeing where it is. That was the first answer
the operator gave, and every decision below follows from it. The map is not first a surface for
comparing two entities, and it is not a coverage report.

Eight use cases, each agreed before the code that serves it.

| | Use case | Agreed |
|---|---|---|
| **UC1** | Find one named entity, and have the camera go to it. | Round 1 |
| **UC2** | Show and hide entity types, so that the types not in use do not hide the one in use. | Round 1 |
| **UC3** | Read a point's label and type under the cursor, and tell two near points apart before committing to one. | Round 1 |
| **UC4** | Select a point, and read its evidence beside the map without leaving the map. | Rounds 1 and 2 |
| **UC5** | Have the address name the selected entity, so that a reload lands on it again. | Round 2 |
| **UC6** | Find the rail and the camera as they were left. | Round 2 |
| **UC7** | See every relation of the selected entity, and open one to read it. | Round 4 |
| **UC8** | Tell two rows of the index apart by a value, and not only by a name. | Round 3 |

**UC4 is served by another feature.** `features/detail` owns the detail surface, and the route
puts it beside the map. `features/map` builds no detail panel of its own.

## 3. What the prototype found

### 3.1 The layer panel has nothing left to edit — evidence for #36

#36 asks what "edit" means in the layer panel, and offers two readings: **A**, edit the layer —
rename, reorder, opacity, colour, filter; **B**, edit the features on it.

The operator removed both before any code. Presentation settings are out. Every edit of an entity
or a relation lives in the sidebar.

**What remains is four items**, out of the twelve the QGIS review proposed:

| Kept | Why |
|---|---|
| An entry generated per entity type | ADR 0005 §6. The machine projects the type list. |
| A colour swatch per entry | It is the legend. A coloured point means nothing without it. |
| A count per entry | It says what the corpus holds where the map draws nothing. |
| Visibility | The only act left. |

**Four items are not a panel. They are a legend with a switch — and that is the same control as
the type filter the operator asked for.** Two controls collapse into one. Five different bars were
built and every one of them collapsed the same way. **So the question "what does edit mean in the
layer panel" may have no answer left, because there may be no panel.**

The prototype writes nothing at all: not `layers`, not `entities`. Question 2 of #36 — whether
query layers are read-only on the map — is answered by construction: no design could reach a
geometry.

Raster and vector do **not** interleave. One raster layer sits under every point layer and no
control moves it. Nothing wanted anything else. That is evidence for "imagery under my points",
and it is one prototype, not a proof.

### 3.2 A type-wide key works only where the type shares a key — evidence for #12

UC8 needs one value beside the name. Which value is a rule, and a hand-kept table of "the key that
matters for a vessel" is what ADR 0005 §6 forbids the operator to maintain. The prototype asked
the machine instead: **the key that the most entities of a type carry, ties to the alphabet.**

Measured on the sample:

| Type | Key chosen | Entities that carry it |
|---|---|---|
| `vessel` | `imo` | 8 of 8 |
| `company` | `registration_number` | 3 of 3 |
| `person` | `role_title` | 2 of 2 |
| `facility` | `throughput_kt_month` | **2 of 11** |

**Three types of four share a key. One does not.** `facility` is a bag of unrelated measurements —
a coal stock, a berth count, a mole length, a number of conveyor lines — so the column is empty on
nine rows of eleven.

**The layout is the smaller half of the question.** The larger half is whether an entity type is
expected to share keys at all. That is the attribute vocabulary, and **#12 owns it**. This
document does not answer it, and the rebuild must not answer it in code.

### 3.3 What the sample can show, and what it cannot

The fixture was grown twice, by operator decision, because the questions could not be asked of the
original five rows.

| | Count | Note |
|---|---|---|
| Entities | 27 | 24 carry a geometry. **The map draws only those.** |
| Entity types with a geometry | 4 | `company`, `facility`, `person`, `vessel` |
| Relations | 17 | **13 can be drawn.** |
| Relations that cannot be drawn | 4 | An endpoint is a relation (M4), or an endpoint carries no geometry. |
| Documents | 5 | One is unrated, and one is `manual`. |

**The count that cannot be drawn is on the screen, in words.** A map that drops evidence in
silence is worse than one that says how much it dropped. M4 lets a relation point at a relation,
and such a relation has no second point; ADR 0004 §4 says the same of the graph.

**A defect was made in the first fixture change and repaired in the second.** The 22 added
entities took `promotedFrom` values that the four original relations already used. #15 makes one
row name one proposal, so two rows naming one proposal is a fault. The added entities now hold
their own block. Every `promotedFrom` and every row identifier in the fixture is unique, and every
cited document is declared.

### 3.4 The selection is identity, and the address costs a `memo` — evidence for #33

#33 asks where view state lives, and names the map camera as the case most likely to be argued.
**The camera gave no trouble.** It is workspace, it was never wanted in the address, and reopening
`/map` at the last camera is right.

**The selection broke the seam instead.** By the test in #33 — would this string mean the same
thing to another person, or to you tomorrow? — a selected entity is identity. But ADR 0004 §7 says
selection needs no shared module because it is a route parameter, and that sentence is true for
`/entity/:id` and false for `/map`, where the selection is not the route.

The operator chose `/map?entity=<uuid>`. It works: a reload lands on the same entity, with the
sidebar filled and the point ringed. Nothing is encoded, so none of the three faults that killed
the permalink requirement returns.

**The price, which nobody costed.** Putting the selection in the address makes it React state, so
the route re-renders on every click on a point. `/map` holds a live WebGL canvas, and ADR 0004 §3
refuses a re-render around it. The map component is therefore wrapped in `memo`, and it takes one
prop that never changes on a selection. **That `memo` is not an optimisation; it is what keeps ADR
0004 §3 and §7 from contradicting each other.** Every feature that puts identity in the address
and owns a canvas will meet this.

**One case #33 does not mention.** Switching a type off drops the selection, because a selected
point that is not drawn is a lie on the screen. That is workspace reaching into identity. The rule
"a value lives in exactly one of the two stores" does not forbid it and does not name it.

### 3.5 A dependency fault that is silent — a finding with no ticket

`maplibre-gl` 6.2.0 under the Vite development server, with the package pre-bundled by esbuild:
**the worker never starts.** The raster basemap draws, because raster needs no worker. Every
vector layer stays empty, `isStyleLoaded()` never turns true, and **nothing is logged**. A style
with one point and a background layer reproduces it, so the fault is not ours.

`optimizeDeps: { exclude: ['maplibre-gl'] }` in `vite.config.ts` repairs it. That line is in
`main`, and the map does not work without it. It is a configuration, so it is not an ADR — but the
next reader who removes it will lose an afternoon.

## 4. The components

Eight. Each one names what it does, what it must never do, and how to know that it works.

### 4.1 `projection` — the corpus, reduced to what a map can draw

**Does.** Takes the read. Returns the entities that carry a geometry, the type list generated from
them, a colour and a count per type, the relations whose two endpoints both carry a geometry, and
the count of the relations that this leaves out.

**Holds no state.** It is computed once, from data that does not change while the view is open.

**Two identifiers, and they are not the same thing.** MapLibre wants a number for a feature
identifier, and that number is a position in an array. The identity of the row is its `id`, and
the address carries that one. Keep both lookups.

**Must not decide which types exist.** ADR 0005 §6: the list is a projection, made by the machine.
A type that no entity carries never appears, and nobody maintains a list.

**Works when.** Adding a type to the read adds a row to the rail with no other change. No entity
without a geometry appears anywhere.

### 4.2 `adapter` — one MapLibre instance, driven directly

**Does.** Owns the instance, the style, the sources, the layers, hit testing, the camera and the
disposal. Publishes a handle. Every other component drives the map through that handle, and never
touches the library.

**Must hold no React value and cause no React render.** ADR 0004 §3. **No binding.** ADR 0004 §2.

**One data source, one layer per type.** ADR 0005 §6: a panel of thirty types must not be thirty
queries. A type is hidden with `visibility`, which needs no new data. A hidden layer returns
nothing from `queryRenderedFeatures`, so a hidden type cannot be hovered or clicked, and it needs
no separate guard.

**Works when.** Every rule of §5.3 holds.

### 4.3 `basemap` — two grounds, and the darkening

**Does.** Two raster layers, one visible at a time; the control that switches them; the darkening
that follows the theme. The attribution follows whichever layer is visible.

**Both live in the style, and one is hidden.** A switch is then a layout property, and never a
rebuilt style. A rebuilt style drops every source with it, and the selection, the hidden types and
the links would all have to be applied again.

**Dark mode inverts the raster in the shader, and adds no source.** `raster-brightness-min: 1`
with `raster-brightness-max: 0` inverts the luminance of one layer, and a half turn of hue puts
the water back to blue. It reaches **the basemap layer only**, so the entity hues and the link
lines are untouched. A CSS filter cannot do this: there is one canvas. Imagery is not inverted —
it is already dark, and it only wants taking down.

**The theme is read from the class on `documentElement`**, with an observer, and never from React.

**The map view is a stand-in, and it must not ship.** See §7.

**Works when.** The credit on screen always matches the ground on screen. Dark mode changes the
ground and changes no entity colour.

### 4.4 `workspace` — one record, one key, and every writer patches

**Does.** Holds the camera, the types that are switched off, the open state of the rail, and the
basemap in use. Reads and writes through `shared/storage`, under one key, per ADR 0004 §7.

**The selection is not here.** It is identity, and it is in the address.

**Every writer patches, and never replaces.** There are four writers. Two writers with two partial
records each erase the other's field.

**The guard is strict.** A record of an older shape falls back, which costs one camera position,
once. A tolerant guard lets two shapes live under one key, and that is the fault the version in
the key exists to prevent.

**Works when.** Reopening the view finds the camera, the drawn types, the rail and the ground as
they were. A value of an older shape falls back and does not throw.

### 4.5 `rail` — the layer control and the index, on the left

**Does.** The **two-step rail**. The entity types first, one type unfolded at a time, and a field
that appears only for the type that is open. A row selects an entity and moves the camera to it.
The rail collapses to a strip that keeps the colours, the counts and the switches.

**It separates two acts that the other designs conflated.** Switching a type is a control, and it
is always at hand. Finding an entity is a search, and it is asked for. Five bars were built; this
is the one the operator chose.

**The closed state keeps the legend.** A bar that closes to nothing turns every colour on the map
into a guess. Only the list is lost.

**This is one control, and not two.** §3.1. A second design of the layer panel is the fault #36
names.

**It is already built twice.** The graph carries the same rail — `docs/graph-surface.md` §4.4 says
so. **Two throwaway prototypes may hold one shape twice; three call sites may not.** When the
second surface is rebuilt, lift the rail into `shared/`, because a feature never imports a feature
(ADR 0004 §5). The differences the graph needs are listed in its own §4.4.

**Works when.** A type switches off and the count says so. An entity is reached by name in two
steps. The closed rail still says what is drawn.

### 4.6 `row` — what one line of the index says

**Does.** One line. The name, truncating. One right-aligned monospace column, holding **the key
that the most entities of that type carry**. The group header names that key.

**The header is not decoration.** The column is blank wherever an entity does not carry the key,
and a blank is readable only when the header says what the column holds. M9: the unknown is the
absence of a key, and the row must read as an absence and not as a fault.

**The rule is machine-derived, and the rebuild keeps it that way.** ADR 0005 §6. Nobody maintains
a table of which key matters.

**Chosen over two others.** Two lines per row is never blank but has no column to read down: every
row states a different field. An inverted row with the identifier first is the strongest on
`vessel` and the weakest on `facility`, and it costs 60px of map. Both are on the branch.

**Works when.** Every row of `vessel` shows an IMO in one straight column. Every row of `facility`
that carries no throughput shows nothing there, under a header that says `throughput_kt_month`.

### 4.7 `links` — the relations, on the map

**Does.** Draws a line for each relation whose two endpoints carry a geometry, under every point.
Brightens every link of the selected entity. Opens one link for reading.

**A point wins over a line it crosses.** The point is the smaller target, and it is the one the
analyst aimed at.

**A line needs a hit box**, about 5px on each side. A one-pixel line is otherwise unclickable.

**Relations are not entity types, and they do not enter the type list.** ADR 0005 §6 makes that
list a projection of the entity types and nothing else. Links get one switch of their own.

**The count that cannot be drawn is on the screen.** §3.3.

**`features/detail` has no relation surface, and this is a report and not a design.** A relation
carries attributes, sources and an interval, exactly like an entity, and nothing in the
application shows one. The prototype drew its own small card because there was nowhere to send the
reader. **The rebuild must not copy that card without first asking who owns the surface.**

**M6 is written at both ends.** A closed interval must never read as current, so the card writes
`from` and `to`, and never only the first.

**Works when.** Selecting an entity brightens its links and lists them. Opening one names the
type, both endpoints, the interval and the source documents. The endpoints move the selection.

### 4.8 The route — the composition

**Does.** Holds the address, listens for the selection, and puts the detail sidebar beside the map.

**Why here.** ADR 0004 §5 refuses a feature that imports a feature. `routes/entity.$id.tsx` says
the same from the other side.

**No selection, no sidebar.** An empty address is the normal state of a map, so the route composes
nothing rather than asking another feature to draw an empty state. That feature's empty state
belongs to `/entity/:id`, where a bad address really is a fault.

**The canvas is memoised.** §3.4.

**Works when.** A change of the selection does not re-render the canvas. A stale identifier in the
address gives a map at full width, and no fault on screen.

## 5. The rules the rebuild must not lose

Each rule below was a defect in the prototype. Each one is invisible in a review.

### 5.1 Selection

- **A selection restored from the address is re-applied once the style is loaded.** `getSource`
  returns nothing before that, and it returns it **silently**. The prototype marked the rail row
  and filled the sidebar while the map alone showed no ring.
- **A component that subscribes after the map is built has already missed the restore.** The map
  reads the address in its own constructor. A rail that only listened opened no group on a reload.
  Seed from the current selection, then subscribe.
- **A type that is switched off drops the selection**, because a selected point that is not drawn
  is a lie on the screen. The graph settled the same rule.
- **The ring around the selection has no fill, and it follows the zoom.** A fixed disc reads as a
  grey blob at low zoom and encloses whatever stands near it, so it says "these two" when it means
  "this one".
- **The restore is one way, and once.** The map reads the address at mount and is the only writer
  afterwards. A two-way binding between a router and a live canvas is a loop.
- **`replace: true` on the navigation.** Otherwise a walk over twenty points needs twenty presses
  of the back button to leave the map. A selection is identity, but it is not history.

### 5.2 Filtering

- **The store holds the types that are switched off, and never the types that are on.** The type
  list is a projection (ADR 0005 §6), so the corpus gains a type whenever a document does. A
  stored list of the types that are on meets that new type already excluded, hides it on every
  open, and says nothing. `docs/graph-surface.md` §5.2 states the same rule.
- **The layer control and the type filter are one control.** §3.1.

### 5.3 MapLibre

- **The mount is idempotent, and the cleanup is complete.** React invokes an effect twice in
  development. A non-idempotent mount makes two maps, and the browser then drops the older WebGL
  context, which looks like a blank map and is not one.
- **A `ResizeObserver` on the container is required, and it is not an optimisation.** MapLibre
  measures the container once, in the constructor, while the chrome around it is still being
  built. The prototype measured a canvas of 1140 by 97 inside a container of 1140 by 839, and
  **nothing warned**: the map draws correctly inside a canvas of the wrong size.
- **A layout property needs a loaded style.** `setLayoutProperty` throws while the style loads, and
  a control can be clicked in that window. One queue, drained on `load`, for every caller.
- **One `click` handler, and it asks what is under the pointer itself.** Two handlers make the
  behaviour depend on the order they run in.
- **A colour must be one the library parses.** MapLibre reads the style with its own parser, so a
  CSS custom property never reaches it. The entity hues are copied as hex, and §9 carries the cost
  of that copy.

### 5.4 The workspace

- The camera, the excluded types, the rail state and the basemap are the workspace, in
  `localStorage`, under ADR 0004 §7.
- **A prototype never occupies the key of the real feature.** Use a prototype namespace until the
  shape is the real one.
- **A stored value is read behind a guard**, and every fault returns the fallback.
- **The first camera is an invented number.** It is a parameter to calibrate, like the zoom
  breakpoints of ADR 0005 §2. Nobody decided it.

### 5.5 The theme, and the licence

`src/theme.css` binds: the radius is 0, a hairline of one pixel separates two surfaces, and there
is no gradient, no blur, no glass and no glow. A shadow is only for a true overlay. Rule 11 keeps
the entity hues on the map and out of the chrome. Rule 13 makes a column of figures line up, so a
value on a row is monospace and right aligned. Rule 16 truncates a value, and never wraps it.

**The attribution is an obligation of the licence, and not a caption.** ADR 0005 §3 fixes the
wording for both grounds. Two rules follow, and both were faults first:

- **The corner is a parameter.** A bar that floats over the map covers whichever corner it stands
  in, and the floating controls of the prototype covered the credit twice.
- **The credit on screen matches the ground on screen.** MapLibre drops the attribution of a
  source that no visible layer uses. This was checked, and not assumed.

## 6. What is scaffolding, and must not be rebuilt

| Scaffolding | Why it existed |
|---|---|
| `?variant=`, and the floating bar that carries it | It switches between designs under comparison. Five bars and three rows were built; one of each survives. |
| The four bars and the two rows that lost | They are the primary source for the choice, and they are on the branch. |
| The relation card the map drew for itself | Nothing owns a relation surface yet. §4.7. |
| The window event that carries the selection | It is the cheapest seam a prototype can offer. ADR 0004 §5 names the real one, and it is not written. |
| The raster tiles of the map view | A stand-in for the archive of ADR 0005 §2. §7. |

## 7. What this document must not settle

| Question | Ticket | What the prototype adds |
|---|---|---|
| The layer panel, and what "edit" means in it | **#36** | §3.1 — remove presentation and remove feature editing, and four items remain, which are the type filter. There may be no panel. |
| Where the view state lives | **#33** | §3.4 — the camera is easy and the selection is not. The address works, and it costs a `memo` around the canvas. One case, workspace clearing identity, is not in the ticket. |
| The attribute vocabulary | **#12** | §3.2 — a type-wide key works on three types of four. Whether a type is expected to share keys is the question under the row design. |
| One row, one proposal | **#15** | §3.3 — the first fixture change broke it, and the second repaired it. |
| The shape of a shared `Filter` | ADR 0004, Consequences | The second call site exists. §5.2 states the polarity both surfaces must use. The seam is not written here. |
| **The tile path of the map view** | **none** | The map view draws raster tiles from the servers of the OpenStreetMap Foundation. **That is not ADR 0005 §2, and it must never ship.** The archive it stands in for does not exist. The wiki lists no dark style on those servers, and every dark provider it names wants a registration or a key, which is why dark mode is done in the shader. A local build with one operator is the only reason it is defensible. **No ticket holds this. One must, and it must block any deployment.** |
| A relation surface | **none** | §4.7. A relation carries attributes, sources and an interval, and nothing in the application draws one. |

## 8. The order to build in

Each step is done when its check passes. No step needs the step after it.

1. **`projection`.** Pure. It takes the read and returns what can be drawn.
   *Check:* no entity without a geometry appears; the count that cannot be drawn is right.
2. **`adapter`.** The instance, the style, hit testing, the camera, disposal.
   *Check:* every rule of §5.3; two mounts in development leave one map.
3. **`workspace`.** One record, one key, four writers.
   *Check:* every rule of §5.4; two writers never lose each other's field.
4. **`basemap`.** Two grounds, the switch, the darkening, the attribution.
   *Check:* the credit always matches the ground; dark mode changes no entity colour.
5. **The route, and the seam.** The address, the listener, the sidebar beside the map.
   *Check:* a change of the selection does not re-render the canvas; no selection, no sidebar.
6. **`rail`.** Two steps, collapsing, and keeping the legend when closed.
   *Check:* the polarity of §5.2; the closed rail still says what is drawn.
7. **`row`.** One line, the type's key, and the header that names it.
   *Check:* `vessel` reads down as one column; `facility` shows blanks under a named header.
8. **`links`.** The lines, the highlight, and the reading of one.
   *Check:* a point wins over a line; the count that cannot be drawn is on screen.

## 9. Not decided here

- **Whether MapLibre draws the blurry parent tile, or nothing, where a high-zoom tile is absent.**
  ADR 0005 names this as the one item to check at build time and not to assume. **The prototype did
  not check it.** The two grounds stop at different zooms — imagery at 14, the stand-in at 19 — so
  the check is cheap once a rebuild exists, and it decides whether the tiered seams of ADR 0005 §2
  look deliberate or broken.
- **How the entity hues reach the renderer.** They are copied from `src/theme.css` as hex, because
  that file is imported by nothing, and because a CSS token never reaches the style parser. When
  the theme lands, decide between reading the computed value and keeping the copy. A copy that
  drifts is worse than a lookup.
- **Search across the corpus.** `prd.md` W9 makes search its own capability. The rail searches
  inside one type, which is a control on a filter, and not that capability.
- **Whether a company or a person is drawn at all.** A facility is where it stands, a vessel is
  where it was last reported, a company is its registered office, and a person is a last reported
  location. The map treats the four the same, and the fixture says so in a comment. Whether that is
  honest is a question for the domain, and not for this surface.
