# ADR 0012 — Named rules in the database decide from the letters of the authors

**Status** Accepted · 8 October 2026, corrected the same day (#378) · Replaces ADR 0011.

## Context

The review queue held every proposal, and the operator had to decide each one. On 8 October 2026
the operator set the original goal again: the machine reads, checks and proposes, and the operator
sees only the doubts (`decisions.md` S1, S3, S4, P10). The rules must be simple, auditable and
based on the sources. ADR 0011 had a similar method, but it was large, and the product removed it
on 7 October 2026.

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
- A name that joins an author B is a doubt, because it would raise the letter of every act of that
  name.
- A is only for the issuer of an official record, on its own record, and B only comes from the
  reference set. The worker gives C to F. A party to the conflict is B at most, and C at most on a
  fact about the other side (`decisions.md` S1). The graph holds no side for an entity yet, so in
  the first build a party counts as C on every fact. This is the safe direction.
- A **reference set** of about thirty rated authors is made once by the strongest model that
  OpenRouter gives. The operator reads and approves it once.
- The worker stores the answer through one door of the agent role, with the model and the date. A
  letter is an input of the rules, and never a decision.

### Independence and the digit

NATO judges the source and the information apart (STANAG 2022, the base of STANAG 2511 and AJP-2.1),
so code computes the digit without the letters.

- Two citations of one fact are **independent** only when they have different authors, different
  controllers, different sites (domain or channel, read from the stored address), and passages
  that share no long run of the same words. The site only joins two authors and never names one.
  A citation that reports what another party says never counts. When code is not sure, the two
  citations count as one author.
- A fact with no passed check by a second model family gets **no digit**: the check proves that the
  passage says the fact, not that the fact is true. The check also runs on research acts.
- **The digit:** 1 when two or more independent citations agree with no conflict; 2 when two or
  more citations are not proved independent; 3 for one author; 4 when another pending value
  disagrees; 5 when the checker disputes the fact or a party denies it; 6 when nothing can be
  compared, for display only. Code computes it when it reads the fact, so it never goes stale.

### The rules

- The rules of S3 run **in the database**, as one function. Every writer gets the same decision,
  and no machine role can call this function in place of a rule. An AI reviewer decides through the
  MCP server as a separate act, with its own origin "decided by an AI reviewer" (ADR 0010, #376).
- The function runs on a unit when its acts are written, when one of its authors gets a letter,
  and when a new act cites a new source for one of its facts.
- The **first rule that matches** decides: impossible, doubt, strong sources, weak sources.
- **Doubt** includes a disputed check and a denial by the subject of the fact. A contradiction from
  an author F is not a doubt: the unit waits, and the card shows the conflict.
- **Strong sources** need, for each fact of the unit, a passed check and either one source A on its
  own record, or two independent citations with one author B or better and one C or better.
- The **threshold** is a row of configuration, not a code constant. It starts strict.
- A decision records the rule name and its version in the origin of the decision (S4). A decision
  of the operator records "validated manually by the operator". A decision of an AI reviewer records "decided by an AI reviewer".
- A decision also records the inputs that its rule read: the letters, the independent authors and
  the digit, so a later read can explain it.
- **Weak sources:** the unit waits. A unit whose only sources are D or E is rejected only after a
  deepening search. Until the operator sets a budget, no deepening search runs, so no unit is
  rejected for weak sources.

### The review page

The queue shows the units of the "doubt" rule by default. The units that wait are a second list.
The faults of the screen and the rules read the same check.

## Consequences

- At the start, almost no unit passes: on 8 October 2026 no pending fact of the test stack cited two
  documents. The evidentiary layer fills only with sources A and with facts that two authors give.
- A wrong reference set moves every later letter. The operator can read the reference set and its
  reasons at any time.
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
