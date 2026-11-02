# ADR 0034 — A recipe maps a known table with no model

**Status** Accepted · 2 November 2026 · Extends ADR 0030

## Context

ADR 0030 lets a figure enter the record only through a promoted mapping of a stored table. Only
the model wrote a mapping, so each new table cost model credit. The report needs the volumes of
the CREA Russia Fossil Tracker (a table of a known address and a fixed header), and the operator
asked for no credit for them (#1101, #1110). A hand-made CSV of sums is no source (ADR 0030).

The expert panel (software-architect, osint-expert, skeptic) decided on 2 November 2026.

## Decision

- **The mapper has a recipe step before the model.** A recipe is code that returns the mapping of
  one table that it knows by the host and path of the document, the query that fetched it, and the
  exact list of header columns. A table that no recipe knows goes to the model as before.
- **The call is honest.** A recipe records a call with the agent `deterministic_mapper`, the
  endpoint `none`, the model `none` and 0 tokens. The door `propose_mapping` and its checks do not
  change. A reviewer decides the mapping as any other mapping.
- **A refusal of a recipe stops the job.** The model never gets a table that a recipe claims, so a
  fault of a recipe never spends credit.
- **A figure can have a day as its period.** The tracker gives the departures of each port for each
  day and no yearly figure. The loader reads each day as a figure, and a sum is a read of the
  record. The bin of a year may be named by its first day (`2021-01-01`).
- **The mapping translates a name to an identifier.** The tracker names a port, and the record
  finds a port by its UN/LOCODE. The subject of an observation table may carry a list of names
  and identifiers. The list is part of the mapping, so the reviewer reads it. A name not in the
  list, or a port that the record lacks, sends the row to the load report.

## Cost

- Each recipe is code for one publisher and needs a test. A change of the header of the source
  makes the recipe silent, and the table falls to the model.
- A daily figure is one row for each day: about 20,000 rows for the port tables of five years.
