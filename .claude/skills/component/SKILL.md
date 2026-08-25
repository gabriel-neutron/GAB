---
name: component
description: Read before you write or edit a component, a story, a derivation or a route, before you touch a live canvas, and when a ticket names a component or a step of a surface. Holds the placement, depth, state, type, story and visual rules that every component shares.
---

# Build one component

A component is a **deep module**. This document says how one is built. The ticket says what it
does. **This document names no file and no line number**: read the repository for a token, a
density, the parts of the kit and the lint set. A value copied here goes stale in silence.

## The steps

1. **Read the ticket whole.** It carries what the component does, the rules it holds, and the
   check that says it works. State back in five lines: what it does, its rules, its "Works when",
   and its check.
2. **Place the file.** See *Placement*.
3. **Write the derivation**, before the `.tsx` exists.
4. **Write the component.** Read *What to write* first. Your instinct writes the left column.
5. **Write one story for each state the ticket names.**
6. **Run the check command, then the test command**, then answer *Before you report*.

**No ticket names this component: stop.** A shared file is the exception. It has no ticket, its
contract is its two call sites, and you name both in your report.

**Climb the ladder before you ask.** Read the document that governs the task, search the code for
a precedent, then `gh issue list --search` for a ruling. **A form the operator refused lives in the
tracker and in no file.** Then take the reversible option, record it under ASSUMED with its cost
and what proves it wrong, and continue.

**Ask only three things**, and only at the end of the task: a ticket contradicts an ADR or a rule
below; a value must sit in an ancestor of a live canvas; a dependency is missing. Each is costly to
reverse. A contradiction is a question and never a licence.

**A folder that drives a live canvas:** read [`CANVAS.md`](CANVAS.md) before step 2.

## Placement

| Do | Do not |
|---|---|
| Put a vendored part in the kit folder, a shape two features need in shared, one surface in its feature folder, and a composition in a route | Add a top-level folder |
| Let a feature import shared only. A route composes two features | Import one feature from another |
| Move a shape to shared at its **second** call site | Move it at the first |
| Build from the parts already vendored | Install a dependency, or vendor a new part |
| Name the file for the contract, in kebab case. A feature entry point keeps its `-page` prefix | Prefix a file with its feature |
| Put a derivation, a store or a guard in a `.ts` beside the `.tsx`, named for its job | Write `utils.ts` or `helpers.ts` |
| Leave a failing vendored file to the operator, who excludes it by name | Exempt a file or a path yourself |

## Depth

| Do | Do not |
|---|---|
| Compute in the derivation, draw in the component | Call `filter`, `sort`, `reduce`, `join`, `slice`, `Object.keys`, `Object.entries`, `localeCompare`, `toFixed`, `toLocaleString`, `Intl.` or `new Date` in a `.tsx`. One `.map` over a derived array is the exception |
| Join a derivation to the `.ts` that holds that surface's derivation. A second file is a second job | Split a derivation because a file feels long |
| Keep props under five, each a domain value or a callback. `selected`, `disabled` and `open` stay | Give a feature component `variant`, `size`, `color` or `isCompact` |
| Name a callback for what happened: `onSelect(id)` | `setSidebar` |
| Key a list on the domain identifier | Key on an array position |
| Delete a component in your head. Complexity that reappears at three callers earns the file | Keep a component that only passes its props on |

## State

Each value lives in one store. The address holds what is examined. `localStorage`, through the
shared storage module, holds the workspace: camera, filter, sort, open panels. React state holds
what dies with the view: hover, an open group, the text in a field.

| Do | Do not |
|---|---|
| Count every `useState`. A value that must survive a reload moves out | Hold a reloadable value in React state |
| Patch the workspace | Replace it. Two partial writers erase each other |
| Read the address once, at mount | Bind the router and a view both ways |
| Put a `useEffect` in an adapter or a subscription | Put one anywhere else. The count is zero |

## Types

Inline configuration is off, so a suppression is inert as well as refused.

| Do | Do not |
|---|---|
| Make an illegal state impossible: a props type is a closed union that one discriminant reads | Accept a shape that holds two states at once |
| Mark every property of a props type `readonly` | Let a caller write a value it does not own |
| Guard every value from `localStorage`, from the address or from a library before first use | Trust an edge |
| Export one runtime symbol per file. Two **related** exports stay, and one line says why they are one job | Keep two unrelated symbols in one file |
| Use `as const`, and one `as Record<string, unknown>` inside a type guard | Write `any`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `as unknown as`, or `!` |

## Paint

**Read the stylesheet the entry point imports.** It holds the colour tokens, the radius and the
density block. Divide a px value by 4 for the class: a 24px control is `h-6`.

| Do | Do not |
|---|---|
| Take every colour from a token | Write a hex, or a raw palette class |
| Find the `--color-<name>` line before you use a name outside the kit set. Where it is absent, use the class, report it under ASSUMED, and name the file that must declare it | Trust a colour class to paint. An undeclared token emits no rule at all, in silence |
| Mark data in words as well as with a hue | Let a hue be the only mark |
| Compose every class list with the merge helper | Build a class list with a template string or `+` |
| Correct the kit at the call site in `className` | Edit a vendored file. The kit is closed |
| Use `border` between two surfaces and `input` on the edge of a control | Use one token for both |

**What to write.**

| Do not write | Write |
|---|---|
| `rounded-lg`, `shadow-md` on a panel | The flat corner, and one `border` hairline. A shadow marks a true overlay only |
| `bg-gradient-to-r`, `backdrop-blur`, a glow | One flat ground from one token |
| `p-6`, `gap-8`, `h-12` | The pad, the gap and the height of the density block |
| `text-gray-500`, `#1e293b` | The text tokens of the ladder |
| A coloured badge on every row | Grey at rest, one hue where the operator must look |
| `text-3xl font-bold` | The heading size, and the base size below it |
| A card inside a card inside a panel | One border level for one surface |
| An emoji, an illustration, a large centred icon, a friendly line | One sentence that says the count and the reason |
| `transition-all duration-300` | A state change under 120ms, and nothing else animates |
| `N/A`, `—` or `0` for an absent value | A blank cell, under a header that names the key |
| `truncate` alone | `truncate min-w-0`, with the full value under `title` |
| A bare figure in a column | `font-mono text-right tabular-nums` |
| A text size with no line height, or a length the theme already names | `text-small/4`, `tracking-caps`. A lint rule refuses the hand-written length |

## Controls

| Do | Do not |
|---|---|
| Write `<button type="button">` for a line that acts, flat, with `w-full text-left` | Put `onClick` on a `<div>`. No lint rule catches it |
| Where a button cannot be used, state `role`, `tabIndex` and a handler for Enter and Space | Leave the reason out |
| Copy the kit `focus-visible` recipe whole onto every control | Use `ring` alone. It paints at rest, and with no colour utility it paints `currentcolor` |
| Give a kit part that is a link `asChild` and one `<a>` | Put a second control on a row that is already a button |
| Draw a read-only value with `defaultValue` | Write `value` with no `onChange` |
| Build the `disabled` control the ticket asks for, and put the tension under ASK | Fade the data to say "not editable" |
| Use a 14px line icon from the set installed, and give an icon-only control an `aria-label` | Let an icon alone label a destructive action |
| Write sentence case | Use uppercase outside a small table header |

## What the reader is owed

Each line was a defect in a prototype, and each one is invisible in a review.

| Do | Do not |
|---|---|
| Draw the unknown as a blank cell, under a header that names the key (M9) | Let an absence read as a fault |
| Put the count you cannot draw on the screen, in words | Drop evidence in silence |
| Name the documents a value comes from (M8), and give one score to one document | Repeat one document's score on each claim |
| Write an interval at both ends (M6) | Let a closed interval read as current |
| Take a mark from the thing itself | Take it from the list it was placed in |
| Match the credit on screen to the ground on screen | Cover it with a floating control |

## The story

A story is the authoring format of a component check, and not a second test runner.

| Do | Do not |
|---|---|
| Write one story for each state the ticket names, and name the export for the criterion it proves | Write `Primary`, `WithProps`, or a permutation the ticket does not name |
| Follow CSF, and copy the shape from a story already in the tree | Break the format. The indexer throws before the first test starts |
| Await every matcher, and take `expect` from the story test package | Use the Vitest `expect`, or drop an `await` |
| Assert a role, an accessible name, the text, or a `data-` attribute | Assert a class name or a colour |
| Fix a component that reads the router, `localStorage` or the theme, so it takes props | Wrap a story in a provider |
| Set the theme class in the story that proves the dark paint | Rely on a theme decorator. The preview declares none |
| Set the size where size is part of the contract | Leave a 24 rem rail at `centered` |
| Import the same read module the caller imports | Invent data a derivation would never produce |
| Keep the story beside its component | Create a top-level stories folder |
| Story the panels beside a live canvas | Mount a live canvas. [`CANVAS.md`](CANVAS.md) holds the reason |

## Comments

The code says what it does. A comment earns its place in three cases only, and in no other:
**an external constraint**, **the origin of a number**, and **a departure the code cannot show**.

| Do | Do not |
|---|---|
| Write a comment block of three lines or fewer, and a line of 100 characters or fewer | Write a file header that states the surface. The ticket states it |
| Delete or correct every comment your change made false, in each file you touch | Leave a sentence that the code no longer obeys |
| Put a ruling of the operator, and the defect that produced a rule, in the tracker and in the commit body | Write either one in the code. A history in a comment grows and no command reads it |
| Keep a guess in one place, and say what is guessed and what proves it wrong | Spread a guess over two files, or name the ticket in the file |

A comment carries no path, no `§` and no ticket number. The lint refuses each one, and it cannot
be suppressed. Carry the reference in your report.

## Before you report

1. Quote the "Works when" of the ticket. For each clause, name the story that proves it, or write
   `no story can reach this` and say what does.
2. Count the rules the ticket and the files you touched state, and give the count. Name only the
   rule this component fails.
3. Give every count this document asks for: props, exports, `useEffect`, `useState`.
4. Walk each row of *What to write* against the file.
5. The check command passes and the test command passes.

Report as RESULT, FILES, CHECK, RULES, ASSUMED, ASK. Leave the commit to the operator. Reach for
the visual check agent only for what a story cannot hold: the live canvas, and a whole route.
