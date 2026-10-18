---
name: review-unit
description: Review the doubts of the review queue as an AI reviewer. Read the cited passage of each unit first, then promote the unit, reject it, or reject one relation, with a reason. Use it in a new reviewer subagent or session, never in the agent that proposed the units.
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
- **Who decides a doubt.** The operator, in the review page, or you, as an AI reviewer with a
  new context. **The agent that proposed a unit never decides it.** The agent that proposed
  starts a new reviewer subagent (or a new session). It gives the subagent only the proposal ids
  or the unit ids, and the ticket number. It does not give its notes, its reasons or its history.
  The reviewer reads the units from the record, as a stranger to them. The database refuses to
  accept an act in the transaction that proposed it. The tools do not enforce the rest of this
  rule, because all the agents share one role.
- **When you are not sure, send the unit to the skill `expert-panel`**, and decide it with its
  verdict. Leave a unit in the queue only when the panel names a source that is missing: write
  that source on the list of needs (skill `source-hunt`). The operator can always decide in
  place of you.
- **One review of the queue at a time.** To empty the queue, start the workflow
  `review-queue` (`research/.claude/workflows/review-queue.js`). It reads the queue again at
  each round, so two reviewers do not decide the same unit. When `read_unit` says that a unit is
  decided or absent, go to the next unit.

## Tools

- `read_doubts`: the list "Doubts", page by page. `read_waiting`: the units that wait for a
  source. A waiting unit is not for a reviewer.
- `read_unit`: one unit, with its acts, the cited passage of each act and the words around it,
  its faults, the reason of each dispute and of each rejection before, and the check of a second
  model.
- `read_groups`, `read_group`: the groups of the queue and the units of one group.
- `read_decided`: the decided acts, with the origin and the reason of each decision.
- `read_leads`: the leads and the documents that each one stored.
- `promote_unit`, `reject_unit`, `reject_relation`: the decisions of the review page on one
  unit. `promote_clean_proposals`: the group action, which promotes the clean units of one group,
  each as its own decision with your reason.
- `document_text`: the whole page of a cited document, when the passage is not enough.

## Steps

1. Call `read_doubts`. Take one unit.
2. **Read the cited passage first.** Read each passage of the unit, with the words around it.
   Then read the faults and the reason of each dispute. When the passage is short or unclear,
   read the page with `document_text`.
3. Compare each act with its passage: the name, the type, each value and each relation. A value
   that the passage does not state is not supported.
   - A sanctions relation: `designated_by` is a listing by name. For a vessel, it is an entry on
     the vessel list of a regime (the OFAC SDN list, Annex XLII of Council Regulation (EU) No
     833/2014, a UK specified ship). For any other entity, it is a listing with an asset freeze
     (the OFAC SDN list, Annex I of Council Regulation (EU) No 269/2014, a UK asset freeze). Any
     other sectoral measure freezes no asset, and it is `restricted_by`: an OFAC directive under
     Executive Order 13662 or 14024, or another annex or article of Council Regulation (EU) No
     833/2014. The passage
     must name the exact provision: the directive, the annex or the article. A `designated_by`
     relation for a sectoral measure has the wrong type: do not promote the unit, and do not
     reject it. Leave it in the queue, and tell the operator that the relation goes back to be
     retyped as `restricted_by`.
     A person with only a `restricted_by` relation is not a fact for the record.
   - A start or an end of a relation of the record (the card reads "Start of a relation" or "End
     of a relation"): the passage must state that day for that relation. A date of publication,
     a date of a later change, or a day of another entry does not support it.
4. Decide:
   - The passages state each act, and no fault blocks the unit: call `promote_unit`.
   - The unit is wrong as a whole: call `reject_unit` with the reason and, if necessary, a note.
   - Only one relation is wrong: call `reject_relation` with the id of its act. The rest of the
     unit stays in the queue: decide it with the same rules.
   - Each clean unit of one group is correct: call `promote_clean_proposals` with the group and
     the units that you read. Give only the units whose passages you read. The database refuses
     each unit that is not clean, and writes the others.
   - You are not sure: send the unit to the skill `expert-panel`, and decide it with its verdict.
5. Give `why` for each decision: one or two sentences that name the passage and say how it
   supports the decision. The operator reads it beside the origin.
6. When the record refuses a decision, read the reason and the field. A blocked unit, such as a
   unit with an impossible link, cannot be promoted by anyone: reject it or leave it.

## Never

- Never decide a unit that you proposed, or that an agent proposed when you share its context.
- Never decide a unit that a spec or a ticket holds in the queue: the spec or the ticket names the
  unit, its group or its kind of act, and says that it waits. Leave it for the session that the
  spec or the ticket names.
- Never decide before you read the cited passage.
- Never promote a unit to make the queue shorter. A wrong promotion goes into the record.
- Never copy a value of the passage into `why` as a new fact. `why` explains a decision, and it
  proposes nothing.
