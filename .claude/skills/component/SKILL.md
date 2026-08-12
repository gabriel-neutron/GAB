---
name: component
description: Build one component of a surface, through a four-agent loop that repeats until it is clean. Use when a build ticket (#55 to #59) names a step to write, or the user asks to build, rebuild or finish a component of the map, graph, detail or review surface.
---

# Build one component

One component, four agents, and a loop. Nothing here is optional and no step is skipped.

**The argument names the component.** `/component 55 2` is ticket #55, step 2. `/component map adapter`
is the same thing. If neither is given, ask which component, and stop until told.

---

## Before anything: the goal, agreed with the user

**Write no code and start no agent until the goal is agreed.** State back, in your own words and in
under ten lines:

1. **What this component does**, from §4 of its surface document.
2. **What it must never do**, from the same §4 and from §5.
3. **The success criteria, quoted**, from the "Works when" of §4 and the *Check* of §8. These are not
   yours to invent or to soften. They are the definition of done for this component.
4. **Which open questions it touches**, and the ticket number of each.

Get the user's agreement, or their correction, then proceed. If the document does not name the
component, stop and say so — a component with no build order is not built through this skill.

---

## The loop

Repeat until the review agent and the harness agent both return clean. **Three rounds with no
progress is a stop**: report what will not converge, and why, rather than a fourth round.

### Agent 1 — Survey. Read-only, and it writes nothing.

Give it: the surface document, the component name, and the branch `prototypes/2026-08-11`.

It returns:

- the component's contract, from §4;
- **the success criteria as a numbered list**, each one testable, each traceable to a line of the
  document;
- what the accepted prototype did, read from `prototypes/2026-08-11` — **as a reference and never as
  a source**;
- which rules of §5 reach this component, quoted;
- anything in the document that is ambiguous, listed as a question rather than resolved.

It must not propose an implementation. It must not open a file outside `docs/` and the prototype
branch.

### Agent 2 — Write. Use the `gab-coder` agent.

Give it: the survey, the numbered criteria, the standing rules below, and the file to write.

It writes the component from the **document**, not from the prototype. It runs `pnpm check` before
it returns, and it returns the diff and one line of reason for each decision that a reader would
question.

### Agent 3 — Review. Read-only, adversarial.

Give it: the diff, the numbered criteria, and the standing rules below.

It answers three things and nothing else:

1. **Which criteria are not met**, each one named by its number.
2. **Which standing rule is broken**, quoted.
3. **What will fail that a type checker and a linter cannot see** — an effect that runs twice, a
   value read before a style is loaded, a cleanup that leaves an instance behind, a colour a library
   cannot parse.

It proposes no rewrite. It reports.

### Agent 4 — Harness. It exercises the criteria and reports what it saw.

Give it: the numbered criteria and the component.

**When Storybook is installed**, it writes one story per criterion, named for the criterion, and it
runs them. A criterion that cannot be reached from a story is a finding, not a pass.

**When Storybook is not installed**, use the `visual-qa` agent against the real route, and say
plainly in the report which criteria a browser check could not reach in isolation.

It returns: which criteria it exercised, what it saw, and a screenshot path.

### Close the round

If agent 3 and agent 4 are both clean, the component is done: tick its box on the build ticket, and
record on that ticket what the build found. If either is not clean, feed both reports back to agent
2 and go round again.

---

## The standing rules — every component, every round

These are not style preferences. Each one is a decision that is already made, and each one cost
something to learn.

### The specification

1. **The surface document is the specification.** The prototype on `prototypes/2026-08-11` is the
   reference for what the operator accepted, and it is never the source.
2. **Never rebuild what §6 of the document calls scaffolding.** Every file named `prototype-*` on
   that branch is in that class, and so is the `?variant=` switcher, the designs that lost, and the
   window event that carries the selection.
3. **A build that meets an open question comments on that question's ticket and stops.**
   `CLAUDE.md` forbids settling one in code. This is not negotiable and it applies mid-file.

### The seam

4. **A feature never imports another feature.** It imports `src/shared/` only. `src/routes/` is the
   one folder that may import a feature, and that is where a sidebar is composed beside a canvas.
5. **A folder nobody declared fails the lint on purpose.** Do not add one without the declaration.
6. **Everything reads `src/shared/fixtures/`, which is deleted the day `src/contract/` is
   generated.** The rework is known and priced. Do not build a read client against the fixture.

### The canvases — `map/` and `graph/` only

7. **No React state, and no React re-render, inside those folders.** One `ref`, one imperative
   adapter, every other value outside React. ADR 0004 §3.
8. **No binding library over an imperative one.** `react-map-gl` and `@react-sigma/core` are
   refused. ADR 0004 §2.
9. **A mount is idempotent and a cleanup is complete.** React invokes an effect twice in
   development. A non-idempotent mount makes two instances, and the browser drops the older WebGL
   context, which looks like a blank canvas and is not one.
10. **A `ResizeObserver` on the container is required and it is not an optimisation.** The library
    measures the container once, while the chrome around it is still being built. A canvas of the
    wrong size draws correctly and warns about nothing.
11. **A layout property needs a loaded style.** It throws while the style loads, and a control can
    be clicked in that window. One queue, drained on load, for every caller.
12. **A colour must be one the library parses.** A CSS custom property never reaches a map or graph
    style parser. Hues are copied as hex, and the copy is a recorded cost.

### The quality gate

13. **`pnpm check` passes**: `tsr generate`, `tsc -b`, ESLint with `--max-warnings=0`, and Prettier.
    That is the definition of done in ADR 0001 §5.
14. **No file suppresses anything.** `noInlineConfig` is on, and `@ts-expect-error`, `@ts-ignore`
    and `@ts-nocheck` are all refused. A suppression may be excluded by name, never by a pattern
    that authored code can enter.
15. **A step is done when its check passes**, and the checks are prose today, because the test
    policy is open — #21.

### What a surface owes its reader

16. **A surface that drops evidence in silence is worse than one that says how much it dropped.**
    The count that cannot be drawn goes on the screen, in words.
17. **A read-only surface never says "not editable" by fading the data.** A disabled control drew a
    value at 3.3:1 against the ground, below the 4.5:1 the theme requires.
18. **The unknown is the absence of a key, and it must read as an absence and not as a fault.** M9.
    A blank cell is readable only under a header that says what the column holds.
19. **Test the thing, never the list it is in.** The mark of an M4 relation comes from the relation.
20. **An attribution is an obligation of a licence and not a caption.** The credit on screen matches
    the ground on screen, and a floating control never covers it.

### The theme

21. `src/theme.css` binds: radius 0, a hairline of one pixel between two surfaces, **no gradient, no
    blur, no glass, no glow**. A shadow is only for a true overlay.
22. **A hue means "look at this".** The normal state is grey, and the entity hues belong to the map
    and the graph and never to the chrome.
23. **A column of figures lines up**: a value on a row is monospace and right aligned. A value
    truncates and never wraps.

### The writing

24. **Every comment, every commit message and every ticket comment is in ASD-STE100 Simplified
    Technical English.** `CLAUDE.md`.
25. **A comment says why, and the code says what.** A rule that was a defect in the prototype
    carries the defect in one line, so the next reader does not restore it.

---

## What this skill does not do

- It does not install a dependency. Storybook is not installed, and installing it reaches ADR 0001
  §5 and #21. Ask the operator.
- It does not change a document in `docs/`. The operator owns those.
- It does not close a ticket that holds an open question. It comments.
