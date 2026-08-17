---
name: component
description: Read before you write or edit a component, a story, a derivation or a route, before you touch a live canvas, and when a ticket names a component or a step of a surface. Holds the placement, depth, state, type, story and visual rules that every component shares.
---

# Build one component

A component is a **deep module**. This document says how every one is built. **What one component
does comes from its contract**, which is the ticket, the file headers of its feature, and the two
call sites of a shared file. The surface documents that once held it were removed on 17 August
2026; the three built surfaces carry their rules in their file headers, and the review surface
carries its own on **#58**.

**It names no file and no line number.** Where a value lives in the repository — a token, a
density, the parts of the kit, the lint gates — read the repository. A value copied to here goes
stale in silence, and a stale rule is obeyed as confidently as a live one.

## The steps

1. **Find the contract.** Read the ticket that names this component, and read it whole: it carries
   what the component does, the rules it holds and the check that says it works. Then read the file
   headers of its feature, which state each rule and the defect that produced it. State back in
   five lines: what it does, the rules it holds, the "Works when", and the check.
2. **Place the file.** See *Placement*.
3. **Write the derivation**, before the `.tsx` exists.
4. **Write the component.** Read *What to write* first. Your instinct writes the left column.
5. **Write the story**, one for each state the contract names.
6. **Run the check command, then the test command.** The package manifest names both. Then answer
   *Before you report*.

**Stop and ask the operator** when: no ticket says what the component does; a ticket contradicts an
ADR or contradicts a rule below; a value must sit in an ancestor of a live canvas. A contradiction
is a question, and never a licence.

**A shared file has no ticket of its own.** Its contract is the two call sites that need it, and
the rules below. Name both callers in your report.

**A folder that drives a live canvas:** read [`CANVAS.md`](CANVAS.md) before step 2.

**Which wins.** The ticket wins on what the component does, on its shape and on its "Works when".
This document wins on how it is built.

## Placement

| Do | Do not |
|---|---|
| Put a vendored part in the kit folder, a shape two features need in shared, one surface in its feature folder, and a composition in a route | Add a top-level folder. It belongs to no element of the lint configuration and fails loudly |
| Let a feature import the shared folder only. A route composes two features | Import one feature from another |
| Move a shape to shared at its **second** call site | Move it at the first |
| Build a control from the parts already vendored. Ask the operator before you add one | Install a dependency, or vendor a new part |
| Name the file for the name the contract gives, in kebab case. A feature entry point keeps its `-page` prefix | Prefix a file with its feature. The folder already says it |
| Put a derivation, a store or a guard in a `.ts` beside the `.tsx`, named for its job | Write `utils.ts` or `helpers.ts` |
| Leave a failing vendored file to the operator, who excludes it **by name** | Exempt a file or a path from the lint set yourself |

## Depth

| Do | Do not |
|---|---|
| Compute in the derivation, and draw in the component | Call `filter`, `sort`, `reduce`, `join`, `slice`, `Object.keys`, `Object.entries`, `localeCompare`, `toFixed`, `toLocaleString`, `Intl.` or `new Date` inside a `.tsx`. One `.map` over an already-derived array is the exception |
| Join a derivation to the `.ts` that already holds that surface's derivation. Add a second only for a second job | Split a derivation because a file feels long |
| Keep props under five, each a domain value or a callback. `selected`, `disabled` and `open` are domain states and they stay | Give a feature component `variant`, `size`, `color` or `isCompact`. An appearance prop belongs to the kit |
| Name a callback for what happened — `onSelect(id)` | `setSidebar` |
| Key a list on the domain identifier | Key on an array position that a library needs |
| Delete a component in your head. Complexity that reappears at three callers earns the file | Keep a component that only passes its props on. Let the caller name the child |

## State

Each value lives in exactly one store, and never in two.

| The value | Where it lives |
|---|---|
| What is examined: the route, the identifier | The address |
| The workspace: camera, filter, sort, open panels | `localStorage`, through the shared storage module |
| What dies with the view: hover, an open group, the text in a field | React state |

| Do | Do not |
|---|---|
| List every `useState` and ask whether the value must survive a reload. If it must, move it | Hold a reloadable value in React state |
| Patch the workspace | Replace it. Two writers with partial records erase each other's fields |
| Read the address once, at mount | Bind the router and a view both ways. That is a loop |
| Put a `useEffect` in an adapter or a subscription | Put one in any other file. The count there is zero |

## Types

Inline configuration is off, so a suppression is inert as well as refused.

| Do | Do not |
|---|---|
| Make an illegal state impossible: a props type is a closed union that one discriminant reads | Accept a shape that can hold two states at once |
| Mark every property of a props type `readonly` | Let a caller write into a value it does not own |
| Guard a value from `localStorage`, from the address or from a library before its first use | Trust an edge |
| Export one main runtime symbol per file. Two **related** exports stay when the header says in one line why they are one job | Keep two unrelated runtime symbols in one file. The test is relatedness, and never a count |
| Use `as const`, and one `as Record<string, unknown>` inside a type guard | Write `any`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `as unknown as`, or a non-null `!` |

## Colour, density and type

**Read the stylesheet the entry point imports, and each file it imports.** Three blocks govern this
section: the colour tokens, the radius, and the density block. That file holds the numbers.

| Do | Do not |
|---|---|
| Take every colour from a token | Write a hex, or a class from the raw palette |
| Find the `--color-<name>` line before you use a name outside the kit's own set. Where it is absent, use the class, report it under ASSUMED, and say which file must declare it | Trust a colour class to paint. An undeclared token emits **no rule at all**, in silence, so the element keeps the inherited colour and looks correct |
| Mark data in words as well as with a hue | Let a hue be the only mark. A colour is hidden from a reader who cannot see it |
| Divide the value in px by 4 to get the number in the class. A 24px control is `h-6`; an 8px pad is `p-2` | Copy a density number into this document or into a component. Where a theme block has since registered these properties, use the generated class and say so |
| Compose every class list with the merge helper, so a later class wins | Build a class list with a template string or with `+` |
| Correct the kit at the call site, in `className`: the height down to the control height, the text down to the base size, `disabled:opacity-50` back to full opacity on a flat fill, and any transition to `transition-colors` with a stated duration | Edit a vendored file. The kit is closed. Write a radius class where the radius token is 0: every kit radius already computes to 0 |
| Use `border` between two surfaces and `input` on the edge of a control | Use one token for both. The surface hairline is far below the contrast a control edge needs |

**What to write.**

| Do not write | Write |
|---|---|
| `rounded-lg`, `shadow-md` on a panel | The flat corner the token gives, and one `border` hairline. A shadow marks a true overlay only |
| `bg-gradient-to-r`, `backdrop-blur`, a glow | One flat ground from one token |
| `p-6`, `gap-8`, `h-12` | The pad, the gap and the height of the density block |
| `text-gray-500`, `#1e293b` | The text tokens of the ladder |
| A coloured badge on every row | Grey at rest, and one hue where the operator must look |
| `text-3xl font-bold` | The heading size for the heading, and the base size below it |
| A card inside a card inside a panel | One border level for one surface |
| An emoji, an illustration, a large centred icon, a friendly line | One sentence that says the count and the reason |
| `transition-all duration-300` | A state change under 120ms, and nothing else animates |
| `N/A`, `—` or `0` for a value that is absent | A blank cell, under a header that names the key |
| A value that truncates with `truncate` alone | `truncate min-w-0`, with the full value under `title`. In a flex row the item defaults to `min-width: auto` and pushes its neighbour off the line |
| A bare figure in a column | `font-mono text-right tabular-nums` |
| An arbitrary text size with no line height | `text-[11px]/4`, which states one |

## Controls

| Do | Do not |
|---|---|
| Write `<button type="button">` for a line that acts, styled flat with `w-full text-left`. It reaches the keyboard, the focus ring and the reader with no extra code | Put `onClick` on a `<div>`. No lint rule here catches it |
| Where a button cannot be used, state `role`, `tabIndex` and a handler for Enter and Space, and say in a comment why | Leave the reason out |
| Copy the kit's `focus-visible` recipe whole, onto every control | Use `ring` alone. It paints at rest, and with no colour utility it paints `currentcolor` |
| Give a kit part that is a link `asChild` and one `<a>` | Put a second control on a row that is already a button |
| Draw a read-only value with `defaultValue` | Write `value` with no `onChange` |
| Build a `disabled` control the contract asks for, and put the tension under ASK: `disabled` removes it from the tab order and from the reader | Fade the data to say "not editable" |
| Use a 14px line icon from the icon set already installed, and give an icon-only control an `aria-label` | Let an icon alone label a destructive or an unclear action |
| Write sentence case | Use uppercase anywhere but a small table header, which takes the caps tracking too |

## What the reader is owed

Each line below was a defect in a prototype, and each one is invisible in a review.

| Do | Do not |
|---|---|
| Draw the unknown as a blank cell, under a header that names the key (M9) | Let an absence read as a fault |
| Put the count you cannot draw on the screen, in words | Drop evidence in silence. That is worse than saying how much was dropped |
| Name the documents a value comes from (M8), and give one score to one document | Repeat one document's score on each claim it holds up |
| Write an interval at both ends (M6) | Let a closed interval read as current |
| Take a mark from the thing itself | Take it from the list the thing was placed in |
| Match the credit on screen to the ground on screen. An attribution is an obligation of a licence | Cover it with a floating control |

## The story

A story is the authoring format of a component check, and **not a second test runner**. The
Storybook addon turns each story into a test and runs it in a browser, so one runner still holds.
Read the Storybook and Vitest configurations for what is set.

| Do | Do not |
|---|---|
| Write one story for each state the contract names, and name the export for the criterion it proves | Write `Primary`, `WithProps`, or a story for a permutation the contract does not name |
| Follow CSF: `const meta = { … } satisfies Meta<typeof X>`, a default export of the meta, `type Story = StoryObj<typeof meta>`, one named export each. Copy the shape from a story already in the tree | Break the format. No lint rule checks it: the indexer throws and the run fails before the first test starts |
| Await every matcher. `expect` comes from the story test package and is instrumented | Use the `expect` of Vitest here, or drop an `await`. A forgotten one resolves after the test has passed |
| Assert a role, an accessible name, the text, or a `data-` attribute | Assert a class name or a colour. Those are the interior, and they change with the theme |
| Fix a component that reads the router, `localStorage` or the theme, so it takes props. That is the seam telling you where the read belongs | Wrap a story in a provider |
| Set the theme class in the story that proves the dark paint, and write both grounds where a contrast ratio is the criterion | Rely on a theme decorator. The preview configuration declares none, on purpose |
| Set the size in the story where size is part of the contract, and say which | Leave a 24 rem rail at the default `centered` layout |
| Import the same read module the caller imports, so both change on the day the generated contract lands | Invent data a derivation would never produce |
| Keep the story beside its component, inside that folder's boundary | Create a top-level stories folder. Nobody declared it, and it fails the lint |
| Story the panels beside a live canvas | Mount a live canvas. [`CANVAS.md`](CANVAS.md) holds the reason |

## Words, and when to stop

| Do | Do not |
|---|---|
| Write every comment and every message in ASD-STE100 Simplified Technical English | — |
| Say **why** in a comment, and let the code say what. A rule that was a defect carries that defect in one line, so the next reader does not restore it | Narrate what the line below does |
| Head each file with the document and the section it is built from, and use the domain words | — |
| File an open question as a tracker ticket, comment on it, and ask the operator — even in the middle of a file | Leave a silent default in code |
| Keep a guess the ticket permits in exactly one place, with a comment that names the ticket it guesses at | Spread a guess over two files, or guess where nothing names a guess |
| Read the header of the read module you import: it says whether it is the generated contract or a stand-in | Guess a second shape for the read data |
| Take the read as an argument in a derivation, so only the caller changes on the day the contract arrives | Import a read module from a derivation |

## Before you report

Run the check command and the test command. The check command is the fast one and never runs the
suite. The story level of the test policy is settled; every other level is open, the tracker
carries it, and you add a test of another kind with the operator only.

1. Quote the "Works when" and the *Check* of the build order. For each clause, name the story that
   proves it, or write `no story can reach this` and say what does.
2. List every rule the ticket and the file headers state. For each, write the rule this component
   obeys, or `does not reach this component` with the reason. Omit none.
3. Run every count above on every file you touched, and give each number.
4. Walk each row of *What to write* against the file, by row.
5. The check command passes and the test command passes.

Report as RESULT, FILES, CHECK, RULES, ASSUMED, ASK. The operator reads the diff, so leave the
commit to the operator. Reach for the visual check agent only for what a story cannot hold: the
live canvas, and the composition of a whole route.
