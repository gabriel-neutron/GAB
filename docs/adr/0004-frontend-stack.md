# ADR 0004 — Frontend stack

**Status** Accepted · **Version** 2 · 12 August 2026
**Tickets** #5 (closed by this ADR), #6 (closed by ADR 0003 v2), #39 (closed, and it corrects §8)

**Version 2 corrects §8, and changes nothing else.** Version 1 gave `src/shared/ui/**` a
path-scoped override. #39 removed that override from `eslint.config.ts` and did not update this
document. Every reader since has found the two in disagreement, and has argued the case again in
a comment or a report. §8 below now states what the repository does.

`docs/README.md` says to supersede an ADR that has produced code, and not to rewrite it. That
rule is for a **new** decision. No decision is made here: #39 took this one and implemented it,
and version 1 is simply out of date. A superseding ADR would record a change that already
happened, and would leave the wrong text in place for the next reader.
**Replaces** **T7** in `docs/decisions.md`, which deferred the frontend framework. T7 is
answered, not contradicted: it postponed the choice until the real volumes, the cartographic
library and the graph rendering mode were known. All three are now known. Its consequence —
shadcn is adopted whatever the host framework — is kept.

## Context

`spec.md` §6 recorded the frontend framework as deferred. #5 was blocked by #4, which is
closed by ADR 0005.

Three constraints already decided narrow this to almost nothing:

- **T4** makes the frontend read the database on its own, and reserves the backend for
  writes. The client is a read client. Server rendering therefore buys nothing.
- **T1** puts both sides in TypeScript.
- **C5** and `prd.md` §2 give one operator and no authentication.

The operator added two requirements during the grilling of 10 August 2026: each feature is
built largely by a separate agent working in isolation, and the features must be separable so
that each is optimised on its own.

## Decision

### 1. React 19, Vite 8, TanStack Router

Three agents were run against the same brief — two independent analyses and one adversarial
review. The reasoning below is the synthesis, and it includes what argues against it.

**The finding that made the framework matter less than expected.** MapLibre and Sigma each
take one element, own everything below it, and run their own loop. The framework renders one
element, runs one effect at mount, and disposes at unmount. That is ten lines in any
candidate. The choice of framework therefore does not reach the two heaviest surfaces at all.

**React wins by the absence of a better answer, not by merit.** shadcn is native to it, and
the corpus is the largest, which counts because a separate agent writes each feature. No other
candidate holds an advantage that survives the finding above — Svelte's best argument was a
better MapLibre binding, and no binding is used.

The case is thinner than it looks. Both analyses chose React largely because TanStack Router
gives typed search parameters. The operator then withdrew the permalink requirement, which
removed that argument. What remains is shadcn and the corpus.

### 2. No binding wraps an imperative library

`maplibre-gl` and `sigma` are driven directly. **`react-map-gl` and `@react-sigma/core` are
refused.** A wrapper is a second lifecycle model over a library that already has one, and the
lag is measurable: `@react-sigma/core` pins Sigma 3, and `react-map-gl` targets a MapLibre
version behind the current one.

### 3. Inside `map/` and `graph/`, no React state and no React re-render

One `ref`, one imperative adapter, and every other value outside React.

This rule is the price of §1, and it is stated because the failures it prevents are invisible
in review. An effect dependency in the wrong array destroys the Sigma instance and restarts
the layout. A camera value in component state re-renders a tree that wraps a live canvas.
React double-invokes effects in development, so a non-idempotent mount creates two maps.

### 4. Sigma.js and graphology draw the graph

The graph view shows the whole corpus — about 10k entities and 25k relations — because its
purpose is macro structure and not reading labels. That count rules out a canvas renderer.

Positions are **precomputed and stored**, not computed in the browser at each open. A force
layout is not deterministic, so the picture would change on every open. **Where the positions
are stored is open, and the tracker carries it.**

A relation may point at another relation (M4). **No code prevents it and no code supports
it.** Such a relation is invisible in the graph and is reached through the detail panel.

### 5. Features, and the seam between them

| Folder | Holds | Imports |
|---|---|---|
| `src/features/<feature>/` | One feature: `map`, `graph`, `review`, `detail` | `shared/`, `contract/`, itself |
| `src/shared/` | The seam, and the user interface kit | `contract/` only |
| `src/routes/` | The route files | Any feature, `shared/`, `contract/` |
| `src/contract/` | Generated read types — ADR 0003 §8 | Nothing |

**A feature never imports another feature.** The seam carries three things and nothing else:
the current selection, the active filter, and the read client. A lint rule holds this, with
deny by default, so a new folder fails loudly.

`src/shared/` is a leaf. A component kit is not a feature, so an import of it is never a
breach — that sentence exists because a plain reading of the rule would flag every shadcn
import.

Features load as separate bundles, so MapLibre never loads when the graph is open. A lint rule
proves that nobody wrote a cross-import. Only an assertion on the emitted chunks proves that
nothing loaded, and that assertion is written when the first heavy dependency exists.

### 6. Pages, not a panel shell

`/map`, `/graph`, `/review`, `/entity/:id`. One view fills the screen.

A dockable panel shell is a feature, not a layout choice. It costs a layout engine and a
persisted workspace, and `prd.md` §3 states that if W5–W6 review is painful the system
produces nothing. The seam in §5 is what makes the later change cheap.

### 7. View state: identity in the URL, workspace in `localStorage`

**A value lives in exactly one of the two, never in both.**

| Store | Holds |
|---|---|
| URL | The identity of what is examined: the route, and the identifier of the object |
| `localStorage`, one key per feature, `gab.<feature>.v1` | The workspace: camera, layer visibility and order, the last filter, sort order |

**There is no permalink requirement.** The operator withdrew it: it suits some software and
not a data-heavy analysis tool. That withdrawal removed three real faults — a URL codec for
nested state, a length cap on the selection, and the browser rate limit on
`history.replaceState`, which disables the call for a period after about 100 calls in 30
seconds and does so even when the error is caught.

**The proposal, and what a reviewer should attack, are open. The tracker carries them.**

### 8. Vitest, and zero suppressions with one exemption by name

The runner is Vitest — ADR 0001 §4, which closed #24.

`routeTree.gen.ts` is generated and carries its own lint banner. It is excluded from the
linter and the formatter **by name**, and it is committed. **It is the only exemption.**

**`src/shared/ui/` takes none.** Version 1 gave the folder a path-scoped override, on the
premise that vendored shadcn source cannot pass `strictTypeChecked` and
`exactOptionalPropertyTypes` clean, because Radix spreads optional properties freely. #39
removed the override. Two facts disproved the premise, both reproduced on 10 August 2026:

- **The override exempted nothing.** The four vendored components — button, input, select and
  badge — pass every rule with it removed.
- **No lint rule reads `exactOptionalPropertyTypes`.** It is a TypeScript flag. A file that
  fails it fails `tsc`, which an ESLint override cannot reach. `tsconfig.app.json` compiles the
  folder with every strict flag on, and it passes.

It was also a hole. An adversarial pass wrote a hand-authored file in that folder with `any`
and unchecked member access, and `pnpm check` passed.

One rule holds both exemptions: **a suppression may be excluded by name, never by a pattern
that authored code can enter.** `src/shared/ui/**` is such a pattern, and the folder now holds
hand-written components beside the vendored ones.

The day a vendored file genuinely fails, the operator adds that **one file name** to
`eslint.config.ts`. An author who is blocked until then is the intended gate, and not a defect.

### 9. `skipLibCheck` becomes `true`

The repository checked every type definition of every dependency under `strictTypeChecked`,
with no suppression permitted. Such an error is neither ours to fix nor ours to suppress.
Every other strict flag stays.

## Consequences

- **The read client cannot be written yet.** With `strictTypeChecked` and zero suppressions, an
  untyped `fetch` wrapper cannot compile: `no-unsafe-assignment` and its family fire on
  `unknown`, and nothing may suppress them. ADR 0003 §8 names the generator, so the read
  client now waits only for the first migration. `src/contract/` stays absent until a table
  exists to generate from.
- **A shared `Filter` type is not written yet.** No query, no view and no schema exist, so its
  shape would be a guess. The first feature writes its query inline. The second call site is
  the earliest honest place to lift a shared type.
- **Selection needs no shared module.** It is a route parameter under §7.
- **TypeScript 7 is refused** until `typescript-eslint` supports it. TS 7 shipped with the Go
  compiler in July 2026, and typescript-eslint closed TS 7 support as *not planned* until a
  stable programmatic API arrives. With a zero-suppression rule, losing the linter loses the
  whole quality gate.
- **`tsr generate` runs before `typecheck`.** The route tree is generated by Vite, and
  `pnpm check` does not run Vite, so a stale tree would pass `check` and fail `build`. Without
  this step, the definition of done in ADR 0001 §5 quietly stops meaning that the application
  builds.
- One package still, per ADR 0001 §6. A browser target and a Node target in one repository is
  the first real signal for §6, and it is met with a TypeScript configuration and not with a
  workspace.

## Not decided here

- **The layout and the navigation.** Deferred by the operator to a layout prototype. The
  backbone renders routes with no navigation, so a route is reached by typing its address.
- **The theme.** A basic theme and the switch from the shadcn documentation are installed. The
  design is a later discussion.
- **Where the chat surface lives.** `spec.md` §1 and `prd.md` §4.3 name it, and no feature
  holds it. Deferred with the AI work.
- **What "edit" means in the layer panel.**
- **The test policy.** ADR 0001 §4 chose a runner, not a policy.
