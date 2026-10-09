# Gabriel — Product rules

The operator owns this document (`authoring.md`). Each entry gives one product rule, its reason and
its cost. An identifier (C4, M8, P1) names an entry, and the code and the other documents can cite
it. The build decisions are in the ADRs.

| ID | Rule | Group |
|---|---|---|
| C1 | The requirements come first, the technology second | Framing |
| C2 | The reference user is one real operator | Framing |
| C3 | The spec follows the analyst workflow; the exclusion list is a deliverable | Framing |
| C4 | A capability must multiply investigative capacity | Framing |
| C5 | One operator, no authentication, no roles | Framing |
| C6 | One project; no project partition | Framing |
| C7 | The old corpus is rebuilt, not carried over | Framing |
| M1 | No FollowTheMoney | Data model |
| M2 | Typed fields for what connects, free attributes for what describes | Data model |
| M3 | An occurrence is a relation or an attribute, not a node | Data model |
| M4 | A relation can point at a relation | Data model |
| M5 | The graph is the present state; no history, no query by date | Data model |
| M6 | A date is provenance, or a bound on a claim that changes hands | Data model |
| M7 | One shape for every attribute: a value and its sources | Data model |
| M8 | A source is never absent; a machine never cites the operator's authority | Data model |
| M9 | A value is never null or blank; the unknown is an absent key | Data model |
| M10 | The unit is in the key name | Data model |
| M11 | No attribute registry; a monitoring view instead | Data model |
| M12 | An entity merge is reversible | Data model |
| S1 | The NATO letter rates the author, the digit rates the fact, and each is judged apart | Sources and trust |
| S2 | The source is listed at entity, relation and attribute level | Sources and trust |
| S3 | Named rules decide from the sources; the operator decides the doubts | Sources and trust |
| S4 | The origin of each decision is stored and published | Sources and trust |
| S5 | A claim speaks in GAB's voice only on strong evidence | Sources and trust |
| S6 | An allegation about a named person or company is attributed | Sources and trust |
| P1 | Two layers: the machine proposes, a promotion makes evidence | Pipeline and AI |
| P2 | A proposal is an operation, not a ghost entity | Pipeline and AI |
| P3 | Two review surfaces: a marker on the graph, and a queue | Pipeline and AI |
| P4 | The proposal contract is stable; agents and prompts are free | Pipeline and AI |
| P5 | Text formats and images; OCR is the first reading of an image | Pipeline and AI |
| P6 | One ingestion door; a structured file is mapped by a proposal | Pipeline and AI |
| P7 | Live search reads documents, the graph and the internet | Pipeline and AI |
| P8 | The text of a document goes to the model as it is | Pipeline and AI |
| P9 | Each AI claim cites a page and an excerpt that code checks | Pipeline and AI |
| P10 | A lead agent finds and stores sources, and proposes nothing | Pipeline and AI |
| P11 | One entity with its relations is the unit of decision | Pipeline and AI |
| P12 | The operator AI proposes the facts of a research layer | Pipeline and AI |
| PU1 | The app is public, with clear labels | Publication |

---

## Framing

### C1 — The requirements come first

**Rule.** Define the requirements first, the technology second.
**Why.** Version 1 grew by small additions with no general view. Starting from the technology would
repeat that.

### C2 — The reference user is one real operator

**Rule.** Gabriel is for one real operator, not for a team or a market.
**Why.** "Any OSINT team" makes every feature defensible and none a priority. A real user is the
only filter that cuts.
**Cost.** Open-source publication only constrains the form (standard formats, no closed
dependency).

### C3 — The spec follows the analyst workflow

**Rule.** The PRD follows the real sequence of work, and marks each step as in or out of Gabriel.
**Why.** A feature list has no exclusion criterion. A workflow has one.
**Cost.** The list "what Gabriel does not do" is a deliverable.

### C4 — A capability must multiply investigative capacity

**Rule.** A capability that does not multiply investigative capacity in the project horizon is out
of scope.
**Why.** One criterion stops case-by-case decisions, which is how scope drifts.
**Cost.** This criterion wins over elegance, completeness and generality.

### C5 — One operator, no authentication

**Rule.** One person edits. An external contribution enters as a source document, not as a user.
**Why.** Accounts, roles and permissions for one user are pure cost.
**Cost.** No login, no roles, no real-time collaboration.

### C6 — One project

**Rule.** The data model has no notion of a project.
**Why.** No second project exists, and a partition made in advance touches every table and query.
**Cost.** A second project later is a real migration.

### C7 — The old corpus is rebuilt

**Rule.** The structure starts again with no debt. The 1,000+ old entities are migrated later.
**Why.** The material has value; the structure that carried it does not.
**Check.** A sample of old entities must fit the new model.

---

## Data model

### M1 — No FollowTheMoney

**Rule.** No FTM model and no FTM export.
**Why.** FTM has no geometry type, and the map is central. PostGIS does what FTM cannot.
**Cost.** No direct exchange with OpenSanctions or Aleph.

### M2 — Typed fields for what connects, free attributes for what describes

**Rule.** There are entities and relations. What every row of a kind shares is a typed field. What
only one row says is a free attribute.
**Why.** A rigid shape bends the data, and a free shape stops correlation.
**Cost.** A search through free attributes is slower. This is acceptable at our volume.

### M3 — An occurrence is not a node

**Rule.** A transfer, a port call or a loading is a relation between the parties, or an attribute
of one of them.
**Why.** The graph is the present state (M5), so no node can stand for a moment.
**Cost.** An occurrence with three or more parties becomes several relations with no tie between
them.

### M4 — A relation can point at a relation

**Rule.** The end of a relation can be another relation.
**Why.** Two documents can disagree about one link, and the disagreement needs a place.
**Cost.** The database cannot use a plain foreign key for such an end, so the write path guards it.

### M5 — The graph is the present state

**Rule.** No change history, and no query "as of a date".
**Why.** A time model costs more than it gives with our resources.
**Cost.** The graph cannot prove that an asset belonged to X and then to Y. The documents prove a
sequence.

### M6 — A date is provenance, or a bound

**Rule.** The system stores a date for two reasons only: when a source was read, or the bounds of a
claim that can change hands (who owns a thing, who a thing is).
**Why.** A dead link proves nothing without the date it was read. A bound on ownership records the
transfer after a designation.
**Cost.** No time query. A date can still be the value of an attribute, as a sourced claim.

### M7 — One shape for every attribute

**Rule.** An attribute is a value and the sources of that value, always in that one shape.
**Why.** One shape gives one code path and one rule.
**Cost.** A value that needs depth is an entity or a relation.

### M8 — A source is never absent

**Rule.** Each attribute cites at least one source. The operator can cite their own authority
through a reserved source. A machine never can, and always cites a real document.
**Why.** "Everything is sourced" does not survive a silent exception. A machine cannot make an
unsupported claim.
**Cost.** All that stands on the operator's word alone is one query away.

### M9 — A value is never empty

**Rule.** A value is never null and never a blank string. The unknown is an absent key.
**Why.** Two ways to say "we do not know" give two query behaviours and two bugs.
**Cost.** "Not filled" and "searched and not found" look the same. An explicit key can say the
second.

### M10 — The unit is in the key name

**Rule.** For example `coal_stock_t`, not `coal_stock` with a unit field.
**Cost.** A change of unit makes a new key.

### M11 — No attribute registry

**Rule.** No list of allowed keys. A monitoring view shows the keys by type.
**Why.** A registry is work for a need nobody showed (C4).
**Cost.** Three spellings of one key can live side by side. The view shows this; it does not stop
it. This becomes weak when an agent writes at volume.

### M12 — An entity merge is reversible

**Rule.** A merge keeps the identifier and a full copy of the entity it absorbs.
**Why.** Identity resolution will make wrong merges.
**Cost.** None of note. Old identifiers still resolve.

---

## Sources and trust

### S1 — The NATO letter rates the author, the digit rates the fact, and each is judged apart

**Rule.** GAB uses the NATO rating (STANAG 2511, from STANAG 2022). A letter from A to F rates the
reliability of the author: the person or the body that first gives the information. The letter never
rates the site or the medium that carries it. A copy of a text counts as its first author. A digit
from 1 to 6 rates the credibility of one fact, never of a document. NATO judges the two apart, so
the digit never reads a letter: it comes from the number of independent authors that give the fact
and from the conflicts between the values that its sources give. A rule can read both marks after they are
judged. Each citation shows its pair to the operator, for example "B1".

- **A** is only for the issuer of an official record, on its own record: a register, a gazette, a
  court, a sanctions act.
- **A and B** come only from the reference set, which the operator approves.
- **A party to the conflict**, of either side, is B at most, and only about its own side. About the
  other side it counts as C at most, so it never passes without an independent source B.
- **A new author** is F. A model rates it against the reference set, gives C to F, and names the
  reference authors that it compares with.
- **The reference set** holds about thirty authors, each with a letter and a reason. A strong model
  makes it once, and the operator reads and approves it once. This is one act of trust, not a letter
  for each author.

The machine gives every other letter, and code gives every digit. The public does not see the
letter or the digit.
**Why.** A document mixes facts and rumours, so one grade per document is false. The author is the
thing that knows. NATO forbids that the reliability of a source changes the credibility of an item,
because a good source can be wrong and a bad source can be right. One operator cannot rate each
author by hand, and a model has no track record of an unknown author, so it cannot give A or B.
**Cost.** A letter is the judgement of a model, and no person checks each one. A wrong reference set
moves every later letter. Few authors reach B, so few facts pass at the start.

### S2 — The source is listed at each level

**Rule.** An entity and a relation carry a list of sources for their typed fields (name, type,
position, ends, dates). Each attribute carries its own sources. A promotion that changes a typed
field replaces the list of that row.
**Why.** The typed fields need a source, and one list per field costs too much.
**Cost.** The row list does not say which typed field each source supports.

### S3 — Named rules decide from the sources; the operator decides the doubts

**Rule.** The machine reads, checks and proposes. Named rules accept or reject a unit with no click
of the operator. The operator decides only the doubtful units. Code applies the rules in this
order to each unit, and the first rule that matches decides:

1. **Impossible.** The unit cannot be written: a link to a rejected element, or a link to itself.
   The rule rejects it.
2. **Doubt.** Two readings disagree, two values differ, a duplicate, an unknown type, a claim that
   the operator rejected before, a check by the second model that disputes a fact, a denial by the
   subject of a fact, or an adverse claim of a type on a fixed list about a named person or company
   (S6). The unit goes to the operator, with the reason.
3. **Strong sources.** A model of a second family found each fact in its passage, and each fact
   has either one source A on its own record, or two independent sources: one B or better and one
   C or better. Two sources are independent only when they have different authors, different
   controllers (one state, one holding or one channel network counts as one author), different
   sites, and passages that are not copies of each other. When code is not sure, the two sources
   count as one author. A source that only reports what another party says never counts. The rule
   accepts the unit.
4. **Weak sources.** All other units wait for a better source, and the operator does not see them
   in the queue. A deepening search can look for a better source (P10). When a new source comes,
   the unit goes through the rules again. A unit whose only sources are D or E, after the
   deepening search, is rejected. Any other unit is kept and never rejected, because a source can
   come later.

The threshold starts strict. The operator relaxes it later, from real data. No model decides the
state of a unit: a model gives a letter (S1), and code applies the rules. A contradiction from an
author F is not a doubt: the unit waits.
**Why.** A queue of every claim makes one person the bottleneck and cancels the gain. A rule on
the sources is simple, and anyone can audit it.
**Cost.** At the start few units pass, because most facts have one source. Two models can share a
blind spot. The public text says that the accuracy of the rules is not measured.

### S4 — The origin of each decision is published

**Rule.** Each decision records who or what decided it: a named rule, "validated manually by the operator", or "decided by an AI reviewer". Each public claim shows this origin. A machine never decides in the name of the
operator.
**Why.** A machine decision shown as a human one would destroy trust. Declared, it stays
defensible.

### S5 — GAB's voice needs strong evidence

**Rule.** A claim goes public in GAB's own voice only when an official record, a verified
observation, or audited independent first-hand sources support it. Each other public claim is
attributed to its source: "according to X". A rule of S3 fills the evidentiary layer, and never
gives GAB's voice. All public text comes from fixed templates; no free text from a model goes
public. Every automatic path to GAB's voice is closed. A path opens only after the operator audits
it with hand checks.
**Why.** A wrong claim in GAB's voice costs more than a slow claim.
**Cost.** At the start, the operator decides each claim in GAB's voice.

### S6 — An allegation about a named subject is attributed

**Rule.** An adverse allegation about a named person or company is always attributed. Before it
goes public, GAB searches for a public response from the subject. GAB never contacts the subject.
**Why.** Fairness, and the legal risk of a public allegation.
**Cost.** Each such claim needs a search before it goes public.

---

## Pipeline and AI

### P1 — Two layers

**Rule.** The machine writes freely into the candidate layer. Nothing reaches the evidentiary layer
without a promotion: by the operator, by a named rule (S3), or by an AI reviewer (#376).
**Why.** Correlation has value only when it casts a wide net at no cost per result. Evidence has
value only when nothing enters it without a check.
**Cost.** If the sources stay weak, the evidentiary layer fills slowly.

### P2 — A proposal is an operation

**Rule.** The candidate layer is a list of proposed operations (create, change, link, merge), not a
copy of the graph.
**Why.** A copy of the graph means two schemas to keep equal.
**Cost.** The UI draws candidates as ghost nodes itself.

### P3 — Two review surfaces

**Rule.** A proposal shows as a marker on the graph, and in a queue.
**Why.** Two real uses: look at one element, or clear a batch.

### P4 — The proposal contract is stable

**Rule.** The shape of a proposal is fixed: target, operation, value, sources, author, and the
readings that disagree.
Agents, models and prompts can change freely.
**Why.** It is the interface between a changing layer and a database that must last.
**Cost.** A proposal of the wrong shape is refused, also from an agent.

### P5 — Text formats and images

**Rule.** Text PDF, docx, txt, md, html, csv, and a PNG or JPEG image. No audio, no video. The first
reading of an image is OCR, and a proposal cites an excerpt of that text. When the OCR text does not
hold what the image shows, the research AI cites the words that it read from the image itself. Such
a proposal is always disputed. A back-end agent reads the stored text only, so it never cites words
read from an image. The image bytes stay the stored source. The review page shows the image next to
the excerpt, and says when the AI read the words.
**Why.** Each new format is a new pipeline to build and keep. An investigative source, for example a
unit tree of Tochnyi, publishes its facts as an image only. Its OCR text mixes the columns of the
tree and misreads the unit numbers, so it does not state the parent of a unit (operator decision,
9 October 2026).
**Cost.** OCR and the AI can each misread a character, so the operator compares the excerpt with the
image before a promotion. A scanned PDF is converted outside the tool first.

### P6 — One ingestion door

**Rule.** Every file enters through one door, which stores the raw file, records its source and its
retrieval date, and queues the work. A text file goes to extraction. A structured file goes to a
mapping: the model reads the header and a small sample, and proposes how the columns map. After the
operator promotes the mapping, code loads every row with no model.
**Why.** A file from the internet has arbitrary columns. Fitting them is judgement, and judgement by
a machine is a proposal (P1). One door means no file without a source.
**Cost.** A structured import needs one operator decision.

### P7 — Live search reads three places

**Rule.** The local documents, the graph and the internet.
**Why.** The operator asks a question and gets an answer wherever the material is.

### P8 — The text goes to the model as it is

**Rule.** The stored text of a document goes to the model as it is. Code masks nothing before a
model call.
**Why.** The documents are public sources, and the names in them are the data that the extraction
needs. A minimiser blocked every extraction.
**Cost.** OpenRouter and the providers that it routes to see the full text of each document, contact
details included. The routing asks each provider to keep no prompt and to train on none.

### P9 — Each AI claim cites a checked excerpt

**Rule.** When an AI proposes a claim, it gives the page and a verbatim excerpt for each value.
Code finds the excerpt in the stored text. An excerpt that is not in the document refuses the
claim. A value in another form of the same value (a date, a number, a case) passes. A value that is
different or ambiguous marks the claim as disputed, and the review card says why. The stored record
cites the document.
**Why.** A model can cite a document that does not say the claim. Code can prove that the passage
is there.
**Cost.** A claim with a wrong excerpt goes back to the model, and after one retry it is lost.

### P10 — A lead agent finds sources and proposes nothing

**Rule.** The operator, Claude or Codex gives a lead, or a rule of S3 gives a deepening search for
a unit with weak sources. An AI inside Gabriel searches, fetches and stores pages with no page
limit, and queues their extraction. It proposes nothing and starts no lead of its own. A token
budget stops each lead. The operator sets the budget of the deepening searches; until then, no
deepening search runs. No lead runs on a schedule.
**Why.** The search for sources is the slow part of an investigation, and the extraction and the
rules stay the checks. A weak source is a signal to check, not a fact to reject.
**Cost.** A broad lead can store many pages. Each deepening search spends model credit.

### P11 — One entity with its relations is the unit of decision

**Rule.** An AI can propose linked facts in one group: for example a company, its vessels and the
links between them. A rule or the operator decides one entity together with the relations that
depend on it. One promotion writes them together, or writes none. The group is a label and a
filter, and not a unit. A relation is never promoted without its two entities: each end is
already in the record, or it is promoted in the same decision. A unit whose end waits in another
group waits until that end is decided. A relation is part of one unit only, so an entity never
waits for a relation. On a group, the operator can promote all its clean units at once.
**Why.** The graph never holds a link to a missing entity, and one wrong item never forces the
rejection of a whole group.
**Cost.** A unit with many relations takes long to read. A relation between two groups needs two
steps.

### P12 — The operator AI proposes the facts of a research layer

**Rule.** In a research session, Claude or Codex finds the sources of its layer, stores each one,
and proposes each fact of the layer itself, with the page and a checked excerpt (P9). Each source is
a stored document before it is cited. The back-end extractor and the lead agent run only when the
operator asks for them, or when a rule starts a deepening search (P10). The session writes with no approval of each write, except a write that
spends model credit. The rules of S3 decide each proposal, and the operator decides the doubts. A
source that the session cannot store goes on a list of needs that tells the operator what to get.
**Why.** A research layer needs a few targeted facts, and the extractor proposes each claim of a
document, also the claims outside the layer. A method skill tells the operator AI what to propose
and what to leave out, so that the queue holds facts that are ready to promote.
**Cost.** The research uses the tokens of the operator's own subscription. A wrong fact with strong
sources can pass a rule with no person reading it.

---

## Publication

### PU1 — The app is public, with clear labels

**Rule.** The app is publishable, with the candidate layer. Held and rejected claims are not
public. Each candidate claim shows a visible label with its origin.
**Why.** The operator's decision, with the risks known.
**Risks.** A subject can follow the investigation. An unverified claim about a named company or
person is exposed (legal and GDPR risk).
**Mitigations.** The labels. No personal data on a person beyond what a cited source already
publishes. A unit stays hidden until it has its own citation. Each page gives the visitor "Report
an error" and "Right of reply".
**Accepted.** Every name that a cited source gives can be public. The operator accepts the legal
risk of an anonymous publisher.
**The label (9 October 2026).** The label tells who decided a claim, in fixed words: "Proposed —
not checked", "Accepted by rule <name> v<n> — no person read it", "Accepted by an AI reviewer —
no person read it", "Validated manually by the operator". It shows no NATO letter and no rating digit (S1).
- On a screen, the origin shows one time for each entity. On a claim, a number points to the
  source card. This pointer is enough.
- The label is part of the public data, not only of the screen. Each public claim carries it, each
  export copies it, and each export file holds the disclaimer of the dataset. The label must
  survive export and reuse.
- The entity detail screen has no disclaimer of its own. The labels are enough.
- An attribute key stays free (M11). A screen shows its readable name only by a fixed rule: each
  underscore becomes a space, and the first letter becomes a capital.
- A fact about a person is public only when at least one of its cited sources is a public
  document. A bought file, or an upload with no address, does not make a fact about a person
  public.
- A file that the operator uploads comes from the Internet. It must carry the address where it
  comes from, and with this address it is a public document. The upload refuses a file with no
  address, and asks the operator where the file comes from. An older upload with no address is
  not public. An upload stored before this ruling is not public, also with an address, because
  its address can be the page where the file was bought. A public API, such as OpenSanctions, is
  a public source. A bought file stays not public. The private data repository is not a source.
