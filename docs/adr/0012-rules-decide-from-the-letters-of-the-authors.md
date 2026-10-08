# ADR 0012 — Named rules in the database decide from the letters of the authors

**Status** Accepted · 8 October 2026, corrected the same day (#378) · Replaces ADR 0011.

## Context

The operator wants the machine to read, check and propose, and to see only the doubts
(`decisions.md` S1, S3, S4, P10). The rules must be simple, auditable and based on the sources.
ADR 0011 had a similar method, but it was large, and the product removed it on 7 October 2026.

## Decision

### The author and its letter

- An **author** is the person or the body that first gives the information, as the extractor and
  the research AI name it for an act that states or enacts a fact. The address of the document is
  never the author.
- That name is free text, and a model words one author in more than one way. So a **worker job**
  reads each new name, with the known authors and the reference set, and answers one of two
  things: "the same author as a known one", or "a new author" with a letter, a short reason, the
  reference authors that it compared with, and its **controller** when it has one (a state, a
  holding, a channel network). A party to the conflict must have a controller, or the answer is
  refused. A rating that names no reference author is refused. A refused or missing answer leaves
  the author F.
- A name that joins an author A or B is a doubt, because it would raise the letter of every act
  of that name. In the first build, the join only records a doubt flag. Nothing reads the flag yet.
- A is only for the issuer of an official record, on its own record. A and B come only from the
  reference set, which the operator approves. The worker gives C to F. A party to the conflict is
  B at most, and C at most on a fact about the other side (`decisions.md` S1). The graph holds no
  side for an entity yet, so in the first build a party counts as C on every fact. This is the
  safe direction.
- A **reference set** of about thirty rated authors is made once. The operator can load a set
  that experts wrote, or build one with the strongest model that OpenRouter gives. Both ways
  pass the same rules. The operator reads and approves the set once. The first set was written
  by experts and approved by the operator on 2026-10-08, with no model call.
- The operator loads a written set from a file with `pnpm worker reference-set load`, or builds
  one with `pnpm worker reference-set build`. Then the operator reads the set with `show` and
  approves it with `approve`. A record that holds a set refuses a second load and a second
  build. Until the approval, a reference author is no author for any reader, and a rating job
  waits in the queue. The approval is written once for each author.
- Each act that names a new originator queues one rating job for that name, with no click of the
  operator. A refused answer ends the job as failed with its reason, and the name is not asked
  again. A job that fails by a fault of the service leaves the name free.
- The worker stores the answer through one door of the agent role, with the model and the date. A
  letter is an input of the rules, and never a decision.

### Independence and the digit

NATO judges the source and the information apart (`decisions.md` S1), so code computes the digit
without the letters.

- Two citations of one fact are **independent** only when they have different authors, different
  controllers, different sites (domain or channel, read from the stored address), and passages
  that share no long run of the same words. The site only joins two authors and never names one.
  A citation that reports what another party says never counts. When code is not sure, the two
  citations count as one author.
- A fact with no passed check by a second model family gets **no digit**: the check proves that the
  passage says the fact, not that the fact is true. The check for research acts is a separate ticket.
  This gate comes before rule 5. So a fact whose only check disputes it shows no digit, because that
  check did not pass. A verdict "unclear" is not a dispute.
- **The digit:** 1 when two or more independent citations agree with no conflict; 2 when two or
  more known authors give citations that are not proved independent; 3 for one known author; 4 when another pending value
  disagrees; 5 when the checker disputes the fact or a party denies it; 6 when no citation has a
  known author. Code tries 5, then 4, 1, 2, 3 and 6. It computes the digit when it reads the fact,
  so the digit never goes stale.

### The rules

- The rules of S3 run **in the database**, as one function. Every writer gets the same decision,
  and no machine role can call this function in place of a rule. An AI reviewer decides through the
  MCP server as a separate act, with its own origin "decided by an AI reviewer" (ADR 0010, #376).
- The function runs on a unit when its acts are written, when the check by the second model ends,
  when one of its authors gets a letter, when a name joins a known author, and when a new act
  cites a new source for one of its facts.
- The **first rule that matches** decides: impossible, doubt, strong sources, weak sources.
- **Doubt** holds the cases of S3 (`decisions.md`). A contradiction from an author F is not a doubt:
  the unit waits, and the card shows the conflict.
- **Strong sources** need, for each fact of the unit, a passed check and either one source A on its
  own record, or two independent citations with one author B or better and one C or better.
- The **threshold** is a row of configuration, not a code constant. It starts strict.
- A decision records the rule name and its version in the origin of the decision (S4). A decision
  of the operator records "validated manually by the operator". A decision of an AI reviewer
  records "decided by an AI reviewer".
- A decision also records the inputs that its rule read: the letters, the independent authors and
  the digit, so a later read can explain it.
- **Weak sources:** the unit waits. A unit whose sources have each passed their check starts one
  **deepening search**: a job of the lead agent that carries a token budget. The budget is a
  setting of the rule, it starts at zero, and the operator sets it with a new version of the rule.
  At zero, no search runs, so no unit is rejected for weak sources. The lead agent proposes
  nothing: it stores pages, the extraction proposes, and the rules decide again. When the search
  and the extraction of its pages have ended, a unit whose only sources are D or E is rejected by
  the rule, with its origin. Any other unit keeps waiting, because a source can come later.

## Consequences

- At the start, almost no unit passes: on 8 October 2026 no pending fact of the test stack cited two
  documents. The evidentiary layer fills only with sources A and with facts that two authors give.
- A model writes a letter, which reverses the old rule "no model writes a rating". The letter only
  feeds the rules; the database still decides.
- The independence test can join two real authors, so a true fact can wait. It is built so that a
  copy does not pass.
- **Not in the first build:** a digit 5 from a comparison with the accepted facts, a count of false
  facts for each author, the exception of a letter for one subject, and the withdrawal of all the
  facts of one author. Each one waits for real data.
- A decision of a rule cannot be undone yet. An undo is built only if it is simple.
- **What proves it wrong:** a fact accepted by a rule that a source A later contradicts, or a
  reference letter that the operator finds false.
