# Gabriel — Technical specification

**Version** 1.1 · 6 August 2026
The contract. The *why* behind each choice is in `decisions.md`, referenced by identifier.
No schema is settled. §3 says what `schema.md` is, and what it is not.

## Table of contents

| § | Section | Read it when |
|---|---|---|
| 1 | Overview | You need the shape of the system. |
| 2 | Invariants | Always. These rules hold on every write path. |
| 3 | Schema | You need to know what is decided about the database. Nothing is. |
| 4 | Read path | You add a read, a query or a public surface. |
| 5 | Write path | You add an ingest, an extraction or a promotion path. |
| 6 | What is not specified here | Before you choose a value that no document gives. |

---

## 1. Overview

```mermaid
flowchart LR
    subgraph RAW["Raw — immutable"]
        S3["MinIO / S3<br/>original files"]
    end

    subgraph GOLD["GOLD — PostgreSQL / PostGIS"]
        DOC["documents"]
        ENT["entities"]
        REL["relations"]
        PRO["proposals"]
        VEC["doc_chunks<br/>pgvector"]
    end

    subgraph BACK["TypeScript backend — write"]
        ING["Ingestion"]
        AGT["Agents / workflows"]
        JOB["Job worker"]
    end

    subgraph FRONT["Frontend — standalone read"]
        RO["Read-only HTTP layer"]
        UI["Graph · Map · Chat · Review queue"]
    end

    S3 --> ING
    ING --> DOC
    ING --> VEC
    DOC --> AGT
    VEC --> AGT
    AGT --> PRO
    PRO -->|promotion| ENT
    PRO -->|promotion| REL
    JOB --> AGT
    ENT --> RO
    REL --> RO
    PRO --> RO
    RO --> UI
    UI -->|edit| BACK
```

**Two services in the first build**: PostgreSQL/PostGIS and MinIO (T5).

---

## 2. Invariants

These rules are never violated, whatever the write path.

**No tier enforces any of them today.** No database exists and no code exists. The last
column names the tier that must carry each rule when the build reaches it. It is a
requirement, not a report.

| # | Invariant | Decision | Tier that must carry it |
|---|---|---|---|
| 1 | Every attribute carries at least one source. | M8 | Database. A check on the shape of the attribute object. |
| 2 | Every cited source exists in `documents`. | S2 | Database for `attrs`, through a foreign key. **Undecided** for `entities.sources`, `relations.sources` and `proposals.src`. See §6. |
| 3 | A machine proposal cites a real document, never `manual`. | M8 | Database for the value. The application checks that the document exists. |
| 4 | No attribute value is null; the unknown is the absence of a key. | M9 | Database. The same check as invariant 1. |
| 5 | Nothing enters `entities` / `relations` without the explicit promotion of a proposal or a direct operator action. | P1 | **Undecided.** No tier is named. See §6. |
| 6 | Every ADMIRALTY rating carries its origin. | S4 | Database. A check that ties the rating to its origin. |

`schema.md` §6, §9 and §2 illustrate one way to build the checks above. That document is
provisional and it decides nothing. Do not cite it as the authority for an invariant.

The acceptance criterion in `prd.md` §7.3 asks for enforcement by a constraint or by a
trigger for all six. **None is met today, because nothing is built.** Invariant 5, and the
three columns named under invariant 2, are further behind: no tier is named for them at
all. §6 records both as open.

---

## 3. Schema

**No schema is settled.** `schema.md` shows one possible shape, produced during the
requirements grilling. It is an example. It is not part of this contract, and no line of it
is decided.

The real schema is written in the migration files, when the build needs it. It must satisfy
§2 above. Read `schema.md` for an illustration of how an invariant can map to a table, a
constraint or a trigger — never as an authority.

---

## 4. Read path

The frontend reads through a read-only HTTP layer (T4). The read path needs a read-only
database role, an explicit allowlist, and a graph traversal that runs inside the database.
`schema.md` §15 illustrates one form of the three. It settles none of them.

| Guardrail | Effect |
|---|---|
| Read-only role, explicit allowlist of tables, views and functions | No access outside the perimeter |
| `statement_timeout` + default `LIMIT` | Cuts off pathological queries |
| CDN cache on GETs | Absorbs the public load |
| PgBouncer | Prevents connection exhaustion |

Complex read logic — graph traversal above all — lives in a SQL function, not in the
client (T4).

---

## 5. Write path

```
File → S3 (immutable, key returned)
     → documents row (retrieved_at mandatory)
     → extraction job (queued)
     → worker: text extraction → doc_chunks + embeddings
     → agent workflow → proposals (src mandatory, never 'manual')
     → exception rule: dissent OR confidence < threshold
          ├── true  → review queue + graph marker → human decision
          └── false → OPEN, see §6
     → entities / relations (evidentiary layer)
```

**Review by exception (S3).** Send to human review every proposal such that
`dissent = true` OR `confidence < threshold`. The threshold is an operational parameter,
not a code constant.

**What happens to the rest is an open question.** S3 says the operator intervenes only on
dissent or low confidence. P1 and invariant 5 say nothing reaches the evidentiary layer
without explicit promotion. The two cannot both hold. Do not settle this in code and do
not settle it in a document. See §6.

**Applying a proposal**: a single transaction that writes the target, moves the proposal to
`accepted`, and fills in `decided_at` / `decided_by`. A rejection moves it to `rejected`
without writing the target — rejected proposals are never deleted, they are the record of
what was set aside.

**Review surfaces (P3).** Two reads must stay cheap: the pending proposals attached to one
graph element, and the full review queue. Each one needs its own index. `schema.md` §9
illustrates a pair; it settles neither.

---

## 6. What is not specified here

Each row is an open question. Per `CLAUDE.md`, each one lives as a tracker ticket. Never
settle one by writing code, and never settle one by writing a default value.

| Topic | Status |
|---|---|
| Automatic application of a proposal | **OPEN and blocking.** S3 and P1 conflict. One of the two must be replaced explicitly in `decisions.md`. |
| Enforcement tier for invariant 5, and for the three source arrays of invariant 2 | **OPEN.** `prd.md` §7.3 asks for a constraint or a trigger. Neither exists. |
| Mapping library and tile path | T8 — to be settled before any rendering code |
| Frontend framework | T7 — deferred |
| Migration tool, and the order the DDL is applied in | **OPEN** — #22. Close it before the first line of DDL. |
| What the read-only role selects from: base tables, or views and functions | **OPEN** — #23. It fixes the contract that the UI is written against. |
| Folder layout, package manager, check command | **Settled** by ADR 0001. |
| Test command, and the runner behind it | The command is settled by ADR 0001. The runner is **OPEN** — #24. |
| Definition of done | Settled by ADR 0001, except the test requirement, which is **OPEN** — #21. |
| Detailed shape of `payload` per operation type | To be frozen with the first agent written |
| Confidence threshold | Operational parameter, to be calibrated on the first runs |
| Rendering proposals as ghost elements | Client-side rendering work, no schema impact |
| v1 corpus migration | After validating the model on a sample (C7) |
| Correction and right-of-reply mechanism | Adopted by PU1. Its shape is open, to be settled before first publication. |
