# Gabriel — Product Requirements Document

**Version** 1.0 · 6 August 2026
Related documents: `decisions.md` (rationale) and `spec.md` (contract). The schema itself is
in `db/`, and no document draws it.

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
| W10 | Production of geographic elements and layers, by coordinate entry and by parameter | **In** |
| W11 | Heavy satellite imagery processing | Out |
| W12 | Report writing | Out |
| W13 | Publication | **In** |

**W6 is the pivotal step (P1).** It is the act that turns machine material into evidentiary material. The ergonomics of W5–W6 determine the value of the whole.

---

## 4. Requirements by pillar

### 4.1 Data

**The data rules are not restated here.** The **Data model** group of `decisions.md` holds each
one with its reason and its cost, and `spec.md` §2 holds the form each takes on a write path. A
third statement in this document would drift from both.

What the scope adds, and the register does not: the system holds **two kinds of object**, the
relational and the source. It stores nothing else.

### 4.2 Visual

- **Two distinct views**: relational graph and map. No unified view.
- The map is **both an analysis surface and a presentation surface**.
- The analyst **creates geographic elements and composes layers within Gabriel**, rather than merely consulting them. Creation is **by coordinate entry** — a click on the map, or a typed coordinate — and **by parameter** — a buffer radius is a typed number, a view cone is a bearing and an angle. Measurement of a distance, a bearing or an area is read and discarded, and is never stored. A box or lasso select is a **query** over the entities inside a shape, never stored geometry. The tool provides **no interactive geometry editor** (ADR 0005). A geographic file is not refused: it enters through the one ingestion door, as a mapping proposal (P6).
- Navigation from an element to its sources, its neighbours, its position.
- Pending proposals appear as markers on the graph.

### 4.3 Pipeline and AI

| Mode | Input | Output | Formats | Entry points |
|---|---|---|---|---|
| Batch | A document | Proposals | Extractable text (P5); structured data mapped by proposal (P6) | One ingestion door (P6) |
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

- **No interactive geometry editor** (ADR 0005). Vertex authoring — tracing a footprint, snapping, repairing a self-intersection — is done in QGIS or an equivalent, and the result enters as a source. A hand-drawn shape carries no source, and M8 refuses a claim with no source.
- **No OCR** (P5). A scan is converted outside the tool before ingestion.
- **No audio, no video** (P5).
- **No heavy satellite imagery processing.** Scope only.
- **No drafting.** Scope only. Gabriel supplies the material and the references.
- **No continuous automated collection.** Scope only. No scheduled monitoring, no real-time connector.
- **No user management** (C5).
- **No temporal querying** (M5).
- **No graph version tracking** (M5). Only entity merges are reversible (M12).
- **No FollowTheMoney interoperability** (M1).

This list is a first-rank deliverable (C3). Every line removed from it is a door reopened to drift.

---

## 6. Declared limits and accepted risks

Every limit of this system is the accepted cost of a locked decision, and `decisions.md`
holds each one under **Accepted consequence** or **Accepted risks**. **It is the single home,
and this document keeps no list of them.** A list here is an index of an index: it goes stale
on the day an entry gains a cost, and the reader then holds two answers to one question.

---

## 7. Acceptance criteria

1. A sample of entities from the v1 corpus is demonstrated to be representable in the target model.
2. Every requirement in sections 3 and 4 is justifiable by the arbitration criterion of section 1.
3. **Every** invariant of the technical specification is enforced by the database, not merely by application convention. Three tiers count: a constraint, a trigger, or a **privilege boundary the writing role cannot cross**. An invariant about how a row arrived, and not about the values in it, cannot be carried by a check on the values, so the third tier is not a weaker form of the first two. A privilege boundary is not application convention, because the application cannot lift it.
4. Section 5 is validated as exhaustive.
