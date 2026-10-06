# Gabriel — Technical overview

The general view of the build. It tells how the parts connect and which rules hold on every path.
The code holds the details: read it for a table, a type or a function. The product rules are in
`decisions.md`, and their identifiers (M8, P1) appear here.

## The parts

```mermaid
flowchart LR
    OP["Operator<br/>(browser)"]
    AI["Research AI<br/>(Claude or Codex)"]

    subgraph APP["Gabriel"]
        UI["Web interface<br/>graph · map · review"]
        READ["Read API<br/>(read only)"]
        WRITE["Writer<br/>(write service)"]
        MCP["MCP server<br/>(AI tools)"]
        WORK["Worker<br/>(AI jobs)"]
        DB[("PostgreSQL / PostGIS<br/>the data and its rules")]
        RAW[("S3 raw store<br/>original files")]
    end

    MODEL["Model gateway"]
    SEARCH["Web search"]

    OP --> UI
    UI --> READ --> DB
    UI --> WRITE --> DB
    WRITE --> RAW
    AI --> MCP --> DB
    MCP --> RAW
    MCP --> SEARCH
    WORK --> DB
    WORK --> RAW
    WORK --> MODEL
```

| Part | Job |
|---|---|
| PostgreSQL / PostGIS | Holds every record and enforces the rules below. |
| S3 raw store | Keeps each original file unchanged. Any S3 server can hold it. |
| Writer | The only write service for the operator: upload, edit, promote, reject, queue an extraction. It also gives the operator the status of the jobs of a document, which the public read never shows. |
| Read API | Read-only HTTP over a fixed set of public views. |
| Web interface | The graph, the map, the review queue, search and entity pages. |
| Worker | Takes AI jobs from a queue in the database and runs the agents. |
| MCP server | Gives the research AI its tools: search, fetch, propose, queue a job. |
| Model gateway, web search | External services. They hold no record of the project. |

## Who can do what

| Actor | Can | Cannot |
|---|---|---|
| Operator | Upload, edit, promote, reject, rate a source. | — |
| Research AI | Read, fetch and store documents, propose a change, queue a job. | Promote. |
| Worker agents | Read a document, propose a change with the passage that states it. | Promote. |
| Public | Read the public views. | Write. |

Each actor has its own database role. The database, not the application, holds these limits.

## Rules that hold on every path

The database enforces each rule: by a constraint, a trigger, or a permission that the writing role
cannot cross.

1. Every attribute carries at least one source (M8).
2. Every cited source is a stored document (S2).
3. A machine never signs as the operator (M8).
4. No value is null or blank; the unknown is an absent key (M9).
5. Nothing enters the evidentiary layer without a promotion (P1).
6. Each public decision carries its origin (S4).

## The read path

The interface reads through the read API, with a read-only role and a fixed list of views. Complex
reads, such as a graph traversal, run as SQL functions in the database. A timeout, a default limit
and a cache protect the public read.

The public read shows the record and the candidate layer, and nothing else (PU1). It shows no
rejected proposal, no job and no model call. The machine roles read through their own grants.

## The write path

```
a file  →  one ingestion door (P6)
             → raw store (the original file)
             → document record (source, retrieval date)
             → text extraction
             → a job in the queue
                  → text file: the extractor reads the text as it is stored and
                    proposes claims, each with a checked excerpt
                  → structured file: a mapping proposal; after promotion, code loads the rows
every proposal  →  review queue and graph marker  →  operator promotes or rejects (P1, S3)
promotion       →  entities and relations (the evidentiary layer)
```

A promotion is one transaction: it writes the target and marks the proposal accepted. A rejection
writes no target. A rejected proposal is kept as a record.

An edit of the operator is a proposal and its promotion in one transaction, so it is written whole
or not at all. Only the operator role holds the promotion, so a machine proposes and never decides.
A value that an act keeps keeps each document that it already cites.

A machine proposes through one door, which takes a batch. Each act of a machine cites a page and a
span of stored text, which code found from a quoted excerpt. The door writes the act and its
citations together, refuses the whole batch on one fault, and returns a pending act that it
already holds instead of a duplicate. The cited passage is private and reaches only the review
card of the operator.

## Technical baseline

| ID | Decision | Reason |
|---|---|---|
| T1 | TypeScript end to end. | One language and shared types for one operator. |
| T2 | PostgreSQL/PostGIS is the single datastore. | One service for relations, JSON and geometry. |
| T3 | The raw file is in S3, the processed data in PostgreSQL. | The raw file is evidence and stays as it is; the data changes. The raw file is unchanged by convention only: the store does not lock it. |
| T4 | The interface reads by itself; the backend serves writes only. | A backend that only passes reads on is dead weight. |
| T5 | pgvector and a job table, no vector database and no message queue. | Two fewer services at our volume. |
| T6 | The boundary (Zod) reads the shape of a request. The database holds each rule on data, and words its own refusal. | Each rule has one owner, and the guard holds for any writer. |

The ADRs hold the other build decisions (`README.md`).

## Operational values

An operational value (a threshold, a radius, a zoom level) is set from real data, in configuration,
and never as a code constant.
