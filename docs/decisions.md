# Gabriel — Decision Register

**Version** 1.2 · 24 August 2026
One entry per locked decision: what is decided, why, what it costs.
This document is the project's memory. Any future decision that contradicts an entry here must replace it explicitly, not work around it.

**Read one entry, not the whole file.** The table below gives each identifier in one line.
Find the identifier you need, then read that entry only.

An identifier in `spec.md` or `prd.md` always names a row of this table. The
workflow steps of `prd.md` §3 use the prefix `W`, so that they cannot be confused with the
`S` entries here.

## Index

| ID | Decision | Group |
|---|---|---|
| C1 | The framing phase delivers a requirements spec, not a tech stack | Framing |
| C2 | The reference user is one real operator, not a team and not a market | Framing |
| C3 | The spec is anchored on the analyst workflow; the exclusion list is a deliverable | Framing |
| C4 | Single arbitration criterion: a capability must multiply investigative capacity | Framing |
| C5 | Single operator, no authentication, no roles | Framing |
| C6 | Multi-project support is theoretical; no `project_id` | Framing |
| C7 | The existing corpus is rebuilt, not carried over | Framing |
| M1 | FollowTheMoney is abandoned; it has no geometric type | Data model |
| M2 | Two tables: typed for what connects, free for what describes | Data model |
| M3 | An occurrence is not an object | Data model |
| M4 | A relation can be the end of a relation, from the first day | Data model |
| M5 | Current-state model, no versioning, no query as of a date | Data model |
| M6 | A date is provenance, or a bound on a claim that changes hands | Data model |
| M7 | One shape for every attribute: a value, and the sources of that value | Data model |
| M8 | A source is never absent; a person may cite their own authority, a machine may not | Data model |
| M9 | A value always exists; the unknown is the absence of a key | Data model |
| M10 | The unit is carried by the key name, such as `coal_stock_t` | Data model |
| M11 | No attribute registry; a monitoring view instead | Data model |
| M12 | Entity merges are reversible | Data model |
| S1 | ADMIRALTY is scored at the document, never at the claim | Sources and scoring |
| S2 | The source is listed at entity, relation and attribute level | Sources and scoring |
| S3 | Automated scoring; the operator validates by exception only | Sources and scoring |
| S4 | The origin of every rating is stored and published | Sources and scoring |
| P1 | Two layers: the machine writes candidates, the operator promotes | Pipeline and AI |
| P2 | Proposals are operations, not ghost entities | Pipeline and AI |
| P3 | Dual review surface: a graph marker, and a queue | Pipeline and AI |
| P4 | The proposal contract is frozen; agents and prompts stay free | Pipeline and AI |
| P5 | Ingestion formats: extractable text only, no OCR, no audio, no video | Pipeline and AI |
| P6 | One ingestion door; structured data is mapped by proposal | Pipeline and AI |
| P7 | Live search queries three substrates: documents, graph, internet | Pipeline and AI |
| PU1 | Everything is public, candidate layer included | Publication |
| T1 | TypeScript end to end | Technical |
| T2 | PostgreSQL/PostGIS is the single GOLD datastore | Technical |
| T3 | Binary split: MinIO holds raw, PostgreSQL holds GOLD | Technical |
| T4 | The frontend reads on its own; the backend serves writes only | Technical |
| T5 | Qdrant and NATS are deferred; pgvector and a job table replace them | Technical |
| T6 | Two-tier validation: Zod at the boundary, `CHECK` in the database | Technical |
| T7 | Frontend framework choice — **replaced by ADR 0004** | Technical |
| T8 | Cartographic library — **replaced by ADR 0005** | Technical |

---

## Framing

### C1 — The deliverable of the framing phase is a requirements spec, not a tech stack

**Decision.** Define the requirements first, the technology second.
**Why.** v1 drifted through incremental accumulation with no overall vision. Restarting from the technology would have replayed the same mechanism.
**Consequence.** The stack was settled in a second pass, once the requirements had been decided. The two documents remain separate.

### C2 — The reference user is an internal investigation instrument

**Decision.** Gabriel is specified for a single, real operator — not for a hypothetical team, and not for a market.
**Why.** Specifying for "any OSINT team" makes every feature defensible and none prioritisable. A user who is actually present is the only filter that cuts.
**Consequence.** Open-source publication becomes a constraint on form (standard formats, no structural proprietary dependency), not a source of requirements. The product dimension is out of scope.

### C3 — The spec is anchored on the analyst workflow

**Decision.** The backbone of the PRD is the real sequence of work, with each step marked as inside or outside Gabriel.
**Why.** A feature list has no exclusion criterion. A workflow has one: the step either exists or it does not, and it is either in the tool or outside it.
**Consequence.** The "what Gabriel does not do" list is a first-class deliverable, not an appendix.

### C4 — Single arbitration criterion: capacity multiplier

**Decision.** Any capability that does not multiply investigative capacity within the project's horizon is out of scope.
**Why.** A single, enforceable criterion avoids case-by-case arbitration, which is the mechanism of drift.
**Consequence.** This criterion takes precedence over technical elegance, exhaustiveness and generality.

### C5 — Single operator, no authentication

**Decision.** One person edits. External contributions enter as source documents, not as users.
**Why.** Real usage is single-operator. Building accounts, roles and permissions for one user is pure cost.
**Consequence.** No auth, no RBAC, no real-time collaboration, no edit-conflict handling. An external contribution is attributed through the document, not through the account.

### C6 — Multi-project support is theoretical

**Decision.** The system is single-project in practice. The notion of a project does not structure the data model.
**Why.** No second project exists. Partitioning built in advance contaminates every table and every query.
**Consequence.** No `project_id` column, no cross-cutting filtering. Introducing it later will be a real migration — a cost accepted in exchange for an immediate simplification of the entire schema.

### C7 — The existing corpus is rebuilt, not carried over

**Decision.** The structure is rethought without debt. The 1000+ existing entities will be migrated afterwards.
**Why.** The material collected has value; the structure carrying it does not.
**Consequence.** Validation safeguard: a sample of v1 entities must be shown to be representable in the target model before that model is frozen.

---

## Data model

### M1 — FollowTheMoney is abandoned

**Decision.** No adoption of FTM, no FTM export mapping.
**Why.** FTM has **no geometric type** — the 20 available property types include neither point, nor polygon, nor coordinates ([reference](https://followthemoney.tech/explorer/types/)). Yet the cartographic pillar is central. PostGIS handles natively what FTM cannot express.
**Accepted consequence.** Loss of immediate interoperability with OpenSanctions and Aleph, which produce and consume FTM. Any external reuse of the dataset will require conversion work, to be written later if the need arises.

### M2 — Two tables, and one line through them

**Decision.** An entity table and a relation table. Each row carries typed columns for what every row of its kind shares, and free attributes for what only that row says.
**Why.** A rigid shape makes the data bend to fit. A completely free shape makes correlation impossible. The line falls in the correct place when what connects is typed, and what describes is free.
**Consequence.** A free attribute is not indexed one by one. A search through the attributes is slower than a search on a column. This is accepted at the volumes of this project.

### M3 — An occurrence is not an object

**Replaces the earlier M3**, which made an event an entity.
**Decision.** A transfer, a port call or a loading operation is a relation between the parties, or an attribute of one of them. No node stands for a moment.
**Why the earlier entry was wrong.** Its reason was that an event carries a date. M5 makes the graph a statement of the present, and M6 gives a date two meanings, of which neither is "when this occurred". The model thus has no place for the one thing that made an event an object, and no query that would read it.
**Accepted cost.** An occurrence with three or more parties has no single shape. It becomes two or more relations, and nothing ties them together. A shape for occurrences is a later decision, and it is a real migration.

### M4 — Minimal reification of relations

**Decision.** A relation can be the end of another relation. The schema carries this from the first day, and nothing uses it yet.
**Why.** The real case is **contradiction between claims**: two documents assert incompatible things about the same link, and the exception mechanism rests entirely on dissent — it needs somewhere to record it. Today it is carried and unused; in six months it is a migration over tens of thousands of rows.
**Consequence.** An end that can point at two kinds carries no foreign key. Its integrity is held by a guard on the write path, which is weaker than a constraint that the engine owns.

### M5 — Current-state model, no versioning

**Decision.** The graph describes the present state. No modification history, no "as of date T" query.
**Why.** The cost of a temporal or bi-temporal model — modelling, queries, data-entry ergonomics — exceeds the value it brings given the resources available.
**Accepted consequence.** It is impossible to demonstrate by query that an asset belonged to X at the time of a fact and then to Y afterwards. Any demonstration of sequence rests on the documents, not on the graph.

### M6 — A date is provenance, or a bound

**Replaces the earlier M6**, which counted places instead of giving a rule.
**Decision.** The system stores a date for one of two reasons. It says when a source was read. Or it bounds a claim that can change hands, such as who owns a thing, or who a thing is. The system stores no date to record when something occurred.
**Why.** Without the date a source was read, a link that has died proves nothing. That is provenance, and not a model of time. A bound on ownership documents the transfer that follows a designation, which is a central object of the investigation, for the cost of one optional field.
**Consequence.** These dates describe. They make no temporal query, and they give back nothing that M5 gives up. Which claims take a bound is a question for the schema, and the schema answers it.
**The one way that is left.** A date can also be the value of an attribute, because an attribute takes any value. Such a date is a claim like any other, and M7 and M8 govern it, not this entry. M5 still refuses to query it.

### M7 — One shape for every attribute

**Decision.** An attribute is a value, and the sources of that value, always in that one shape. There is no short form, no third part, and no depth in the value.
**Why.** One shape gives one code path, one rule to validate, and one behaviour on a write. A value that needs depth shows that an entity or a relation was necessary, and not an attribute.
**Consequence.** It is long to write. The interface writes it, and the database refuses each other shape.

### M8 — A source is never absent

**Decision.** Every attribute cites a minimum of one source. A person who asserts on their own authority cites a source reserved for that purpose. **A machine must not use that reserved source**, and must cite a real document.
**Why.** The "everything is sourced" invariant does not survive a silent exception. The machine/human asymmetry prevents the AI from creating unsupported claims while making explicit what a human has asserted on their own authority.
**Consequence.** The reserved source is a source like any other. It can be scored, and everything that stands on the authority of the operator alone is one query.

### M9 — A value always exists; the unknown is the absence of a key

**Decision.** `v` is never null. Information that is not known is expressed by the absence of the key.
**Why.** Two ways of saying "we don't know" produce two query behaviours and two bugs.
**Consequence.** It is impossible to distinguish "not filled in" from "searched for and not found". If that need arises, it will have to go through an explicit key, not through a null.

### M10 — The unit is carried by the key name

**Decision.** `coal_stock_t`, not `coal_stock` with a unit field.
**Why.** Zero cost, zero ambiguity, no schema complexity.
**Consequence.** A change of unit creates a new key and manual reconciliation work.

### M11 — No attribute registry

**Decision.** No attribute-definition table, no key allowlist.
**Why.** The registry is work done ahead of an undemonstrated need, contrary to C4.
**Accepted consequence.** Nothing prevents `coal_stock`, `coalStock` and `coal_stock_tonnes` from coexisting on three entities of the same type, all three valid, rendering the graph silently unusable. Mitigation adopted: a monitoring view of keys by type, reviewed periodically. It makes the problem visible; it does not prevent it. This safeguard becomes insufficient as soon as an agent writes at volume.

### M12 — Entity merges are reversible

**Decision.** A merge keeps the identifier of the entity it absorbs, and it keeps a full copy of everything that entity held.
**Why.** Identity resolution will produce erroneous merges. Without a snapshot, a merge is a permanent loss of information.
**Consequence.** Historical identifiers remain resolvable; no external link breaks after a merge.

---

## Sources and scoring

### S1 — ADMIRALTY is scored at the document, not at the claim

**Decision.** One score per document. No score at claim level.
**Why.** Scoring every claim is unmanageable given the resources available.
**Accepted consequence.** The **reliability (A–F)** axis is handled correctly: it is a property of the source. The **credibility (1–6)** axis is not: a single document contains a corroborated fact and a rumour, and they receive the same score. **The dataset must present the scoring as a source score, never as a claim score.** Any presentation to the contrary would be false.

### S2 — The source is listed at entity, relation and attribute level

**Decision.** The entity and the relation each carry a list of sources. Each attribute carries its own sources in addition.
**Why.** A list on the entity alone cannot say which source carries which figure, and the figure is what an opponent attacks. Sources on the attribute answer this for the cost of a convention, and with no added table.
**Consequence.** Postgres constrains nothing from inside a JSON document, so this integrity is not a foreign key. It costs a guard on the write path, and `spec.md` invariant 2 holds the rule.

### S3 — Automated scoring, human validation by exception

**Decision.** Scores are produced by a multi-agent arrangement designed to produce contradiction. The operator intervenes only in cases of dissent between agents or of confidence below threshold.
**Why.** An exhaustive validation queue bottlenecks the whole system on one person's attention, which cancels the multiplier effect.
**Accepted consequence.** Dissent detects disagreement between agents, **not the blind spot they share**: similar models trust the same laundered source and miss the same transliteration. Without a random audit sample — ruled out here — **no public claim about the accuracy rate of the scoring is defensible**. The dataset must state that the scoring is automated and unmeasured.

### S4 — The origin of every rating is stored and published

**Decision.** Machine, arbitrated or human, the origin accompanies the rating in the export.
**Why.** Automated scoring presented as human would invalidate the entire arrangement in the eyes of a peer. Declared, it remains defensible.
**Consequence.** None. It is one field.

---

## Pipeline and AI

### P1 — Two layers: candidate and evidentiary

**Decision.** The machine writes freely into the candidate layer. Nothing reaches the evidentiary layer without explicit promotion by the operator.
**Why.** Automatic correlation only has value if it can cast a wide net without costing a decision per result; the report only has value if nothing enters it without validation.
**Consequence.** Promotion is the central gesture of the workflow. The ergonomics of review determine the value of the entire system: if review is painful, the evidentiary layer stays empty.

### P2 — Proposals are operations, not ghost entities

**Decision.** The candidate layer is a table of proposed operations (create, modify, link, merge), not a copy of the graph.
**Why.** Duplicating the graph would mean maintaining two schemas and keeping them in sync. A proposal is a change, not an object.
**Consequence.** Displaying candidates as ghost nodes or links on the graph is client-side rendering work, not a structure in the database.

### P3 — Dual review surface

**Decision.** Proposals appear both as a marker on the graph, for review in context, and in a dedicated queue, for batch processing.
**Why.** The two modes correspond to two real uses: digging into one element, or clearing a batch.
**Consequence.** Two surfaces to build and to keep consistent.

### P4 — The proposal contract is stable, everything else is free

**Decision.** The format of a proposal is frozen: target, operation, value, mandatory sources, confidence score, emitting agent, dissenting votes. Agents, models, prompts and sequences can change without touching the schema.
**Why.** This is the interface between an unstable layer and a database that has to last.
**Consequence.** Any non-conforming proposal is rejected at the boundary, including one coming from an agent.

### P5 — Ingestion formats: extractable text only

**Decision.** Text PDF, docx, txt, md, html, csv. No OCR, no audio, no video.
**Why.** Each additional tier is a separate pipeline to build and maintain, for an undemonstrated gain.
**Consequence.** A scanned document must be converted outside the tool before ingestion.

### P6 — One ingestion door; structured data is mapped by proposal

**Replaces the earlier P6**, which sent GeoJSON, shapefile and structured CSV directly into the database, without the AI.
**Decision.** Every file enters through one operation, `put_document`. That operation writes the object to the raw store, writes the `documents` row with its source and its retrieval date, and queues the work. Behind that door there are two paths. A text file goes to extraction, chunking and the agents (P5). A structured file goes to a mapping step: the AI reads its schema and a sample of its rows, then emits a mapping **proposal**. The rows load in code, after the operator promotes that mapping. The model never reads the bulk of the file.
**Why the earlier entry was wrong.** It assumed that structured data arrives ready to load. A file collected from the internet has arbitrary column names, and fitting them to the M7 attribute contract is judgement, not transport. Judgement made by a machine is a proposal — that is P1. A second door also made a second place where the retrieval date of M6 and the row that invariant 2 requires in `documents` could be omitted.
**Accepted cost.** Loading a shapefile now needs an operator decision that it did not need before. The geographic import path is slower by one promotion step. In exchange, no file exists without a source, and no column mapping enters the graph unreviewed.

### P7 — Live search queries three substrates

**Decision.** Local documents, the graph, and the internet.
**Why.** This is the usage described: ask a question and get an answer wherever the material happens to sit.
**Consequence.** Three retrieval paths to build and to merge into a single answer.

---

## Publication

### PU1 — Everything is public, candidate layer included

**Decision.** The entire system is publishable, including unvalidated machine claims.
**Why.** The operator's decision, taken in full knowledge of the risks below.
**Accepted risks.** Entities under investigation gain access to the progress of the investigation in real time. Unverified claims targeting named companies and individuals are exposed, with the corresponding legal and GDPR exposure. The candidate/evidentiary distinction is weakened in the eyes of a reader who does not understand it.
**Mitigations adopted.** Visible, non-bypassable labelling of every candidate claim, with origin and score. No personal data on a natural person beyond what a cited source already publishes. A correction and right-of-reply mechanism, documented and accessible.

---

## Technical

### T1 — TypeScript end to end

**Decision.** Frontend and backend in TypeScript.
**Why.** One language, types shared across both sides, one ecosystem to master for a lone operator.
**Consequence.** Building blocks from the Python world — document processing, geospatial, ML — will have to be called as external services or rewritten.

### T2 — PostgreSQL/PostGIS as the single GOLD datastore

**Decision.** One database for the relational data, the JSONB and the geometry.
**Why.** One service to operate, native joins between attributes and geometry, and an engine that does all three correctly.
**Consequence.** Every attribute search goes through a GIN index on JSONB.

### T3 — Binary split: raw / GOLD

**Replaces the earlier T3**, which called the raw file immutable without saying what held it so.
**Decision.** S3 (MinIO) holds the raw file. PostgreSQL holds the processed and validated data. Between the two, the pipelines and the references. **The raw file is unchanged by convention, and not by a guarantee the store enforces.** The operator upholds it. No versioning, no object lock and no unique key stand behind it.
**Why.** Two natures, two guarantees: the raw is not reworked and serves as evidence; the GOLD is continuously reworked. Mixing them loses both guarantees.
**Why the earlier entry was wrong.** It said "immutable", and the word was measured and found false. The account that writes the bucket may put an object over a key that already exists, which replaces the bytes and deletes nothing. Removing the delete action stops removal and never destruction. Three mechanisms would have made the word true — bucket versioning, object lock at bucket creation, or a key that is the content hash under a unique constraint — and none is built. A guarantee that nothing enforces is a sentence a reader trusts and a machine ignores.
**Accepted cost.** A source file can be overwritten by a retry, a re-ingest, or a second `documents` row that carries the same key, and nothing warns. Evidence rests on the care of one operator. The day a second person writes to the bucket, or the day the corpus is offered as evidence to somebody else, this entry is replaced again and one of the three mechanisms is built.
**Consequence.** Every document has an S3 key and a row in the database. Their consistency is the pipeline's responsibility.

### T4 — Frontend autonomous for reads, backend reserved for writes

**Decision.** The frontend reads the database through a read-only HTTP layer. The Node backend serves only editing and heavy processing.
**Why.** The read path contains no business logic; a backend that relays SELECTs is dead weight.
**Consequences.** There is no "direct" access from a browser: the real choice is between a generated HTTP layer and a hand-written one. Complex read logic — graph traversals — moves down into SQL functions. A publicly readable database is a surface for abuse through resource exhaustion, to be fenced in with a read-only role, timeouts, default limits and a CDN cache. Finally, "the frontend works on its own" means **without the Node backend**, not without infrastructure: a reachable database is still required.

### T5 — Qdrant and NATS are deferred

**Decision.** pgvector in the existing database replaces Qdrant. A job table with locking replaces NATS.
**Why.** At 100 documents and one operator, these two services add operational load for an undetectable gain. Moving to either one later is trivial; carrying them from day one costs two services and two synchronisations.
**Consequence.** The first build runs on two services: PostgreSQL/PostGIS and MinIO.

### T6 — Two-tier validation

**Decision.** Zod at the application boundary, a `CHECK` constraint in the database.
**Why.** The application tier gives readable errors and frontend typing. The database tier is the only one that survives a writer outside TypeScript — which will happen as soon as the first external worker exists.
**Consequence.** One rule expressed twice, to be kept in sync.

### T7 — Frontend framework choice deferred

**Replaced by ADR 0004**, which chooses the framework. The consequence below is kept.
**Decision.** Postponed until the real volumes, the cartographic library and the graph rendering mode are known.
**Why.** The T4 constraint already imposes the front/back separation, which removes most of the benefit of a fullstack meta-framework. The remaining choice depends on constraints not yet established.
**Consequence.** shadcn is adopted regardless of the host framework.

### T8 — Cartographic library and tile path deferred

**Replaced by ADR 0005**, which chooses the library and the tile path.
**Decision.** Postponed, without debt: PostGIS prejudges no rendering path.
**Caution.** The choice must be made **before** any rendering code is written. Leaflet (raster first, no rotation, no native vector tiles) and MapLibre (vector, GPU) do not share the same layer model, and code for one does not carry over to the other.
