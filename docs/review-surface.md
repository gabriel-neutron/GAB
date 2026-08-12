# Review surface — build specification

**Status** Accepted as a build order · **Version** 1 · 11 August 2026
**Source** The throwaway prototype in `src/features/review/`, on branch `prototypes/2026-08-11`,
driven and accepted by the operator on 11 August 2026. **Tickets** Reports to #42, #9, #7, #44, #45, #33, #31, #16 and #8. Settles
none of them.

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

This document says **how to build the review surface, component by component**. It is written from
a prototype that the operator drove and accepted. The prototype is the reference, and it is deleted
when the rebuild lands.

`prd.md` §3 states that **W6 is the pivotal step**, and that the ergonomics of W5–W6 determine the
value of the whole system. This surface is that step. It is the one screen where machine material
becomes evidentiary material.

**It settles no open question.** `CLAUDE.md` forbids that. Every question the prototype touched is
in §7 with its ticket. Where the prototype found something, the finding is in §3 as evidence for a
ticket, and never as a decision.

**It does not replace `spec.md`.** `spec.md` holds the invariants, the read path and the write
path. This document holds one view.

## 2. What the analyst does here

Five use cases, agreed with the operator before any code was written, and restated here in the
shape the accepted prototype reached.

| | Use case |
|---|---|
| **UC1** | Decide one change with its evidence on the same screen: the cited text, the source and its rating, the disagreement, and the target as it stands today. No second surface. |
| **UC2** | Read **every pending change on one node together**. An agent produces several proposals against one node, and they are judged against each other. |
| **UC3** | Know why a change is in front of them — dissent, low confidence, or neither. |
| **UC4** | Say "not yet" without inventing a decision, and record why. |
| **UC5** | Read the record of what was decided, away from the working surface. `spec.md` §5 keeps a rejected proposal for ever; it is evidence, and it is not work. |

**The unit of review is the subject, not the proposal.** This is the central finding of the whole
exercise. A queue of proposals asks the analyst to hold a node in their head across six screens,
and it hides the case that matters most: two changes to one node that contradict each other. The
queue therefore lists **what is being changed** — a node, a link, a node that does not exist yet, a
merge — and each subject carries every pending change against it.

**Each change is still decided on its own.** P1 makes the promotion the pivotal act. Nothing in the
accepted design accepts a group, and no control offers to.

## 3. What the prototype found

### 3.1 The sample cannot exercise this surface — evidence for #8

`shared/fixtures/corpus.ts` carries six proposals. **At most one pending proposal targets any one
node**, so UC2 — the reason the node is the unit — could not be drawn at all. The corpus also
carries **no deletion of any kind**, so no screen in this repository could show what a proposed
deletion looks like.

The prototype added five synthetic proposals in `features/review/prototype-extra.ts`, marked
prototype-only and kept out of `shared/` because three other prototypes read that file and none of
them asked for the change.

**This is a finding for the real sample, not only for the fixture.** C7-VALIDATE (#8) asks whether
a sample of the real v1 entities is representable. A sample that cannot produce two pending changes
on one node, and cannot produce a deletion, cannot test the pivotal step of the product.

### 3.2 The payload union does not fit a review card — evidence for #7

The guessed union in `shared/fixtures/types.ts` produced one good card and four poor ones.

| Payload | What the card could do |
|---|---|
| `attrs` | **The only one that worked.** It has a target, so the screen shows a true before-and-after against the live row, each side with its own source. |
| `relation` | Carries no `attrs` and no `sources`. Invariant 1 needs a source on every attribute, and nothing says whether a promoted link inherits the proposal's `src`. |
| `merge` | Names the rows and never the result. Where two rows disagree on an attribute, the screen cannot show the merged object. The analyst approves a merge without seeing it. |
| `entity` | Cannot say "this is the same object as a row you already hold". The prototype fell back to an exact lower-case label match, which is a screen trick and not a claim in the data. |
| `delete` | Carries a reason and nothing else. |

**The shape that works is a payload a card can diff against its target.** The other four cannot be
diffed, and each one degrades the card in its own way.

### 3.3 The disagreement is absent from the model — evidence for #44

`Proposal` carries `dissent: boolean` and nothing else. `AgentCall` records `renderedPrompt` — the
**input** — and no output. So a per-call join adds nothing: the disagreement is not merely
unjoined, it is not recorded.

On screen this means the analyst is asked to arbitrate a dispute whose content is absent. For the
coal-stock row they see `240000 → 261500` and the words "the agents disagreed", and cannot tell
whether the argument was about the number, the document or the date.

A card needs four things: which agent objected, what it proposed instead as a competing payload,
what the disagreement is about, and the text each side read. **A votes table alone is not enough —
`AgentCall` needs an output field, or there is no text to put in front of anybody.**

### 3.4 A proposal carries no citation — evidence for #44 and #45

A proposal cites `src: DocId[]` — identifiers. It carries no quoted extent, no offset and no page.
The only text anywhere in the corpus that a card can show is the `Context (doc_x): "…"` fragment
that an agent prompt happens to embed.

The prototype recovered those fragments with a regular expression **to measure the size of the
hole, and not to fill it**. That is not a citation: a change to the prompt template silently empties
every card, and a proposal made without that template shows nothing.

### 3.5 What the screen did with an unrouted proposal — evidence for #42

The sample carries a proposal with high confidence and no dissent. S3 does not send it to review.
P1 and invariant 5 admit nothing to the evidentiary layer without an explicit promotion.

**The prototype routed it to the human queue, with its promote control live, and printed the
conflict on the card.** That is a default, and this document records it as one. It is very probably
the correct direction, because it is the conservative one under P1 — but it is a choice, and #42
has not made it.

A second observation, from the period when the threshold was a control on the screen: **the size of
the #42 gap is a function of #9.** Raise the threshold above the proposal's confidence and the row
leaves the unrouted group and enters the routed one. At a threshold of 1.0 the gap closes
completely and every proposal is reviewed, with no change to S3. Neither S3 nor P1 names that
option.

### 3.6 The threshold does not belong on this surface — evidence for #9

The prototype built the threshold as a control, then removed it on the operator's instruction. Two
findings survive.

- **It must not live on the review surface.** A review screen is where an operational parameter is
  read, not where it is set. The narrow triage queue of P3 has no room for the control at all,
  which is a second argument for the same conclusion.
- **The sample cannot calibrate it.** The pending confidences are 0.38, 0.41, 0.44, 0.55, 0.71,
  0.82, 0.94 and 0.96. A control can be demonstrated on them. Nothing can be measured.

The value is a marked constant in the prototype and it decides nothing.

### 3.7 A review pass makes a third class of view state — evidence for #33

ADR 0004 §7 gives two boxes — the URL for identity, `localStorage` for the workspace — and says a
value lives in exactly one of them. The prototype placed two values correctly: the subject under
examination in the address, the sort order in the workspace.

**Six values fit neither box**, and every one of them is lost on reload:

| Value | Why it fits neither |
|---|---|
| The decisions of this pass | Not identity, not a preference |
| The reason written on a deferral | The same, and `held` is not a `ProposalStatus` |
| Which change the keyboard acts on | Not the identity of what is examined |
| A deferral in progress | Transient |
| The undo target | Transient |
| An open prompt disclosure | Transient |

A pass over a real queue is long. Losing all six on reload is exactly the pain `prd.md` §3 warns
about. **#33 as written admits no third class, and a review pass produces one.**

### 3.8 One link is narrower than #31, and #31 may be wrong — evidence for #31

`spec.md` §6 records #31 as settled and closed: the UI links the original source URL, plus a
web-archive URL and the file hash recorded at ingest. The operator asked for one link on
11 August 2026, and the prototype obeys: the document title is the only link, it prefers the
archive copy, and no hash is shown.

**This document records the breach rather than hiding it.** It also records what the screen found,
which is a real challenge to #31 and not merely a narrowing of it.

#31 assumes every document has a public address. One does not. `doc_9b0417`, a scanned movement
log, has no `uri` and no `archiveUri`; it holds only a `sha256`. Under #31 that row still gives a
reader the hash. Under one link and no hash it gives a reader **nothing at all** — a claim cited to
a document that cannot be reached or checked by any means on the screen, while M8 says every
element is sourced.

#31 therefore needs one of three things, and only the operator may choose: the hash returns as an
integrity check that is not a link; the bucket serves a signed address for a document with no
public copy; or #31 accepts that some sourced claims are unverifiable from the interface.

### 3.9 An operator edit names an agent that never ran — evidence for #16

A proposal written by the operator carries `authorRole: 'gabriel_app'` and still carries a
`callId`. That call names an agent, and its `renderedPrompt` reads "Entered by the analyst. No
model was called."

So a join from a proposal to its agent gives a **false answer for every hand-written row**. The
writing role is the only honest reading, and any surface that names an author must read that field
and not the call.

## 4. The components

Five. Each one names what it does, what it must never do, and how to know that it works.

### 4.1 `model` — subjects, changes and the record

**Does.** Reads the corpus. Groups pending proposals by **subject** and resolves everything a card
needs: the change kind, the routing reason, the attribute difference against the live row, the
sources, the recovered text, the author, and the list of holes with their tickets.

**Filing rule.** A proposal whose target is an entity files under that entity. Everything else
stands alone: a create files under itself, a relation under itself, a merge under itself.

**Never.** It never decides. It returns the holes as text with ticket numbers, and the view prints
them.

**Check.** One node carries four changes. A subject is only as sound as its weakest change. No
subject exists without at least one change.

### 4.2 `pass` — the keyboard, and only the keyboard

**Does.** Holds which change the cursor is on, steps across subjects, records a verdict, reverses
one, and keeps the focused change on the screen.

**Never.** It holds no layout. It was written as a separate module so that three competing layouts
could be judged as three designs and not as three programs. That reason has gone with the other two
layouts; the separation is kept because §5.1 is a safety contract and must be readable in one file.

**Check.** Every rule of §5.1.

### 4.3 `parts` — the pieces a card is made of

**Does.** The change mark and its colour, the confidence badge, the routing flags, the difference
table, the quotation, the source line, the decision controls, the deferral box, the queue rail and
the sort bar.

**Colour.** Addition takes `--candidate`, deletion takes `--dissent`, modification stays grey
because rule 8 of `src/theme.css` makes the normal state grey and a sourced edit is the common
case. The eye goes to the two rarer and costlier acts. **Read the tokens from the theme.** The
prototype inlined the values when `theme.css` was not yet imported, and `src/index.css` imports it
now.

**Check.** A deletion and a modification never carry the same weight. A flag prints once per card.

### 4.4 `inspector` — the surface

Three panes. The queue of subjects; the node with its standing values and its pending changes one
line each; the whole evidence for the one change under the cursor, with the decision controls at
the foot.

**Why this shape was accepted.** The decision controls never move. In the two layouts it beat, the
controls appeared once per change, each at the end of a different amount of text, so the hand went
somewhere new every time.

**What it costs, and it is not fixed.** Two changes on one node cannot be read side by side — and
comparing them is why the node was made the unit. When two agents contradict each other on one
node, this layout shows them one at a time. **The rebuild should solve this, and the accepted
design does not.**

### 4.5 `decided` — the record

A page of its own, rarely opened. Kept for ever, never deleted.

**What it cannot say.** The model records `decided_at` and `decided_by`, and never why. A rejection
can be counted and not read back. On a page whose only purpose is the record of what was set aside,
that is the missing column.

## 5. The rules the rebuild must not lose

Each rule below was a defect in the prototype. Each one is invisible in a review.

### 5.1 The keyboard, which decides an irreversible act

- **A held key may move, and it may never decide.** Auto-repeat fires about thirty times a second.
  Without a repeat guard, holding the accept key promotes the whole queue.
- **A modifier is not a verdict.** Without a modifier test, `Ctrl+R` rejects the open change and
  swallows the page reload, and `Ctrl+A` promotes. Test for the control, meta and alt keys before
  reading the key.
- **Case does not change a verdict.** Handle the key in one case only, or Caps Lock disables every
  decision while movement still works, and the pass looks alive.
- **A change that is off the screen cannot be decided.** Scroll the focused change and its queue
  row into view whenever the focus moves, or the analyst promotes what they cannot see.
- **A step skips what is already decided**, and a modifier re-opens the whole list for a second
  reading.
- **Undo navigates to what it undoes.** If it moves the cursor without moving the selection, the
  panes show one subject while the keyboard acts on another.
- **The keys are visible on the screen.** Rule 19 of `src/theme.css`: a visible hint is part of the
  style, and not a help page. A tooltip is the help page.

### 5.2 The decision

- **One change, one decision.** P1 makes the promotion the pivotal act. No control accepts a group.
- **A decision on this surface writes nothing.** `spec.md` §5 puts the promotion inside a
  `SECURITY DEFINER` function behind a privilege boundary. The screen calls that function; it never
  writes a row.
- **A decision made on a pass can be taken back while the pass lasts.** The real promotion is not
  reversible, so this screen must not be the first place an analyst learns that a keystroke was
  final.
- **A deferral captures a reason, and a rejection does not.** The prototype has this asymmetry and
  it is probably backwards: a rejection is a permanent judgement on an agent's output and the only
  signal that an extractor is wrong. A reason code on a rejection is worth a ticket.

### 5.3 The evidence

- **A recovered string is never drawn as a citation.** If the text was scraped rather than cited,
  the screen says so where the text is, and not only in a source comment.
- **An absent citation is not quiet.** A proposal with no quoted text must not look calmer than one
  with evidence. That inverts M8.
- **The rating of the source outranks the confidence of the machine.** ADMIRALTY says how reliable
  the document is. Confidence is a self-report with no stated scale. The prototype drew the
  self-report as the loudest element on the card, and that is the wrong weight.
- **The direction of a change is unmistakable.** An old value and a new value never touch with only
  a strike-through between them.
- **A deletion names what it destroys**, with the standing row's own sources beside the case
  against it. A deletion judged on one side of a contradiction is not judged.

### 5.4 The workspace

- The sort order is the workspace, in `localStorage`, under ADR 0004 §7.
- **A prototype never occupies the key of the real feature.**
- **A stored value is read behind a guard**, and every fault returns the fallback.
- The six values of §3.7 have no home. **Do not invent one in code.** #33 carries it.

## 6. What is scaffolding, and must not be rebuilt

| Scaffolding | Why it existed |
|---|---|
| `prototype-extra.ts`, five invented proposals | §3.1. The shared sample cannot put two pending changes on one node, and carries no deletion. |
| The variation switcher and `?variant=` | Three layouts were compared on one route. Two are deleted. |
| The decisions held in React state | A decision must reach a database function, and no database exists. Holding them in memory keeps the prototype from lying about the one thing that matters. |
| The threshold constant | §3.6. It draws a queue. It decides nothing. |
| The regular expression that recovers quoted text | §3.4. It measures the hole. It is not a citation path. |
| The frozen clock | The fixture carries fixed dates, so a real clock would make two runs incomparable. |
| The inlined colour values | `theme.css` was not imported when they were written. It is now. Read the tokens. |
| `review-sidebar.tsx` | The narrow triage queue of P3. It was built and never mounted, so it produced no finding. See §9. |

## 7. What this document must not settle

| Question | Ticket | What the prototype adds |
|---|---|---|
| What happens to a proposal that S3 does not route | **#42** | §3.5 — the screen routed it to the human queue with the promote control live. That is a default, and it is recorded as one. The size of the gap is a function of #9. |
| The confidence threshold | **#9** | §3.6 — it does not belong on this surface, and the sample cannot calibrate it. |
| The payload of a proposal | **#7** | §3.2 — one of five payloads produces a usable card. The shape that works is one a card can diff against its target. |
| How a disagreement is recorded | **#44** | §3.3 — `dissent` is a flag with no argument, and `AgentCall` records the input only. A votes table is not enough without an output field. |
| Whether a reader sees the rendered prompt | **#45** | The prototype shows it, behind a control, and states on screen that it is one prompt with no reply. `prd.md` §2 gives one operator, so no reader distinct from the operator exists yet. **That is a report, and not a proposal.** |
| Where the view state lives | **#33** | §3.7 — a pass produces six values that fit neither box, and all six are lost on reload. |
| What a reader is given instead of the bucket | **#31, closed** | §3.8 — the screen is knowingly narrower than the closed decision, and a scanned document with no address now gives a reader nothing at all. |
| What a call record names | **#16** | §3.9 — an operator edit carries a call that names an agent which never ran. |
| Whether the sample is representable | **#8** | §3.1 — the sample cannot exercise the pivotal step. |

## 8. The order to build in

Each step is done when its check passes. No step needs the step after it.

1. **`model`.** Pure. Group by subject, resolve the difference, collect the holes.
   *Check:* one node carries several changes; a proposal with no diffable payload still produces a
   card that states what it cannot show.
2. **`pass`.** The keyboard contract of §5.1, alone and readable in one file.
   *Check:* every rule of §5.1, each one tested by holding a key, by a modifier, and with Caps Lock
   on.
3. **`parts`.** The card pieces, reading the theme tokens.
   *Check:* §5.3, and a deletion never carries the weight of a modification.
4. **The queue and the node pane.** The subject list, and the standing values against the pending
   changes.
   *Check:* a reader can tell fact from request without opening anything.
5. **The evidence pane and the decision.** The controls at a fixed place; the promotion calls the
   database function and never writes a row.
   *Check:* §5.2.
6. **The decided page.**
   *Check:* nothing on the working surface carries a decided row.

## 9. Not decided here

- **How two contradicting changes on one node are compared.** §4.4 names the cost of the accepted
  layout and does not pay it. This is the first thing a rebuild should improve.
- **Whether a rejection carries a reason code.** §5.2 argues that it should. It is not decided, and
  it needs a ticket.
- **What the surface does at the end of a pass.** The prototype has no end state. A pivotal screen
  should not go blank at the moment the work is finished.
- **Whether `/review/decided` is a fifth route.** ADR 0004 §6 names four. The prototype added one
  beside `/review`, not inside it, so `/review` still fills the screen. ADR 0004 §6 needs a line
  before this survives.
- **The narrow triage queue of P3.** The prototype built it and never mounted it beside the map or
  the graph, so it produced no finding. The dual review surface of `prd.md` §4.3 is still one
  surface and one marker.
