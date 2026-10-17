# ADR 0012 — Named rules in the database decide from the letters of the authors

**Status** Accepted · 8 October 2026, corrected the same day (#378) and on 17 October 2026 (the
move of a name, the addition to the reference set) · Replaces ADR 0011.

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
- A name that holds two authors ("OFAC; Reuters") or a generic name ("uk", "the secretary of
  state") joins no author. The door refuses the join, and the worker asks the model once more to
  rate the name as a new author. A comma does not always make two authors: the official name of
  one body can hold one ("Foreign, Commonwealth & Development Office"), and so can a parent body
  after the name ("OFSI, HM Treasury"). So a comma does not stop a join into an author A or B,
  because that join is a doubt that the operator decides. A comma still stops a join into another
  author, and a semicolon stops each join.
- A name that joins an author A or B is a doubt, because it would raise the letter of every act
  of that name. Until the operator decides it, the name reads as F, and each unit with a fact of
  that name is a doubt. The operator confirms or refuses the name on the review page or with a
  command of the worker, and the decision is written once. A confirmation gives the name the
  letter of its author. A refusal makes the name F and gives it back to the rater, which cannot
  join it again to the same author. After each decision the rules run again on the units of the
  name. A dry-run gives, for each name, the number of units whose state each decision would
  change: a rule decides the unit, or another rule matches it. No machine role can decide a
  name: the decision raises a letter. A decision waits while the rating job of the name runs.
- The worker can make a wrong author for a name of a reference author. On 17 October 2026 it read
  the comma in the main names of the FCDO, OFSI and OFAC as two authors, and about 2,300 acts got
  an author F. So the operator can **move** a name from an author that the worker rated (C to F)
  to an approved reference author, with `pnpm worker author-names move <name> <author>`. The rows
  stay: the move writes the name again for the reference author, with a refusal that retires the
  old row and a confirmation of the new row, and both decisions record the operator. Then the
  rules run again on the units of the name. A move into an author out of the reference set is
  refused, because only the operator gives A or B, and so is a move of a name of a reference
  author. A move between two rated authors is not in this build. The old author keeps its row,
  and the rater no longer sees it once its own name has moved.
- A is only for the issuer of an official record, on its own record. A and B come only from the
  reference set, which the operator approves. Each reference author keeps its **sites**: the host
  names where it publishes its own records. One source A counts alone only when the cited
  document is on a site of its author. A faithful copy of the record on another site needs a
  second independent source, like any other source (operator ruling, 2026-10-11).
  An author with no site never counts alone, so an author A of a set stored before the sites
  counts alone only after the operator gives it its sites. An author A of a written set can have
  no site, when it publishes only on a host that many authors share: OFSI publishes on the site
  of all UK departments. It never counts alone. The worker gives C to F. A party to the conflict is
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
  build. `pnpm worker reference-set add` stores the authors of a file that the set does not hold
  yet, and the operator approves them as before. It keeps an author that the set holds, and it
  names each field whose value in the record is not the value of the file, because a letter is
  written once. It refuses a name that the worker rated, because the rated author stands: the
  operator gives the new author another name, approves it, and moves the rated names to it. So
  an author that the worker rated too low (GLEIF was C) becomes A with a new reference author and
  a move, and no row changes. `pnpm worker reference-set sites` gives the sites of the file to
  each author of a stored set that has none. The sites of an author are written once, like its letter. Until the approval, a reference author is no author for any reader, and a rating job
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

### The pair of a claim

ADR 0016 gives the NATO pair of a claim, which reads the digit and the support of the rules.

### The rules

- The rules of S3 run **in the database**, as one function. Every writer gets the same decision,
  and no machine role can call this function in place of a rule. An AI reviewer decides through the
  MCP server as a separate act, with its own origin "decided by an AI reviewer" (ADR 0010, #376).
- The function runs on a unit when its acts are written, when the check by the second model ends,
  when one of its authors gets a letter, when a name joins a known author, when the operator
  decides a joined name, and when a new act cites a new source for one of its facts.
- The **first rule that matches** decides: impossible, doubt, reference dataset, strong sources, weak sources.
- **Doubt** holds the cases of S3 (`decisions.md`). A contradiction from an author F is not a doubt:
  the unit waits, and the card shows the conflict.
- **Reference dataset** accepts a row of a promoted mapping when the operator approved the edition of
  its dataset as a reference dataset. The approval is one act for one edition of one named dataset
  (the first is GEM, for its letter and its sites), and it is written once. The rule needs no
  second source and no check by a second model, because a loaded row has none. A value that
  disagrees with the record is a doubt, and the Doubt rule runs first. A loaded row finds its
  entity by an identifier before its name, and a row that finds it by its name only is a doubt,
  because two entities can share a name. The origin of the decision
  is "reference dataset <name>, approved by the operator", so the public text says that GAB did not
  check the fact. The author of each loaded row is the publisher of the table.
- **Strong sources** need, for each fact of the unit, a passed check and either one source A on a
  site of its author, or two independent citations with one author B or better and one C or
  better. An upload is on the site of the address where the file comes from.
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
  nothing: it stores pages, the extraction proposes, and the rules decide again. The budget is the
  one stop of a search, so a search that stops at its budget has ended, with no new source. A
  search that fails for another reason has not ended, and it rejects nothing. When the search
  and the extraction of its pages have ended, a unit whose only sources are D or E is rejected by
  the rule, with its origin. Any other unit keeps waiting, because a source can come later.

### The trust boundary

- The rules trust the worker process and the MCP server of the research session. The database
  checks only the form of the second check: the two family names differ. The process gives both
  names, and the agent role also gives the originator, the model call and the letters C to F.
- Each check door checks the acts of one author role. The worker role checks the acts of the
  worker. A checker role checks the acts of the research role, and records the model call of each
  check. It writes nothing else. So the worker role cannot check a research act, and the research
  role writes no check.
- The research AI holds the password of the research role, and not the password of the checker
  role. The MCP server reads that password from the environment file of the stack. The settings of
  the research workspace refuse a read of that file to Claude Code. A session at the root of the
  repository also starts the MCP server, but its settings do not refuse that read. So start Claude Code
  for research only in the research workspace.
- These rules make a false check of a research fact much harder, but not impossible. The AI and
  the server run as the same user of the operating system on the operator's PC. Codex has no rule
  that refuses the read of one file.
- The second check defends against the blind spots of a model. It does not defend against a worker
  or a server that is hostile or broken.
- A check belongs to the act, and the act can gain a citation later: a batch that repeats a
  waiting act adds its citations to that act. So a check can stand on an act with a citation that
  the checker did not read. The author of a citation is the author of its act, so only a change
  of the same author, with the same modality and no words read from an image, joins. Such a
  citation adds no independent author and no support. A new entity never joins, because a label
  does not identify a unit. An item of another author is a second act, with its own letter and
  its own check. When one of the two is promoted, the other is closed as a duplicate if it is
  alone in its unit, and the row takes its documents.

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
