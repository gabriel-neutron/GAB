# ADR 0004 — Frontend stack

**Status** Accepted · 12 August 2026
**Replaces** an earlier entry of `decisions.md` that deferred the frontend framework. Its consequence stays:
we use shadcn, whatever the framework.

## Decision

**React, Vite and TanStack Router.** The two heaviest surfaces are the map (MapLibre) and the graph
(Sigma). Each library takes one element, controls all that is below it, and runs its own loop. The
framework only renders that element, mounts the library once and disposes it at unmount. Thus the
framework choice does not change these two surfaces. React wins because no other candidate is
better: shadcn is native to React, and React has the largest corpus. That is important, because a
different agent writes each feature.

**No binding wraps an imperative library.** We use `maplibre-gl` and `sigma` directly. We refuse
`react-map-gl` and `@react-sigma/core`. A wrapper adds a second lifecycle over a library that
already has one, and a wrapper is often behind the library that it wraps.

**Inside the map and graph features, there is no React state and no React re-render.** Use one ref
and one imperative adapter. Keep all other values outside React. A review does not easily see the
failures that this rule prevents: a wrong effect dependency destroys the instance, a camera value in
state re-renders the tree around a live canvas, and a mount that is not idempotent makes two maps
in development.

**Sigma and graphology draw the graph.** The graph shows the full corpus, because its purpose is
the large structure, not the labels. A canvas renderer cannot draw that many items. A job computes
the positions and the database stores them. The browser does not compute them at each open, because
a force layout is not deterministic and the picture would change each time. The operator starts
the job, and no schedule runs it.

A relation can point to another relation (`decisions.md` M4). The graph does not show such a
relation. The detail panel shows it.

**Features load as separate bundles.** The map library does not load when the graph is open. A lint
rule proves that no feature imports another feature. A check on the build output proves that no
feature loads another feature. ADR 0001 holds the folder layout.

**Pages, not a panel shell.** Each route fills the screen with one view. A dockable panel shell is
a feature, not a layout choice. It needs a layout engine and a stored workspace.

**View state has two stores, and a value is in only one of them.** The URL holds the identity of
what the user examines: the route and the object. Browser local storage, one key for each feature,
holds the workspace: the camera, the visible layers, the last filter and the sort order. There is
no permalink requirement. The operator removed it, and with it a URL codec for nested state.

**No suppressions.** A generated file can be excluded from the linter and the formatter by its
name only, never by a pattern that written code can enter. The vendored user interface kit gets no
exemption: it obeys each rule.

**The type check skips the type definitions of dependencies.** An error in a dependency's types is
not ours to fix or to suppress. All other strict flags stay on.

## Cost

- The read client cannot exist before the generated read types exist. With strict lint rules and
  no suppressions, an untyped fetch wrapper does not compile.
- A shared type waits for a second user. A type made before the query and the view exist is a
  guess.
- We do not move to a TypeScript version before `typescript-eslint` supports it. Without the
  linter, the full quality gate is lost.
- The route tree is generated before the type check. Without that step, an old route tree would
  pass the check and fail the build.
- The rule against React state in the map and the graph makes those features less familiar to a
  React author.
