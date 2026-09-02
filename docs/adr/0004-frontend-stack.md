# ADR 0004 — Frontend stack

**Status** Accepted · 12 August 2026
**Replaces** **T7** in `docs/decisions.md`, which deferred the frontend framework. Its consequence
— shadcn is adopted whatever the host framework — is kept.

### 1. React 19, Vite 8, TanStack Router

**The finding that made the framework matter less than expected.** MapLibre and Sigma each take one
element, own everything below it, and run their own loop. The framework renders one element, runs
one effect at mount, and disposes at unmount. That is ten lines in any candidate, so the choice
does not reach the two heaviest surfaces at all.

**React wins by the absence of a better answer, not by merit.** shadcn is native to it, and the
corpus is the largest, which counts because a separate agent writes each feature.

### 2. No binding wraps an imperative library

`maplibre-gl` and `sigma` are driven directly. **`react-map-gl` and `@react-sigma/core` are
refused.** A wrapper is a second lifecycle model over a library that already has one, and both lag
the library they wrap.

### 3. Inside `map/` and `graph/`, no React state and no React re-render

One `ref`, one imperative adapter, and every other value outside React.

This rule is the price of §1, and it is stated because the failures it prevents are invisible in
review. An effect dependency in the wrong array destroys the instance and restarts the layout. A
camera value in component state re-renders a tree that wraps a live canvas. React double-invokes
effects in development, so a non-idempotent mount creates two maps.

### 4. Sigma.js and graphology draw the graph

The graph view shows the whole corpus — about 10k entities and 25k relations — because its purpose
is macro structure and not reading labels. That count rules out a canvas renderer.

Positions are **precomputed and stored**, never computed in the browser at each open: a force
layout is not deterministic, so the picture would change on every open. **Where they are stored is
open, and the tracker carries it.**

A relation may point at another relation (M4). **No code prevents it and no code supports it.**
Such a relation is invisible in the graph and is reached through the detail panel.

### 5. Features, and the seam between them

**ADR 0001 §1 holds the layout and the seam, and this section restates none of it.** A feature is
one surface of the user interface, and a separate agent builds each one in isolation. ADR 0003 §8
gives the generated read types, which every feature may import.

Features load as separate bundles, so MapLibre never loads when the graph is open. A lint rule
proves that nobody wrote a cross-import; only an assertion on the emitted chunks proves that
nothing loaded.

### 6. Pages, not a panel shell

`/map`, `/graph`, `/review`, `/entity/:id`. One view fills the screen. A dockable panel shell is a
feature and not a layout choice, and it costs a layout engine and a persisted workspace.

### 7. View state: identity in the URL, workspace in `localStorage`

**A value lives in exactly one of the two, never in both.**

| Store | Holds |
|---|---|
| URL | The identity of what is examined: the route, and the identifier of the object |
| `localStorage`, one key per feature, `gab.<feature>.v1` | The workspace: camera, layer visibility, the last filter, sort order |

**There is no permalink requirement.** The operator withdrew it, which removed a URL codec for
nested state, a length cap on the selection, and the browser rate limit on `history.replaceState`.

### 8. Vitest, and zero suppressions with one exemption by name

`routeTree.gen.ts` is generated, carries its own lint banner, and is excluded from the linter and
the formatter **by name**. **It is the only exemption.**

**`src/shared/ui/` takes none.** A path-scoped override for that folder was removed: the vendored
components pass every rule without it, no lint rule reads `exactOptionalPropertyTypes`, and the
override was a hole — an adversarial pass wrote a hand-authored file there with `any` and
`pnpm check` passed.

One rule holds both cases: **a suppression may be excluded by name, never by a pattern that
authored code can enter.**

### 9. `skipLibCheck` becomes `true`

An error in a dependency's type definitions is neither ours to fix nor ours to suppress. Every
other strict flag stays.

## Consequences

- **The read client cannot be written before the contract types exist.** With `strictTypeChecked`
  and zero suppressions, an untyped `fetch` wrapper cannot compile, so it waits for the first
  migration.
- **A shared type waits for a second call site.** Shaped before a query, a view and a schema exist,
  it is a guess.
- **TypeScript 7 is refused** until `typescript-eslint` supports it. With a zero-suppression rule,
  losing the linter loses the whole quality gate.
- **`tsr generate` runs before `typecheck`.** Without it a stale route tree would pass `check` and
  fail `build`.
