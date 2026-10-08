# ADR 0012 — Named rules in the database decide from the letters of the authors

**Status** Accepted · 8 October 2026 · Replaces ADR 0011.

## Context

The review queue held every proposal, and the operator had to decide each one. On 8 October 2026
the operator set the original goal again: the machine reads, checks and proposes, and the operator
sees only the doubts (`decisions.md` S1, S3, S4, P10). The rules must be simple, auditable and
based on the sources. ADR 0011 had a similar method, but it was large, and the product removed it
on 7 October 2026.

## Decision

### The letter of an author

- An **author** is the person or the body that first gives the information. The extractor and the
  research AI already name it for each act. A copy of a text names its first author, not the site.
- Each author has **one letter**, A to F, and can have an **exception for one subject**. A new
  author is F.
- **A reference set** of rated authors is made once by the strongest model that OpenRouter gives.
  Each reference letter keeps its reason.
- A **worker job** rates each new author with the same model. The prompt holds the reference set.
  The answer gives the letter, a short reason, and the reference authors that the model compared
  with. A rating that names no reference author is refused, and the author stays F.
- The worker stores the letter through one door of the agent role. The letter records the model,
  the reason, the reference authors and the date. A letter is an input of the rules, and never a
  decision.

### The rules

- The rules of S3 run **in the database**, as one function. Every writer gets the same decision,
  and no machine role can decide in place of a rule.
- The function runs on a unit when its acts are written, when one of its authors gets a letter,
  and when a new act cites a new source for one of its facts.
- The **first rule that matches** decides: impossible, doubt, strong sources, weak sources.
- **Strong sources** need, for each fact of the unit, one source A or two sources B or better with
  different authors, and a passed check by a second model family. A research act gets no second
  check today, so it waits until that check exists.
- The **threshold** is a row of configuration, not a code constant. It starts strict.
- A decision records the rule name and its version in the origin of the decision (S4). A decision
  of the operator records "validated manually".
- Code computes the **digit** of each fact when it reads the fact. The digit is not stored, so it
  never goes stale.
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
- A decision of a rule cannot be undone yet. An undo is built only if it is simple.
- **What proves it wrong:** a fact accepted by a rule that a source A later contradicts, or a
  reference letter that the operator finds false.
