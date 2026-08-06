# Gabriel — Product Requirements Document

**Version** 1.0 · 6 August 2026
Related documents: `decisions.md` (rationale), `spec.md` (implementation).

---

## 1. Purpose

Gabriel is an OSINT data fusion environment serving as a personal investigation instrument. Its purpose: **to allow a single analyst to analyse, extract and correlate information in order to create, edit and link entities**, with a requirement of source traceability on every claim.

**Single arbitration criterion** — any capability that does not multiply investigative capacity within the project's horizon is out of scope. This criterion alone settles every trade-off in this document.

**Constraint of form** — open source publication. It constrains the choices without directing them.

---

## 2. User and setting

| Item | Value |
|---|---|
| Operator | A single analyst |
| External contributor | Produces reports that enter as **sources**, not as a user |
| Authentication | None |
| Multi-project | Theoretical; single-project in practice |
| Target volume | 1 to 10k entities, 100 to 1k documents |

The volumes are small. Any complexity justified by scaling is explicitly out of scope.

---

## 3. Analyst workflow

| # | Step | In / out |
|---|---|---|
| S1 | Scouting and collection of raw material | Out |
| S2 | Ingestion of documents into the corpus | **In** |
| S3 | Extraction: the system reads and proposes nodes and links | **In** |
| S4 | Automated scoring: ADMIRALTY on the document, confidence on the proposal | **In** |
| S5 | Review by exception: dissent between agents or low confidence | **In** |
| S6 | Promotion of a proposal to the evidentiary layer | **In** |
| S7 | Manual creation and editing of entities and relations | **In** |
| S8 | Conversational drill-down from a graph element | **In** |
| S9 | Search and correlation across documents, graph and internet | **In** |
| S10 | Production of geographic elements and layers | **In** |
| S11 | Heavy satellite imagery processing | Out |
| S12 | Report writing | Out |
| S13 | Publication | **In** |

**S6 is the pivotal step.** It is the act that turns machine material into evidentiary material. If review is painful, the evidentiary layer stays empty and the system produces nothing usable. The ergonomics of S5–S6 determine the value of the whole.

---

## 4. Requirements by pillar

### 4.1 Data

- Two kinds of object: the relational (entities, relations) and the sources (file, URL, API, report).
- **Every element is sourced.** A claim with no source attached does not exist in the system. Direct human entry is an explicit source, not an absence of source.
- Strict **raw / GOLD** separation: the original file is immutable and serves as evidence; the processed data is reworked continuously. Between the two sit the pipelines and the references.
- **Current-state** model. Exception: identity and ownership relations carry a validity interval.
- The schema tolerates incomplete and heterogeneous information: **no data is distorted to fit into a field**. What serves to link is typed; what describes is free.
- Every attribute value cites at least one document. A value always exists; the unknown is the absence of a key.

### 4.2 Visual

- **Two distinct views**: relational graph and map. No unified view.
- The map is **both an analysis surface and a presentation surface**.
- The analyst **creates geographic elements and composes layers within Gabriel**, rather than merely consulting them.
- Navigation from an element to its sources, its neighbours, its position.
- Pending proposals appear as markers on the graph.

### 4.3 Pipeline and AI

**Batch mode** — the document goes in, proposals come out.
Formats: extractable text (text PDF, docx, txt, md, html, csv) or structured data (GeoJSON, shapefile, CSV).

**Live mode** — the query goes in, the answer comes out.
Three substrates: corpus documents, graph, internet. Two entry points: project-level chat, contextual chat from an element. Both the user and the AI can reference relational data and documents.

**Two layers, one promotion**

| Layer | Who writes | Guarantee | Destination |
|---|---|---|---|
| Candidate | The machine, freely | None | Exploration, correlation, hypotheses |
| Evidentiary | The analyst, by promotion | Source cited, rating origin tracked | Report, dataset, public map |

The candidate layer is a **table of proposed operations**, not a copy of the graph.

**Dual review surface**: a marker on the graph for in-context review, a dedicated queue for serial processing.

**Scoring**: ADMIRALTY on the document, produced by a multi-agent mechanism designed to generate contradiction. The operator intervenes only in case of dissent or confidence below threshold. The origin of each rating — machine, arbitrated, human — is stored and published.

**The backend also carries**: versioned agents, workflows (sequences of agents), import/export pipelines and raw storage management.

---

## 5. What Gabriel does not do

- **No OCR.** A scan is converted outside the tool before ingestion.
- **No audio, no video.**
- **No heavy satellite imagery processing.**
- **No drafting.** Gabriel supplies the material and the references.
- **No continuous automated collection.** No scheduled monitoring, no real-time connector.
- **No user management.** No accounts, no roles, no permissions, no collaboration.
- **No temporal querying.** The graph cannot answer "what was the state on 3 March 2024".
- **No graph version tracking.** No global history, no general rollback. Only entity merges are reversible.
- **No FollowTheMoney interoperability.**

This list is a first-rank deliverable. Every line removed from it is a door reopened to drift.

---

## 6. Declared limits and accepted risks

### 6.1 Full publication, candidate layer included

**Decision**: everything is public, including unvalidated machine claims.

**Accepted risks**: entities under investigation gain real-time access to the progress of the investigation; unverified claims targeting named companies and individuals are exposed, with the corresponding legal and GDPR exposure; the candidate/evidentiary distinction is weakened in the eyes of a reader who does not understand it.

**Adopted measures**: visible and non-bypassable labelling of every candidate claim, with origin and score; no personal data on a natural person beyond what a cited source already publishes; a documented and accessible correction and right-of-reply mechanism.

### 6.2 ADMIRALTY is a source score, not a claim score

The score is carried by the document. The **reliability (A–F)** axis is handled correctly — it is a property of the source. The **credibility (1–6)** axis is not: a single document contains both a corroborated fact and a rumour, and they receive the same score.

**The dataset must present the scoring as a source score.** Any presentation of it as per-claim scoring would be false.

### 6.3 Automated scoring is unmeasured

Validation by exception is triggered by dissent or low confidence. These two signals detect disagreement between agents, **not the blind spot they share**: similar models trust the same laundered source and miss the same transliteration.

**Without a random audit sample — rejected — no public assertion about the accuracy rate of the scoring is defensible.** The dataset must state that the scoring is automated and unmeasured.

### 6.4 Loss of the temporal dimension

The current-state model makes it impossible to demonstrate by query that an asset belonged to X at the time of a fact and then to Y afterwards. The intervals on identity relations mitigate the loss without closing it. Any demonstration of sequence rests on the documents.

### 6.5 Attribute key drift

Without an attribute registry, nothing prevents three spellings of the same notion from coexisting on entities of the same type, all valid, making the graph silently unusable. The monitoring adopted makes this visible but does not prevent it. **This safeguard becomes insufficient as soon as an agent writes at volume** — it is the most likely breaking point of the model.

### 6.6 Absence of interoperability

No standard exchange format is produced. Any external reuse of the dataset will require conversion work.

---

## 7. Acceptance criteria

1. A sample of entities from the v1 corpus is demonstrated to be representable in the target model.
2. Every requirement in sections 3 and 4 is justifiable by the arbitration criterion of section 1.
3. The six invariants of the technical specification are enforced by constraint or by trigger, not merely by application convention.
4. Section 5 is validated as exhaustive.
