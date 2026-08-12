# Graph surface — build specification

**Status** Accepted as a build order · **Version** 1 · 11 August 2026
**Source** The throwaway prototype in `src/features/graph/`, on branch `prototypes/2026-08-11`,
driven and accepted by the operator on 11 August 2026. **Tickets** Reports to #35, #10, #33, #36 and #37. Settles none of them.

## Contents

1. [What this document is, and what it is not](#1-what-this-document-is-and-what-it-is-not)
2. [What the analyst does here](#2-what-the-analyst-does-here)
3. [What the prototype found](#3-what-the-prototype-found)
4. [The components](#4-the-components)
5. [The rules the rebuild keeps](#5-the-rules-the-rebuild-keeps)
6. [Scaffolding, which the rebuild leaves behind](#6-scaffolding-which-the-rebuild-leaves-behind)
7. [What stays open](#7-what-stays-open)
8. [The order to build in](#8-the-order-to-build-in)
9. [Not decided here](#9-not-decided-here)

## 1. What this document is, and what it is not

This document says **how to build the graph view, component by component**. It is written from a
prototype that the operator drove and accepted. The prototype is the reference, and it is deleted
when the rebuild lands.

**It settles no open question.** `CLAUDE.md` forbids that. Every question the prototype touched is
in §7 with its ticket. Where the prototype measured something, the measurement is in §3 as
evidence for a ticket, and never as a decision.

**It does not replace `spec.md`.** `spec.md` holds the invariants, the read path and the write
path. This document holds one view.

## 2. What the analyst does here

The graph shows the whole corpus — about 10k entities and 25k relations — because its purpose is
**macro structure, and not reading labels** (ADR 0004 §4). Five use cases, agreed before any code:

| | Use case |
|---|---|
| **UC1** | Read the macro structure. Find the clusters, the bridges and the outliers with no label read. |
| **UC2** | Select a node, dim everything more than two steps away, and read the detail beside the graph. **The camera does not move.** |
| **UC3** | Reach a relation whose endpoint is a relation (M4). The graph must not draw it. |
| **UC4** | Filter, and keep the same map. An excluded element goes faint. **No position moves.** |
| **UC5** | See a marker on each real element that carries a pending proposal. `prd.md` §4.2, P3. |

## 3. What the prototype found

Chrome on Windows, one machine, a development build. The numbers give an order of magnitude. They
are not a specification of speed.

### 3.1 The cost of a browser layout — evidence for #35

ForceAtlas 2, 120 iterations, Barnes-Hut above 1 500 nodes. The main thread is blocked for the
whole time.

| Entities / relations | Layout | Structure | Graph build |
|---|---|---|---|
| 1 000 / 2 500 | 575 ms | 4 ms | 30 ms |
| 5 000 / 12 500 | 2 156 ms | 30 ms | 49 ms |
| **10 000 / 25 000** | **4 536 ms** | 51 ms | 73 ms |
| 25 000 / 62 500 | 15 800 ms | 210 ms | 248 ms |

**The layout is the whole cost. Everything else is small beside it.**

### 3.2 The layout is not stable — evidence for #35

Two layouts of one graph, from two different starting positions, each normalised into a unit box.
*Displacement* is how far a node moves between the two runs, as a fraction of the width of the
picture. *Correlation* is of the distance between one pair of nodes across the two runs, so it is
blind to a rotation.

| Nodes | Iterations | Displacement | Correlation |
|---|---|---|---|
| 1 000 | 120 | 0.54 | 0.35 |
| 1 000 | 600 | 0.49 | 0.40 |
| 1 000 | 2 000 | 0.49 | 0.39 |
| 10 000 | 120 | 0.49 | 0.18 |

**Convergence does not repair it.** At 2 000 iterations the cost is 11 times higher and the
picture is as different as before. Neither the coordinates nor the distances between nodes survive
a second run.

This confirms ADR 0004 §4 with a number: a position must be **precomputed and stored**. A stored
position carries the identity of the layout run that made it, because a position has a meaning
only beside the other positions of the same run. Dim-only filtering (§5.2) proves that one set of
positions serves every filter, so a position is **not** held per filter. **What holds the
positions is #35, and this document does not answer it.**

### 3.3 A marker cannot always be drawn — evidence for #10

The fixture carries three pending proposals. **One can be drawn.** `update_attrs` names an entity
that exists, so a marker has an element to sit on. `create_relation` and `create_entity` name
nothing that exists, so no element can carry them.

A marker drawn as an element of the page, and positioned over the node on each frame, does not
scale. The prototype capped it at 250 and stated the remainder on screen.

### 3.4 A cut point is not a bridge — a finding with no ticket

At 10 000 entities and 25 000 relations the graph holds **675 cut points**. Most of them detach one
leaf. To paint all of them fills the picture with one colour, and it reads as noise.

Rank them by the size of the smaller piece they separate, and keep those above a floor that scales
with the graph. That leaves **50**, and each one is a bridge that an analyst wants to be shown.
**Degree is the wrong measure.** A node of degree two that holds two halves apart is worth more
than a hub that severs one leaf.

## 4. The components

Seven. Each one names what it does, the rules it holds, and how to know that it works.

### 4.1 `structure` — the macro reads

**Does.** Takes a topology. Returns the communities, the cut points, the **bridges** ranked by what
they sever, the isolates, and the largest degree.

**Interface.** It names four reads and nothing else, so it never depends on the attribute shape of
the graph, and it never fights the generic parameters of graphology.

```ts
interface Topology {
  forEachNode(cb: (node: string) => void): void;
  forEachNeighbor(node: string, cb: (neighbour: string) => void): void;
  neighbors(node: string): string[];
  degree(node: string): number;
}
```

**Carries its own stack.** A depth-first walk of ten thousand nodes overflows the stack of the
language, so the search holds its own.

**Runs deterministically.** Label propagation walks the nodes in insertion order, and it breaks a tie
on the lowest label. The same graph then gives the same communities on every open. That
determinism is the contrast with the force layout, and the rebuild keeps it.

**Works when.** The same corpus gives the same communities twice. The count of bridges is far
below the count of cut points.

**Note.** 51 ms at ten thousand nodes. It is cheap enough to stay in the browser, even after the
positions are stored. It needs no table.

### 4.2 `model` — the graph, and what is attached to it

**Does.** Builds a typed graphology `MultiDirectedGraph` from the read. Attaches the paint: colour
by community, one colour for a bridge, one for an isolate, size by degree. Indexes the relations
by endpoint, the M4 relations by **every** endpoint they name, and the pending proposals by their
target.

**Declares the node shape and the edge shape.** The graphology default is an index
signature of `any`, and a read from it produces an unsafe assignment that nobody may suppress
(ADR 0004 §8).

**Holds an M4 relation in the by-endpoint index alone.** It has no node at one end, so that index
is its only home. ADR 0004 §4.

**Gives every colour as `#rrggbb` or `rgb()`.** Sigma parses those two on the CPU. An `hsl()`
colour comes out **black, for the whole graph, in silence**.

**Works when.** The M4 relation of the fixture is absent from the edges and present in the index.
The picture is not black.

### 4.3 `controller` — the imperative adapter

**Does.** Owns the Sigma instance, the selection, the filter, the camera, the marker layer and the
workspace. Publishes a read-only view to each subscriber.

**Lives wholly outside React.** ADR 0004 §3 keeps every value and every render out of this file.

**Interface.** The view carries the selection, the filter and the counts. **It carries no detail**,
because `features/detail` owns the detail surface.

```ts
interface GraphView {
  readonly selection: { kind: 'entity' | 'relation'; id: string } | null;
  readonly filter: FilterState;
  readonly lit: number;
  readonly dimmed: number;
  readonly markersDrawn: number;
  readonly markersOverCap: number;
}
```

**Works when.** Every rule of §5 holds.

### 4.4 `rail` — the layer control, on the left

**Does.** The **two-step rail**, which is the same control as the map's. The type rows first, one
type unfolded at a time, and a field that appears only for the type that is open. A row of the
list selects an entity and moves the camera to it.

**This is one control, and not two.** The map found that the layer panel and the type filter are
the same control, and it reported that to **#36**. A second design of it is the fault that the
finding names. `features/map/prototype-bar.ts` holds the reference.

**The third copy is a shared component.** Two throwaway prototypes may hold one shape twice. When the
second surface is built, **lift the rail into `shared/`**, because a feature never imports a
feature (ADR 0001 §1).

**Three differences from the map, and each one has a reason.**

- *No colour beside a type.* On the map the hue is the encoding. Here the hue is the community, so
  a type colour states an encoding that this canvas does not use. The count carries the weight.
- *The list of entities is capped, and the remainder is on screen.* The map holds tens of rows.
  This holds thousands.
- *The list is in the order of the degree.* The useful head of a list on a graph is the hubs. A
  name is reached with the field.

**Works when.** A type switches off, and the count beside it says so. An entity is reached by name
in two steps.

### 4.5 `legend` — the definitions, bottom right

**Does.** States what the paint means, and how much of the picture is out of consideration.

**The definitions fold away. The counts never do.** An encoding is learned once and is noise after
that, so it is on demand. A count is live, and an analyst who cannot see how much is dimmed cannot
trust what is lit.

### 4.6 `bridge` — how the graph speaks to its neighbour

**Does.** Announces the selection on an event of the window.

**Why an event, and not a property.** A property from the route is a new function on every render
of the route, and that defeats the memoisation which keeps the canvas from a re-render. ADR 0004
§3 refuses that render. `features/map` set this pattern first, with `gab:map-selection`.

**Interface.** The listener helper holds the one type assertion, so that no route file reads an
untyped value.

### 4.7 The route — the composition

**Does.** Holds the address, and puts the detail sidebar beside the canvas.

**Why here.** ADR 0001 §1 refuses a feature that imports a feature. `routes/entity.$id.tsx` says
the same from the other side. The route holds the selection in React state; the canvas is
memoised, so a change of the selection never reaches it.

**Two cases the detail surface cannot take, and both are reports.** A relation, because that
surface draws one entity. An entity that the read does not carry. State the case on screen at the
same width, so that the canvas never changes size.

## 5. The rules the rebuild keeps

Each rule below was a defect in the prototype. Each one is invisible in a review.

### 5.1 Selection

- **The camera never moves for a selection made on the canvas.** UC2. A control may move it — a row
  of the rail, or the command that resets it. A click on a node may not.
- **A dimmed element takes no selection.** A filter puts an element out of consideration, and out
  of consideration is out of reach.
- **A filter that excludes the selection drops the selection.** If it does not, the marker, the
  focus and the detail all continue to work on an element that the analyst has just excluded. The
  map settled this rule first.
- **A ring is drawn only around a lit element.** Test what is lit, and never what exists.

### 5.2 Filtering

- **A filter dims. It never hides, and it never moves a position.** UC4. This is what makes a
  stored position independent of the filter (§3.2).
- **The filter holds the types that are switched off, and never the types that are on.** The type
  list is a projection of the data (ADR 0005 §6), so the corpus gains a type whenever a document
  does. A stored list of the types that are on arrives at that new type already excluded, dims it
  on every open, and says nothing. `features/map` stores the excluded set for the same reason.
- **A control that can exclude everything carries the way back.** The prototype reached an
  all-grey screen that survived a reload.

### 5.3 Sigma

- **A reducer replaces the datum. It does not merge into it.** Spread the original, or the position
  is lost and Sigma refuses the node.
- **`getNodeDisplayData` answers in the framed coordinate system.** Pair it with
  `framedGraphToViewport`, and never with `graphToViewport`. The wrong pair puts every overlay near
  the middle of the canvas, and it looks correct for each node that is near the origin of the
  graph.
- **The first render occurs inside the constructor.** A listener on `afterRender` is added after
  it, so that listener never hears the first frame. Refresh once, after the listener exists.
- **The mount is idempotent, and the cleanup is complete.** React invokes an effect twice in
  development. ADR 0004 §3 names this failure.

### 5.4 The workspace

- The camera, the filter and the open state of each panel are the workspace, in `localStorage`,
  under ADR 0004 §7.
- **A prototype never occupies the key of the real feature.** Use a prototype namespace until the
  shape is the real one.
- **A stored value is read behind a guard**, and every fault returns the fallback.

### 5.5 The theme

`src/theme.css` rules 5 to 7 bind: the radius is 0, a hairline of one pixel separates two
surfaces, and there is no gradient, no blur, no glass and no glow. **These rules reach the screen
through that stylesheet, so the rebuild imports it before it uses a token.**

A panel that floats over the canvas takes no pointer event on its own padding. A drag that starts
there must still move the graph below it.

## 6. Scaffolding, which the rebuild leaves behind

| Scaffolding | Why it existed |
|---|---|
| The inflater that grows the fixture to 10k/25k | The fixture holds 27 entities. §3 cannot be measured on 27 entities. |
| `?n=`, and the bar that carries it | It selects the size for the measurement of §3.1. |
| The cache of the layout, held in a module | It is a stored position, kept in memory. The real one is stored, and it survives a reload. |
| The detail panel that the graph drew for itself | `features/detail` owns that surface now. |

## 7. What stays open

| Question | Ticket | What the prototype adds |
|---|---|---|
| Where a layout position is held, and what it carries | **#35** | §3.1 and §3.2 — the cost, and the proof that a second run gives another picture. |
| How a pending proposal appears | **#10** | §3.3 — one of three can be drawn, and an overlay marker has a ceiling. |
| Where the view state lives | **#33** | The address holds the selection, and the router cannot write it: a write through the router re-renders the route, which destroys the canvas and restarts the layout. The prototype wrote it with `history.replaceState`, and bypassed the router. **That is a report, and not a proposal.** |
| The layer panel, and what "edit" means in it | **#36** | The rail is one control across the map and the graph. The graph reports to #36 from now on. |
| The read that returns the whole graph | **#37** | The client needs a degree and a position for every node. Whether the read carries them, or the browser counts them, is open. |
| The shape of a shared `Filter` | ADR 0004, Consequences | The second call site now exists. The map and the graph disagree today about the polarity of the type filter. §5.2 says which one is correct; the seam is not written here. |
| What the pending set contains | **#42** | The word on the control changes with the answer. |

## 8. The order to build in

Each step is done when its check passes. No step needs the step after it.

1. **`structure`.** Pure. It takes a topology, and it returns the macro reads.
   *Check:* the same corpus twice gives the same communities; the count of bridges is far below the
   count of cut points.
2. **`model`.** The typed graph, the paint, and the three indexes.
   *Check:* the M4 relation is absent from the edges and present in the index; no colour is black.
3. **`controller`.** Sigma, the selection, the filter, the workspace.
   *Check:* every rule of §5.1 to §5.4.
4. **The route, and the seam.** The event, the state held by the route, and the detail sidebar
   beside the canvas.
   *Check:* a change of the selection does not re-render the canvas.
5. **`rail`.** Lift the map's rail into `shared/`, and use it from both surfaces.
   *Check:* one design, two surfaces, and the polarity of §5.2.
6. **`legend`.**
   *Check:* the counts stay visible when the definitions are folded away.
7. **The marker of UC5.** A node program, and not an element of the page, when the count of pending
   proposals passes the cap of §3.3.
   *Check:* the count that cannot be drawn is stated on screen.

## 9. Not decided here

- **Where the layout runs.** §3 proves that it does not run in the browser at each open. Where it
  runs, and when, is #35.
- **Search across the corpus.** `prd.md` W9 makes search its own capability. The rail searches
  inside one type, which is a control on a filter, and not that capability.
- **A ranked list of the bridges, on the screen.** §3.4 says that the picture cannot separate a
  bridge that severs four thousand entities from one that severs twenty-six. The prototype
  computed the rank and did not draw it. Whether the surface shows that list is open.
