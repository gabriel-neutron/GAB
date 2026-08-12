# Detail surface — build specification

**Status** Accepted as a build order · **Version** 1 · 11 August 2026
**Source** The throwaway prototype in `src/features/detail/`, on branch `prototypes/2026-08-11`,
driven and accepted by the operator on 11 August 2026. **Tickets** Reports to #12, #10, #45, #33, #46 and #31. Settles none of them.

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

This document says **how to build the entity detail surface, component by component**. It is
written from a prototype that the operator drove and accepted. The prototype is the reference, and
it is deleted when the rebuild lands.

**It settles no open question.** `CLAUDE.md` forbids that. Every question the prototype touched is
in §7 with its ticket. Where the prototype found something, the finding is in §3 as evidence for a
ticket, and never as a decision.

**It does not replace `spec.md`.** `spec.md` holds the invariants, the read path and the write
path. This document holds one view.

**Two components, and the route joins them.** The feature exports the full page and a narrow
sidebar. A feature never imports another feature (ADR 0001 §1), so the map and the graph never
import this one: the **route** puts the sidebar beside their canvas. Both already do.

## 2. What the analyst does here

Five use cases, agreed with the operator before any code was written.

| | Use case |
|---|---|
| **UC1** | Read a value that carries its own type. The attribute set is unstructured, so the control comes from the value: a number, a date, a yes-or-no, a text, a list. |
| **UC2** | Never read a claim without its provenance. Every claim carries a mark to its source that no control can hide. |
| **UC3** | Reach the document. The bucket is private (#31), so the reader is given the original address, a web-archive address and the file hash. |
| **UC4** | Reach what the graph cannot draw: a relation whose endpoint is a relation (M4). |
| **UC5** | Read the same entity in a narrow sidebar beside the map or the graph, and in a full page where the provenance is audited. |

The write path is **not** a use case here. Every control is disabled: the evidentiary layer is
written by promotion (P1, invariant 5) and #42 is open and blocking. The prototype draws the
**shape** an edit surface would take and writes nothing.

## 3. What the prototype found

The fixture of #46 carries three claims on the largest entity. **No layout can be judged on three
claims**, so the prototype carries a density probe: one invented vessel with 100 claims, 14
documents, 4 relations and one pending proposal. Every row of it is invented, and it is deleted
with the prototype.

### 3.1 One claim to a line does not fit a hundred claims — the layout finding

A row per claim, at the row height of the theme, puts about 30 claims on a 900 px screen. The
claims were then given a width taken from the value they carry, and allowed to flow:

| Group | Claims | Lines, one to a line | Lines, flowing |
|---|---|---|---|
| Identity | 13 | 13 | 5 |
| Dimensions | 12 | 12 | 4 |
| Machinery | 10 | 10 | 4 |

**About 2.6 claims to a line, with no loss.** The rule is in §4.1. The same rule needs no second
layout for the sidebar: at 24 rem every cell is wider than the space left, so the claims stack.

### 3.2 The model carries no type, no unit, no group and no order — evidence for #46

`attrs` is one flat object. Nothing in it says that `incorporated_on` is a date, that
`length_overall_m` is metres, that `beam_moulded_m` belongs beside it, or in what order a hundred
keys arrive. The prototype therefore **guesses**, and each guess is visible in the code:

- the **control** comes from the shape of the value, so `imo_number: '9482137'` is a text that
  looks like a number, and a text that matches `YYYY-MM-DD` becomes a date field;
- the **group** comes from a regular expression over the name of the key;
- the **order** is alphabetical, because no order arrives.

A design cannot explain data that arrives with nothing to explain. **The attribute needs its type,
its unit and its group to arrive with it.** That is the finding for #46, and it is the largest one
this prototype produced.

### 3.3 A three-address card does not scale to a rail — a reading of #31, not a change to it

The first card drew the title, the kind, the score, the origin, the original address, the archive
address, the hash and the date: eight lines. Fourteen of them fill three screens, and the rail
became the thing the analyst scrolled instead of the record.

The card is cut to **two lines** — number, title, score with origin, one link, one date, one
control — and the archive address, the hash and the claims the document holds up open behind that
control. **#31 is still met**: the reader is given all three of the original address, the archive
address and the hash. #31 requires that a reader gets them, not that a rail repeats them fourteen
times.

### 3.4 A disabled control hides the value — a defect, now corrected

A shadcn input under `disabled` loses half its opacity. The value — the most important text on the
screen — was drawn at about **3.3:1** against the ground, below the 4.5:1 that `theme.css`
requires. The control keeps `disabled`; the opacity is back at 100; and "not editable" is said by a
flat fill with no border. The corrected ratio is about 16:1.

**A read-only surface says "not editable" with a flat fill, and keeps the data at full contrast.**

### 3.5 The mark of an M4 relation must come from the relation

The `contradicts` relation of the probe is a **direct** relation of the entity and an invisible one
at the same time: its other endpoint is the `owns` relation. A first version marked it from the
list it was placed in, and the mark vanished. **Test the relation, never the list.**

### 3.6 The score of one document repeated on twenty claims reads as a per-claim score

The first version put the ADMIRALTY score in the badge on every claim line. One document that holds
up nineteen claims then printed `B2` nineteen times, which is the presentation **S1 calls false**.

The operator moved the score to the rail, where each document carries it once, and the badge on a
claim is now **a number alone**. That is a real tension and it is not resolved here: PU1 asks for
the origin **and** the score of every candidate claim to be *visible and non-bypassable*, and a
number is a pointer to both. The tooltip is not a label. **#12 must decide whether a pointer
satisfies the obligation.**

### 3.7 A native field prints in the format of the operating system

A number field shows `32,26` and a date field shows `dd/mm/yyyy`, from the locale of the machine. A
number field also reserves room for a spinner it never shows, and that room truncated a five-digit
tonnage to three digits. The spinner is now removed and the cells are wider. **If the published
surface must print a decimal point, the value cannot sit in a number input.**

## 4. The components

Seven. Each names what it does, the rules it holds, and how to know that it works.

### 4.1 `record` — the claims, grouped and flowing

**Does.** Takes the attributes of one entity. Puts them in named groups, in a fixed order, and lays
each claim out as a cell that takes its width from its value.

| Value | Width |
|---|---|
| a yes-or-no, or text up to 12 characters | 17 rem |
| a date | 20 rem — a browser draws `dd/mm/yyyy` with its own padding |
| up to 34 characters | 26 rem |
| longer | the whole line |

**One layout serves the page and the sidebar.** The same rule stacks the cells when the pane is
narrow. Only the width of the name changes.

**The attribute carries its own group in the finished product.** §3.2. Until it does, the rule
that recovers the group from the key stays in one place, named as a guess.

**Works when.** 100 claims read in about 40 lines, and the same component fills a 24 rem sidebar
with one claim to a line.

### 4.2 `field` — one value, one control, one size

**Does.** Chooses the control from the value: a checkbox, a number, a date, a text. A list is
joined into the one box.

**Must be one size.** A hundred boxes of six widths read as noise, and the eye loses the left edge
of the value as a guide.

**Shows every value at its full contrast** (§3.4), **gives every character of the value its
room** (§3.7), and **reads only**. Every control is disabled until #42 is closed.

**Works when.** The four types of the probe are all legible at their full value, in both themes.

### 4.3 `sourceCard` — a title, a link, a date

**Does.** Draws the number, the title, the score with its origin, one link that says what it opens,
the date of retrieval, and one control. Behind the control: the claims this document holds up, the
web-archive address and the file hash.

**Must give all three addresses** (#31), and **must say when one is absent**. A scan with no
address says so; an unrated document says `not rated`, because invariant 6 makes the rating and its
origin absent together, and an absence must never read as a low score.

**Works when.** Fourteen documents fit one screen, and the hash is one click away.

### 4.4 `rail` — the sources of the page, on the right

**Does.** Lists each cited document once, numbered in the order it is met: the entity, then the
claims, then the relations, then the pending proposals. Holds its own scroll.

**Must move on its own.** A click on a badge in the record scrolls **only** the rail, and marks the
card. The record does not move. Arriving with a source named opens the page at that card.

**Works when.** The analyst never scrolls one pane to keep his place in the other.

### 4.5 `sidebar` — the same record, 24 rem wide

**Does.** The same record, the same groups, one claim to a line. A badge opens the source in a
popover, and the popover carries one way out: the full page, in a new tab, opened at that source.

**Must carry no rail.** There is no room for one.

**Must show the name and the type, and nothing else at the top.** No identifier, no coordinate: the
analyst arrived from the map or from the graph.

**Must know nothing about its neighbour.** The route composes.

### 4.6 `relations` — including the ones the graph cannot draw

**Does.** The relations with one endpoint on the entity, then the relations that point at **those**
relations, deduplicated. Each is one line, with its interval and its sources.

**Must mark an M4 relation from the relation** (§3.5), and must say that the graph does not draw
it.

**Works when.** The `contradicts` relation of the probe is reachable from both of its ends.

### 4.7 `pending` — the candidate layer, outside the record

**Does.** Draws each pending proposal that names this entity, marked `candidate`, below the record
and never mixed into it.

**Must use the vocabulary the graph uses.** #10 asks how a pending proposal appears there; this
surface has the same problem, and one answer must serve both.

**Must not act.** No accept, no reject: that is the review queue, and #42 is open.

## 5. The rules the rebuild keeps

### 5.1 Labelling — PU1 and #12

- **A claim never appears without a mark to its source.** No control hides the mark, on either
  surface. What opens on demand is the *document*, never the fact that one exists.
- **A score belongs to the document, never to the claim** (S1). One document, one score, in the
  rail.
- **An absent rating is written, not implied** (invariant 6).
- The disclaimer of the prototype is **placeholder text**. #12 writes the real words.

### 5.2 The two panes

- Each pane scrolls on its own, and neither drives the other except through a badge.
- The record is the left pane. The sources are the right pane. On a narrow surface the rail becomes
  a popover, and nothing else changes.

### 5.3 The edit surface

- **Every control is disabled**, and the surface writes nothing. An operator edit is an
  operator-authored proposal, promoted by the same door as any other (`spec.md` §2, invariant 5).
- The controls exist to show the **shape** of that surface, and to prove that a value keeps its
  type. Removing them removes the answer to UC1.

### 5.4 The theme

`src/theme.css` binds, and the rebuild imports that stylesheet before it uses a token from it:
the radius is 0, a hairline separates two surfaces, and the data carries no
hue at all — a hue means "look at this". The links are the exception, and they take the accent,
because a reader must see what is reachable.

**The stylesheet was adopted on 11 August 2026 on the instruction of the operator**: `index.css`
imports it and the two stock palettes are removed, because an `@import` is only valid before
another rule and a later file cannot win by cascade order.

### 5.5 Provenance

- Every evidentiary row names the proposal that made it (#15), and the surface shows that trail.
- **The stored rendered prompt is not drawn.** The trail reaches it in one join — entity, proposal,
  call, prompt — and #45 is open. See §7.

## 6. Scaffolding, which the rebuild leaves behind

| Scaffolding | Why it existed |
|---|---|
| The density probe: one invented vessel, 100 claims, 14 documents | The fixture of #46 carries three claims. §3.1 cannot be measured on three claims. |
| `?surface=`, and the bar that carries it | It shows the two components on one route. The real surfaces are a route and a composition. |
| The placeholder pane beside the sidebar | The real neighbour is the map or the graph. |
| The index of entities behind an unknown identifier | The application has no navigation yet. |

`?src=` is **not** scaffolding. It is how the sidebar hands a document to a new tab, and §4.4 keeps
it.

## 7. What stays open

| Question | Ticket | What the prototype adds |
|---|---|---|
| Candidate labelling, and what the dataset states about itself | **#12** | §3.6 — a score repeated per claim is the false presentation S1 names; a bare number is a pointer, and a tooltip is not a label. |
| How a pending proposal appears | **#10** | §4.7 — the detail surface has the same problem as the graph, and one vocabulary must serve both. |
| Whether a reader ever sees a stored rendered prompt | **#45** | The trail reaches it in one join, so the `api` view must exclude the column until #45 closes, or the read layer publishes it by default. |
| Where the view state lives | **#33** | The detail surface needs no workspace state. The identity is the identifier in the path; the only other state is which disclosure is open. Question 5 of #33 is answered with "nothing". |
| The shape the fixture stands in for | **#46** | §3.2 — no type, no unit, no group, no order. This is the largest finding of the prototype. |
| What happens to a proposal with no dissent and high confidence | **#42** | The record draws the row and takes no action on it. Every control stays disabled until it is answered. |

## 8. The order to build in

Each step is done when its check passes. No step needs the step after it.

1. **`field`.** The control from the value, one size, disabled.
   *Check:* the four types are legible at full value in both themes; no value is truncated.
2. **`record`.** The groups, the order, and the flowing cells.
   *Check:* 100 claims in about 40 lines on the page, and one to a line at 24 rem.
3. **`sourceCard`.** Two lines, and the rest behind one control.
   *Check:* the three addresses of #31 are all reachable; an absent one says so.
4. **`rail`,** and the badge that moves it.
   *Check:* a badge scrolls the rail alone; arriving with `?src=` opens at that card.
5. **The page,** and the route that owns it.
   *Check:* the two panes scroll independently.
6. **The sidebar,** the popover and the hand-off to a new tab.
   *Check:* the map route and the graph route compose it with no change to either feature.
7. **`relations`** and **`pending`**.
   *Check:* the M4 relation is reachable from both ends and marked; a candidate is never mixed into
   the record.

## 9. Not decided here

- **Whether the badge carries the score.** §3.6. The operator chose the number; #12 owns the
  obligation.
- **The words of the disclaimer.** #12 writes them. The prototype fixes only the place and the
  rank.
- **Where an attribute gets its type, its unit and its group.** §3.2 says the model must carry them.
  Whether that is a column, a table or a convention is #46 and the first migration.
- **The decimal separator and the date format.** §3.7. A native field prints in the locale of the
  machine, and a published surface may not.
- **Search inside a hundred claims.** The probe made the need visible. `prd.md` W9 makes search its
  own capability, and this surface does not answer it.
