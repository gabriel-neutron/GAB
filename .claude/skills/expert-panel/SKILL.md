---
name: expert-panel
description: Send a question to a panel of expert agents and a skeptic, and act on their agreed verdict. Use it before you ask the operator a question, before a "Your decision" line, and when you are not sure of a method, a source, a data model, a review decision or a technical choice.
---

# Expert panel

The operator answers only the **critical** questions. A panel of expert agents answers each other
question, and you act on its verdict with no question to the operator.

## A critical question

A question is critical when the answer:

- spends money or model credit outside the current task;
- cannot be undone with git: a data loss, a public post, a message to a person, a merge into
  `main`;
- changes a product rule that the operator owns (`docs/prd.md`, `docs/decisions.md`);
- or stays open after the panel: the experts do not agree after the last round.

Each other question goes to the panel: a method, a source, a type of relation, a unit in doubt, a
tool, a design, a name, the order of the work.

## Steps

1. **Write the brief.** One question in one sentence, the options, the facts (document ids, ticket
   numbers, file paths, counts) and the cost of each option. Each expert gets the same brief.
2. **Choose the panel.** The `skeptic` is always on the panel. Add two or three experts for the
   question:

   | Question | Experts |
   |---|---|
   | A source, a lead, a method of research | `osint-expert`, `journalist` |
   | A sanction, a legal act, a type of relation for a legal fact | `sanctions-lawyer`, `osint-expert` |
   | What a reader of the report or the site sees | `journalist`, `osint-expert` |
   | Code, a tool, a schema, the order of the work | `software-architect` |

3. **Round 1.** Start the experts in parallel with the Agent tool (one call each, in one message,
   `subagent_type` = the expert). Each expert gives a position, its reasons, its confidence and
   what can change its mind.
4. **Rounds 2 and 3.** Send each expert the positions of the others with SendMessage. Ask what
   convinces it, what it keeps, and for one plan that all can accept. Stop when each expert
   accepts the same plan. Stop after round 3 in all cases.
5. **Act on the verdict.** When the panel agrees and the question is not critical, do the plan
   now. Write the verdict where the next session reads it: the comment of the ticket, an ADR for
   a technical choice that is costly to reverse (`docs/authoring.md`), or the deliverable.
6. **Ask the operator only a critical question.** Give the verdict, the dissent of each expert
   that does not agree, and your recommendation, in one **Your decision:** line.

## Rules

- The panel decides from facts. Give each expert the document ids and the files, and let it read
  them. An expert that has no fact for a position says so.
- A unit in the review queue goes to the panel, and you decide it with its verdict (skill
  `review-unit`). It never waits for the operator because you are not sure.
