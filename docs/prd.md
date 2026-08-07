# Gabriel — Product Requirements Document

**Version** 1.0 · 6 August 2026
Related documents: `decisions.md` (rationale), `spec.md` (contract), `schema.md` (a
provisional example of a database, not a contract).

---

## 1. Purpose

Gabriel is an OSINT data fusion environment serving as a personal investigation instrument. Its purpose: **to allow a single analyst to analyse, extract and correlate information in order to create, edit and link entities**, with a requirement of source traceability on every claim.

**Single arbitration criterion (C4)** — any capability that does not multiply investigative capacity within the project's horizon is out of scope. This criterion alone settles every trade-off in this document.

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

The prefix `W` marks a workflow step. The prefixes `C`, `M`, `S`, `P`, `PU` and `T` in this
document always name an entry in `decisions.md`, never a step.

| # | Step | In / out |
|---|---|---|
| W1 | Scouting and collection of raw material | Out |
| W2 | Ingestion of documents into the corpus | **In** |
| W3 | Extraction: the system reads and proposes nodes and links | **In** |
| W4 | Automated scoring: ADMIRALTY on the document, confidence on the proposal | **In** |
| W5 | Review by exception: dissent between agents or low confidence | **In** |
| W6 | Promotion of a proposal to the evidentiary layer | **In** |
| W7 | Manual creation and editing of entities and relations | **In** |
| W8 | Conversational drill-down from a graph element | **In** |
| W9 | Search and correlation across documents, graph and internet | **In** |
| W10 | Production of geographic elements and layers | **In** |
| W11 | Heavy satellite imagery processing | Out |
| W12 | Report writing | Out |
| W13 | Publication | **In** |

**W6 is the pivotal step (P1).** It is the act that turns machine material into evidentiary material. The ergonomics of W5–W6 determine the value of the whole.

---

## 4. Requirements by pillar

### 4.1 Data

The technical form of each rule below is an invariant in `spec.md` §2.

- Two kinds of object: the relational (entities, relations) and the sources (file, URL, API, report) (M2).
- **Every element is sourced** (M8). A claim with no source attached does not exist in the system. Direct human entry is an explicit source, not an absence of source.
- Strict **raw / GOLD** separation (T3): the original file is immutable and serves as evidence; the processed data is reworked continuously.
- **Current-state** model (M5). Exception: identity and ownership relations carry a validity interval (M6).
- The schema tolerates incomplete and heterogeneous information (M2): **no data is distorted to fit into a field**. What serves to link is typed; what describes is free.
- Every attribute value cites at least one document (M8). A value always exists; the unknown is the absence of a key (M9).

### 4.2 Visual

- **Two distinct views**: relational graph and map. No unified view.
- The map is **both an analysis surface and a presentation surface**.
- The analyst **creates geographic elements and composes layers within Gabriel**, rather than merely consulting them.
- Navigation from an element to its sources, its neighbours, its position.
- Pending proposals appear as markers on the graph.

### 4.3 Pipeline and AI

| Mode | Input | Output | Formats | Entry points |
|---|---|---|---|---|
| Batch | A document | Proposals | Extractable text (P5); structured data through a direct import (P6) | Ingestion |
| Live | A query | An answer | — | Project-level chat; contextual chat from an element |

Live mode reads three substrates: corpus documents, graph, internet (P7). Both the user and the AI can reference relational data and documents.

**Two layers, one promotion (P1, P2)**

| Layer | Who writes | Guarantee | Destination |
|---|---|---|---|
| Candidate | The machine, freely | None | Exploration, correlation, hypotheses |
| Evidentiary | The analyst, by promotion | Source cited, rating origin tracked | Report, dataset, public map |

**Dual review surface (P3)**: a marker on the graph, and a dedicated queue.

**Scoring**: see S1, S3 and S4.

**The backend also carries**:

- versioned agents;
- workflows, which are sequences of agents;
- import and export pipelines;
- raw storage management.

---

## 5. What Gabriel does not do

- **No OCR** (P5). A scan is converted outside the tool before ingestion.
- **No audio, no video** (P5).
- **No heavy satellite imagery processing.** Scope only. No decision entry records a cost.
- **No drafting.** Scope only. Gabriel supplies the material and the references.
- **No continuous automated collection.** Scope only. No scheduled monitoring, no real-time connector.
- **No user management** (C5).
- **No temporal querying** (M5).
- **No graph version tracking** (M5). Only entity merges are reversible (M12).
- **No FollowTheMoney interoperability** (M1).

This list is a first-rank deliverable (C3). Every line removed from it is a door reopened to drift.

---

## 6. Declared limits and accepted risks

Each limit below is the accepted cost of a locked decision. `decisions.md` holds the full
text, under **Accepted consequence** or **Accepted risks**. It is the single home. Do not
copy that text back into this document.

| Limit | Entry |
|---|---|
| Full publication, candidate layer included | PU1 |
| ADMIRALTY is a source score, not a claim score | S1 |
| Automated scoring is unmeasured | S3 |
| Loss of the temporal dimension | M5 |
| Attribute key drift — the most likely breaking point of the model | M11 |
| Absence of interoperability | M1 |

---

## 7. Acceptance criteria

1. A sample of entities from the v1 corpus is demonstrated to be representable in the target model.
2. Every requirement in sections 3 and 4 is justifiable by the arbitration criterion of section 1.
3. The six invariants of the technical specification are enforced by constraint or by trigger, not merely by application convention.
4. Section 5 is validated as exhaustive.
