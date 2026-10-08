---
name: review-unit
description: Review the doubts of the review queue as an AI reviewer. Read the cited passage of each unit first, then promote the unit, reject it, or reject one relation, with a reason. Use it only when the operator asks for a review session, and never in the session that proposed the units.
---

# Review a unit as an AI reviewer

The review page of Gabriel holds the units that wait for a decision. The MCP server gives the
same reads and the same decisions to you. A decision through the server records the origin
"decided by an AI reviewer" and the reason that you give. The operator sees that a human did not
decide the unit.

## Who proposes, who decides

- **Who proposes.** A research session proposes the facts of its research (`propose`). The
  extractor proposes the claims of a stored document. Each proposal waits in the review queue.
- **Who decides first.** The rules of the database decide each unit from its sources. A unit
  with strong sources is accepted, an impossible unit is rejected, and a unit with weak sources
  waits for a better source. Only a unit with a doubt comes to a reviewer.
- **Who decides a doubt.** The operator, in the review page, or you, as an AI reviewer in a
  separate session. **The session that proposed a unit never decides it.** Start the review in a
  new session, and do not decide a unit that this session proposed. The tools do not enforce this
  rule, because all the sessions share one role.
- **The operator can always decide in place of you.** When you are not sure, leave the unit in
  the queue for the operator.

## Tools

- `read_doubts`: the list "Doubts", page by page. `read_waiting`: the units that wait for a
  source. A waiting unit is not for a reviewer.
- `read_unit`: one unit, with its acts, the cited passage of each act and the words around it,
  its faults, the reason of each dispute and of each rejection before, and the check of a second
  model.
- `read_groups`, `read_group`: the groups of the queue and the units of one group.
- `read_decided`: the decided acts, with the origin and the reason of each decision.
- `read_leads`: the leads and the documents that each one stored.
- `promote_unit`, `reject_unit`, `reject_relation`: the three decisions of the review page. Each
  one asks the operator before it runs.
- `document_text`: the whole page of a cited document, when the passage is not enough.

## Steps

1. Call `read_doubts`. Take one unit.
2. **Read the cited passage first.** Read each passage of the unit, with the words around it.
   Then read the faults and the reason of each dispute. When the passage is short or unclear,
   read the page with `document_text`.
3. Compare each act with its passage: the name, the type, each value and each relation. A value
   that the passage does not state is not supported.
4. Decide:
   - The passages state each act, and no fault blocks the unit: call `promote_unit`.
   - The unit is wrong as a whole: call `reject_unit` with the reason and, if necessary, a note.
   - Only one relation is wrong: call `reject_relation` with the id of its act. The rest of the
     unit stays in the queue.
   - You are not sure: do nothing, and tell the operator why.
5. Give `why` for each decision: one or two sentences that name the passage and say how it
   supports the decision. The operator reads it beside the origin.
6. When the record refuses a decision, read the reason and the field. A blocked unit, such as a
   unit with an impossible link, cannot be promoted by anyone: reject it or leave it.

## Never

- Never decide a unit that your own session proposed.
- Never decide before you read the cited passage.
- Never promote a unit to make the queue shorter. A wrong promotion goes into the record.
- Never copy a value of the passage into `why` as a new fact. `why` explains a decision, and it
  proposes nothing.
