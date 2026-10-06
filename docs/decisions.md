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
| S1 | A rating rates the originator of the information, and only that | Sources and trust |
| S2 | The source is listed at entity, relation and attribute level | Sources and trust |
| S3 | The machine prepares; the operator decides by exception | Sources and trust |
| S4 | The origin of each decision is stored and published | Sources and trust |
| S5 | A claim speaks in GAB's voice only on strong evidence | Sources and trust |
| S6 | An allegation about a named person or company is attributed | Sources and trust |
| P1 | Two layers: the machine proposes, a promotion makes evidence | Pipeline and AI |
| P2 | A proposal is an operation, not a ghost entity | Pipeline and AI |
| P3 | Two review surfaces: a marker on the graph, and a queue | Pipeline and AI |
| P4 | The proposal contract is stable; agents and prompts are free | Pipeline and AI |
| P5 | Text formats only; OCR only as a second reading | Pipeline and AI |
| P6 | One ingestion door; a structured file is mapped by a proposal | Pipeline and AI |
| P7 | Live search reads documents, the graph and the internet | Pipeline and AI |
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

### S1 — A rating rates the originator

**Rule.** A rating rates the originator of the information only. It never rates a platform, a
domain, a document or a type of claim. A new source starts with no basis to judge. Only its record
of claims that later evidence settled can change its rating; the agreement of other media never
does. The public does not see the rating.
**Why.** A document mixes facts and rumours, so one grade per document is false. The originator is
the thing whose record we can measure.
**Cost.** A new source is weak until it has a record.

### S2 — The source is listed at each level

**Rule.** An entity and a relation carry a list of sources for their typed fields (name, type,
position, ends, dates). Each attribute carries its own sources. A promotion that changes a typed
field replaces the list of that row.
**Why.** The typed fields need a source, and one list per field costs too much.
**Cost.** The row list does not say which typed field each source supports.

### S3 — The machine prepares, the operator decides by exception

**Rule.** The machine reads, checks and proposes. The operator looks only at the doubtful cases.
No model writes a rating, a public state or an audit label: only code and the operator do.
**Why.** A queue of every claim makes one person the bottleneck and cancels the gain.
**Cost.** Two similar models can share a blind spot. Until an audit measures a path, the public
text says that its accuracy is not measured.

### S4 — The origin of each decision is published

**Rule.** Each public claim shows who or what decided it: the operator, or a named rule.
**Why.** A machine decision shown as a human one would destroy trust. Declared, it stays
defensible.

### S5 — GAB's voice needs strong evidence

**Rule.** A claim goes public in GAB's own voice only when an official record, a verified
observation, or audited independent first-hand sources support it. Each other public claim is
attributed to its source. At launch, every automatic path to GAB's voice is closed. A path opens
only after the operator audits it with hand checks.
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
without a promotion: by the operator, or by an audited rule (S5).
**Why.** Correlation has value only when it casts a wide net at no cost per result. Evidence has
value only when nothing enters it without a check.
**Cost.** Promotion is the central action. If review is slow, the evidentiary layer stays empty.

### P2 — A proposal is an operation

**Rule.** The candidate layer is a list of proposed operations (create, change, link, merge), not a
copy of the graph.
**Why.** A copy of the graph means two schemas to keep equal.
**Cost.** The UI draws candidates as ghost nodes itself.

### P3 — Two review surfaces

**Rule.** A proposal shows as a marker on the graph, and in a queue.
**Why.** Two real uses: look at one element, or clear a batch.

### P4 — The proposal contract is stable

**Rule.** The shape of a proposal is fixed: target, operation, value, sources, confidence, author.
Agents, models and prompts can change freely.
**Why.** It is the interface between a changing layer and a database that must last.
**Cost.** A proposal of the wrong shape is refused, also from an agent.

### P5 — Text formats only

**Rule.** Text PDF, docx, txt, md, html, csv. No audio, no video. OCR runs only as a second reading
of a stored image, never as the first.
**Why.** Each new format is a new pipeline to build and keep.
**Cost.** A scanned document is converted outside the tool first.

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

---

## Publication

### PU1 — The app is public, with clear labels

**Rule.** The app is publishable, with the candidate layer. Held and rejected claims are not
public. Each candidate claim shows a visible label with its origin.
**Why.** The operator's decision, with the risks known.
**Risks.** A subject can follow the investigation. An unverified claim about a named company or
person is exposed (legal and GDPR risk).
**Mitigations.** The labels. No personal data on a person beyond what a cited source already
publishes. A correction and right-of-reply process.
