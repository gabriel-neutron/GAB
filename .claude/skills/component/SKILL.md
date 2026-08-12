---
name: component
description: Read before you write or edit a file under `src/features/`, `src/shared/` or `src/routes/`, before you write a story, before you touch a live canvas, and when a ticket names a component or a step of a surface. Holds the placement, depth, state, type, story and visual rules that every component of GAB shares.
---

# Build one component

A component of GAB is a **deep module**. This document holds what every component shares. The
surface document holds what this one component does.

## The steps

1. **Find the contract.** `docs/README.md` names the surface document. Read four parts of it: the
   entry for this component under "The components"; every finding under §3 that the entry cites by
   number; "The rules the rebuild must not lose"; and the *Check* of this step under "The order to
   build in", which is the acceptance test. Then read "What this document must not settle": a
   component that turns on one of those questions stops there and asks the operator. State back in
   five lines: what it does, what it must never do, the "Works when", and the *Check*.
   - **A component of a surface, with no entry of its own.** The surface is not specified to this
     depth. Stop, and ask the operator.
   - **A surface with no document.** Only the operator writes one. Stop, and ask.
   - **A file of `src/shared/`.** No surface document owns it. Its contract is the two call sites
     that need it, and the rules below. Name both callers in your report.
   - **A folder that drives a live canvas** — `src/features/map/` and `src/features/graph/` today.
     Read [`CANVAS.md`](CANVAS.md) now, before step 2.
2. **Place the file.** Use *Placement*. A new **top-level** folder under `src/` belongs to no
   element of `eslint.config.ts` and fails the lint loudly. A new folder inside an element does not
   fail, and it is still a question for the operator: ADR 0001 §1 makes a feature one flat folder.
3. **Write the derivation**, before the `.tsx` exists.
4. **Write the component.** Before you write a class, read *What a generated design writes, and
   what GAB writes*. Your default is the left column.
5. **Write the story**, one for each state the contract names. See *The story*.
6. **Run `pnpm check`, then `pnpm test`**, then answer *Before you report*.

**Which wins.** The surface document wins on **what** the component does, on its shape, and on its
"Works when". This document wins on **how** it is built: placement, depth, state, types and the
visual language. A document that contradicts an ADR, or contradicts a rule of "how", is a question
and not a licence: stop, and ask the operator.

## Placement

| Class | Path | Holds | Takes `className` |
|---|---|---|---|
| Kit | `src/shared/ui/*.tsx` | The vendored shadcn parts | Yes, and `cva` variants |
| Shared | `src/shared/*.{ts,tsx}` | A shape that two features need, and the seam | Only where two callers differ |
| Feature | `src/features/<feature>/*.{ts,tsx}` | One surface, in domain words | No |
| Route | `src/routes/*.tsx` | The composition: a feature beside a feature | No |
| Story | `<component>.stories.tsx`, beside its component | The states of one component | — |

- **A feature imports `src/shared/` only.** `src/routes/` is the one folder that composes two
  features. ADR 0004 §5, held by a lint rule.
- **A shape moves to `shared/` at its second call site, never at its first.** The rail of the map
  and the rail of the graph is the known case — see the `rail` entry of `docs/map-surface.md`,
  which says when to lift it.
- **The kit is closed by the operator, and its size is a fact of the folder.** Read
  `src/shared/ui/` for what is vendored, and build the control from what is there: the mode toggle
  in `src/shared/` is built on `select` and not on `dropdown-menu` for that reason. Ask the
  operator before you add one, and install no dependency yourself.
- **A vendored file takes no exemption from the lint set.** `eslint.config.ts` holds the reason and
  the one gate: a file that genuinely fails is excluded **by name**, by the operator. A path is
  never excluded, because authored code can enter a path.
- **The file name is the name the contract gives the component, in kebab case, with no feature
  prefix** — `field.tsx`, `row.tsx`, `rail.tsx`. The folder already says the feature. A `*-page.tsx`
  is the entry point of a feature and keeps its prefix.
- **A `.ts` beside a `.tsx` is a derivation, a store or a guard**, and it is placed by the same
  rule. `src/shared/lib/utils.ts` is the one subfolder, and it holds `cn` only.

## Depth

- **The derivation computes and the component draws.** `src/features/map/projection.ts` is the
  model. A derivation joins the `.ts` file that already holds the derivation of that surface —
  `projection.ts` is built from two entries of `docs/map-surface.md`, not one. Add a second `.ts`
  only when the first would then hold two unrelated jobs, and name it for the job. Never
  `utils.ts`, never `helpers.ts`.
  *Check:* search the `.tsx` for `filter`, `sort`, `reduce`, `join`, `slice`, `Object.keys`,
  `Object.entries`, `localeCompare`, `toFixed`, `toLocaleString`, `Intl.` and `new Date`. The count
  is zero, except for one `.map` that turns an already-derived array into elements.
- **The props are the seam. Keep them under five.** Each prop is a domain value or a callback.
  *Check:* read each prop name alone. A name that describes an appearance — `variant`, `size`,
  `color`, `isCompact` — belongs to the kit and not to a feature component. `selected`, `disabled`
  and `open` are domain states, and they stay.
- **A component that only passes its props on has no reason to exist.** Delete it, and let the
  caller name the child.
- **A callback names what happened:** `onSelect(id)`, never `setSidebar`.
- **A list is keyed by the domain identifier.** `GeoEntity` carries two: `id` is the identity of
  the row, and `fid` is a position in an array that MapLibre needs. Key on `id`.
- *Check:* delete the component in your head. Complexity that reappears at three callers earns the
  file. Complexity that vanishes says the file was a pass-through.

## State

ADR 0004 §7 puts each value in exactly one store, never in two.

| The value | Where it lives |
|---|---|
| What is examined: the route, the identifier | The address |
| The workspace: camera, filter, sort, open panels | `localStorage`, through `shared/storage` |
| What dies with the view: hover, an open group, the text in a field | React state |

- *Check:* list every `useState`. For each, name the value, and answer whether it must survive a
  reload. If it must, it belongs in the address or the workspace, and this is a fault.
- **Every writer of the workspace patches, and never replaces.** Two writers with two partial
  records each erase the other's field.
- **Read the address once, at mount.** A two-way binding between the router and a view is a loop.
- **A `useEffect` lives in an adapter or a subscription.** *Check:* count the `useEffect` calls in a
  file that is neither. The count is zero.

## Types

`noInlineConfig` is on, so a suppression is inert as well as refused. There is no escape hatch to
design toward.

- *Check:* search for `any`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `as unknown as`,
  and a non-null `!` that is not `!==`, `!=` or a boolean negation. The count is zero. `as const` is
  permitted. One `as Record<string, unknown>` is permitted inside a type guard and nowhere else —
  `src/shared/storage.ts` and `workspace.ts` are the model.
- **Make an illegal state impossible to build.** A props type is a closed union that one
  discriminant reads.
- **Every property of a props type is `readonly`.** The read shapes already are, and a props type
  that drops it invites a caller to write into a value it does not own.
- **Validate at the edge.** A value from `localStorage`, from the address or from a library passes a
  guard before its first use.
- **One file exports one main runtime symbol.** The types that describe its input and its result
  belong beside it and do not count against it: `projection.ts` exports one function and four
  shapes. Two unrelated runtime symbols in one file is a fault — split it.

## The visual language

Import with the `@/` alias. Compose every class list with `cn()` from `@/shared/lib/utils`: it is
`clsx` inside `tailwind-merge`, so a class you pass later wins over the same class from the kit.
That is how `h-6` beats the `h-8` of `Input`. Build no class list with a template string and none
with `+`.

**Colour.** Every colour comes from a token — never a literal, never the Tailwind palette. The
names are the shadcn ones: `background`, `foreground`, `card`, `popover`, `muted`, `secondary`,
`accent`, `primary`, `destructive`, `border`, `input`, `ring`. GAB adds `label` for the third step
of the text ladder, `candidate` and `dissent` for the two states of the data, and `entity-1` to
`entity-6` for the map and the graph. Use `border` to separate two surfaces and `input` for the edge
of a control: one token for both makes one of the two wrong.

**A token is real only where it is declared.** Tailwind builds a colour utility from a `--color-*`
name in an `@theme` block. A class that names a token nobody declared emits **no rule at all**, in
silence, so the element keeps the inherited colour and looks correct. Before you write a colour
class outside the shadcn set, read the stylesheet that `src/main.tsx` imports and each file it
imports, and find the `--color-<name>` line. Where the name is absent: use the class, report it by
name under ASSUMED, and say which file must declare it.

> Today `src/index.css` declares the shadcn set only. `src/theme.css` declares `label`, `candidate`,
> `dissent` and the entity hues, and nothing imports it, although `docs/detail-surface.md` §5.4 says
> it was adopted. The repository wins over the document. While this holds, a candidate marked with
> `text-candidate` alone inherits `--foreground` and reads as promoted evidence, which is the false
> presentation PU1 forbids: mark it in words as well, and put the conflict under ASK.

**Density and type.** The grid is 4px. `src/theme.css` holds the values, and this table is a copy of
them, for one reason: no utility reads those custom properties, so a class name cannot reach them.
**Check the reason before you trust the table.** Open `src/theme.css` and confirm the value. If it
differs, use the file and report the difference. If an `@theme` block has since registered these
properties, the table is obsolete: use the generated class, and say the table should go.

| `src/theme.css` | Write |
|---|---|
| `--radius: 0px` | `rounded-none` |
| `--row-height`, `--control-height`: 24px | `h-6` |
| `--pad`: 8px in a panel | `p-2` |
| `--pad-cell`: 6px in a cell | `px-1.5` |
| `--size-heading`: 16px | `text-base` |
| `--size-base`: 12px | `text-xs` |
| `--size-small`: 11px, the floor | `text-[11px]/4` — an arbitrary size carries no line height, so state one |
| `--tracking-caps`: 0.06em | `text-[11px]/4 uppercase tracking-[0.06em] text-label`, on a small table header only |
| A column of figures | `font-mono text-right tabular-nums` |
| A value in a row | `truncate min-w-0`, with the full value under `title`. `truncate` alone does nothing in a flex row: the item defaults to `min-width: auto` and pushes its neighbour off the line |

**The kit came from shadcn at its own scale, and the feature corrects it at the call site.** The
vendored files are closed, so they are not edited: pass the correction in `className`, and `cn()`
merges it.

| The kit writes | Pass |
|---|---|
| `rounded-lg`, and `rounded-4xl` on `Badge` | `rounded-none`. `src/index.css` still holds `--radius: 0.625rem`, so every kit part is round today |
| `Input` `h-8`, `text-base md:text-sm` | `h-6 text-xs`. `Input` has no size variant |
| `Input` `disabled:opacity-50` | `disabled:opacity-100 disabled:bg-muted border-transparent`. This is the 3.3:1 defect `docs/detail-surface.md` records: a read-only surface never says "not editable" by fading the data |
| `Button` default `h-8` | `size="xs"`, which is `h-6` |
| `SelectTrigger` `data-[size=default]:h-8` | `h-6` |
| `Button` `transition-all` | `transition-colors`, under 120ms |

**What a generated design writes, and what GAB writes.**

| A generated design | GAB |
|---|---|
| `rounded-lg`, `shadow-md` on a panel | `rounded-none`, and one `border` hairline. A shadow marks a true overlay only |
| `bg-gradient-to-r`, `backdrop-blur`, a glow | One flat ground from one token |
| `p-6`, `gap-8`, `h-12` | `p-2`, `gap-2`, `h-6` |
| `text-gray-500`, `#1e293b` | `text-muted-foreground`, `text-label` |
| A coloured badge on every row | Grey at rest, and one hue where the operator must look |
| `text-3xl font-bold` | `text-base` for the heading, `text-xs` below it |
| A card inside a card inside a panel | One border level for one surface |
| An emoji, an illustration, a large centred icon, a friendly line | One sentence that says the count and the reason |
| `transition-all duration-300` | A state change under 120ms, and nothing else animates |
| `N/A`, `—` or `0` for a value that is absent | A blank cell, under a header that names the key |

**Controls.**

- **A line that acts is a real control.** A row that selects, a header that folds a group: each is a
  `<button type="button">`, styled flat with `w-full text-left rounded-none`. It then reaches the
  keyboard, the focus ring and the reader with no extra code. A `<div>` with `onClick` is a defect
  that no lint rule here catches — no `jsx-a11y` plugin is configured. Where a button cannot be
  used, state `role`, `tabIndex` and a handler for Enter and Space, and say in a comment why.
- **The focus ring follows the kit exactly:** `outline-none focus-visible:border-ring
  focus-visible:ring-3 focus-visible:ring-ring/50`. `ring` on its own is not a focus utility — it
  paints at rest, and with no colour utility it paints `currentcolor` and not the token. Keep the
  ring on every control.
- **A `Badge` that is a link takes `asChild` and wraps one `<a>`.** A row is a button, so what sits
  on it is styled text and not a second control.
- **A surface that writes nothing draws its value with `defaultValue`**, never with `value` and no
  `onChange`. Where the contract also makes the control `disabled`, that removes it from the tab
  order and from the reader: build it as the contract says, and put the tension under ASK.
- An icon is a 14px line from `lucide-react`, and it never labels a destructive or an unclear action
  alone. An icon-only control carries an `aria-label` — `mode-toggle.tsx` is the model.
- Sentence case everywhere. Uppercase for a small table header only, with tracking.

## What the surface owes its reader

Each rule below was a defect in a prototype, and each one is invisible in a review.

- **The unknown is the absence of a key, and it reads as an absence and not as a fault** (M9). A
  blank cell is readable only under a header that says what the column holds.
- **A surface that drops evidence in silence is worse than one that says how much it dropped.** The
  count that cannot be drawn goes on the screen, in words.
- **A value names the documents it comes from** (M8). A score of one document, repeated on twenty
  claims, reads as a score for each claim — `docs/detail-surface.md` records it, under the finding
  about a per-claim score.
- **An interval is written at both ends** (M6). A closed interval must never read as current.
- **Test the thing, and never the list it is in.** The mark of an M4 relation comes from the
  relation.
- **An attribution is an obligation of a licence and not a caption.** The credit on screen matches
  the ground on screen, and no floating control covers it.

## The story

A story is the authoring format of a component check, and **not a second test runner**.
`@storybook/addon-vitest` turns each story into a Vitest test with portable stories and runs it in
Chromium, so one runner still holds. `pnpm test` runs the suite and `pnpm check` never does. Read
`.storybook/main.ts` and `vitest.config.ts` for what is configured.

- **One story for each state the contract names**, and none for a permutation it does not name. The
  export is named for the criterion it proves — not `Primary`, not `WithProps`. The "Works when" and
  the *Check* of the build order are the list.
- **The format is CSF, and the indexer holds it**: `const meta = { … } satisfies Meta<typeof X>`, a
  default export of the meta, `type Story = StoryObj<typeof meta>`, and one named export for each
  story. No lint rule checks this format. A story that breaks it does not disappear in silence: the
  indexer throws `MultipleIndexingError`, and `vitest run` fails before the first test starts.
  `src/shared/ui/badge.stories.tsx` is the model.
- **`expect` comes from `storybook/test`, and it is instrumented**: every matcher returns a promise
  and is awaited. It is not the `expect` of Vitest. A forgotten `await` resolves after the test has
  already passed, and `no-floating-promises` is what catches it.
- **Assert on the contract, and never on the interior.** A role, an accessible name, the text, a
  `data-` attribute. A class name and a colour are the interior, and they change with the theme.
- **A component that reads the router, `localStorage` or the theme class directly cannot be
  storied.** That is the seam telling you where the read belongs: the page or the route reads it,
  and the component takes props. Fix the component, and do not wrap the story in a provider.
- **There is no theme decorator and no provider in `.storybook/preview.ts`**, on purpose: the light
  theme is on `:root` and the dark theme is behind a `.dark` class. A story that proves the dark
  paint sets the class itself. Where a contrast ratio is part of the criterion, write both, because
  a hue that holds on one ground does not hold on the other.
- **The layout is `centered` by default.** Where the size of the component is part of its contract —
  a rail of 24 rem, a row of 24 px — set the size in the story and say which.
- **A story that needs read data imports the same module its caller imports.** Both then change on
  the day `src/contract/` replaces the fixtures.
- **A story lives inside its component's folder, so it inherits that folder's boundary.** It imports
  `shared/` and its own feature. `src/stories/` is a folder nobody declared, and it fails the lint.
- **No story mounts a live canvas.** `CANVAS.md` holds the reason. Story the panels beside it.

## Comments, and the words

- Every comment and every message is in ASD-STE100 Simplified Technical English. `CLAUDE.md`.
- **A comment says why, and the code says what.** A rule that was a defect carries the defect in one
  line, so that the next reader does not restore it.
- Head each file with the document and the section it is built from, as `projection.ts` does.
- `docs/agents/domain.md` holds the domain words. Use them.

## Stop

- **An open question lives as a tracker ticket, and a silent default in code is the fault.** A guess
  is different, and it is permitted where the surface document names it as one. **A permitted guess
  lives in exactly one place, carries a comment that names the ticket it guesses at, and never
  spreads over two files.** Anything the document does not already name as a guess: stop where you
  are, comment on the ticket, and ask the operator. This holds in the middle of a file.
- **One folder holds the shape of the read data, and no file guesses a second one.** Today it is
  `src/shared/fixtures/`, which is provisional and is deleted the day `src/contract/` is generated
  from the database — ADR 0003 §8. Read the header of the file you import: it says whether it is the
  contract or a guess. A derivation takes the read as an argument and imports no read module, so the
  day the contract arrives only the caller changes.

## Before you report

Run `pnpm check` and `pnpm test`, then answer each line. `pnpm check` is the fast command and never
runs the suite. The story level of the test policy is settled; **every other level is open, the
tracker carries it, and you add no test of another kind without the operator.**

1. Quote the "Works when" of the contract and the *Check* of the build order. For each clause, name
   the story that proves it, or write `no story can reach this` and say what does.
2. List every rule section of the document's "must not lose" by number. For each, write the rule
   this component obeys, or `does not reach this component` with the reason. Omit none.
3. Run every *Check:* in this document on every file you touched, and give each count.
4. Walk each row of *What a generated design writes* against the file, by row.
5. `pnpm check` passes and `pnpm test` passes.

Report as `gab-coder` does: RESULT, FILES, CHECK, RULES, ASSUMED, ASK. Do not commit; the operator
reads the diff. Reach for the `visual-qa` agent only for what a story cannot hold: the live canvas,
and the composition of a whole route.
