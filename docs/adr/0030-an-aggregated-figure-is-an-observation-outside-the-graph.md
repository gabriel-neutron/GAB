# ADR 0030 — An aggregated figure is an observation outside the graph

**Status** Accepted · 25 October 2026

## Context

The research of the figures F5 and F7 needs aggregated figures: a monthly gas import volume of
each EU country from Russia, the trade between two countries, the throughput of a pipeline in one
year. No entity type of the vocabulary holds such a figure, and the skill `research-method` keeps
it out of the record. The research sessions kept about 3,000 rows in CSV files outside the record.
These rows are not reviewed, and the report cannot read them from the record.

The operator decided on #929, after the expert panel (software-architect, osint-expert, skeptic):

1. A figure is one row of a table of observations, outside the entity graph.
2. The reporter and the partner are codes of a fixed list, and no entity type `country` exists.
3. A figure enters through a mapping of the original stored file (P6), and never from a CSV file
   that a research session made.
4. Each figure has a licence, and the public read filters on it. Bruegel (CC BY-ND) is cited as a
   document only, and it is never loaded as data.

## Decision

- **A figure is no entity and no unit of decision (P11).** A figure has no relation and no name,
  and an entity for each cell (the two workarounds that the panel rejected) would fill the graph
  with nodes that a reviewer cannot judge one by one. The database holds the figures in a table of
  their own, with the measure, the value, the unit, the period, the method, the reporter, the
  partner, the product scope, an optional subject entity, the licence and the citation.
- **This extends P1: the promotion of the mapping is the promotion of each figure.** The mapper
  proposes how the columns of one stored table map, and the operator decides that one proposal.
  The loader then writes each row through one door, and no act waits in the queue for each row.
  The door holds the checks that a decision holds, and it derives each value itself: the load is
  the running job of an accepted mapping; the measure, the method, the publisher and a constant
  unit come from that mapping; the caller gives only the span of the row and the text of each
  cell, each text must be one field of that row in the stored page (P9), and the door reads the
  number, the period and the codes from these texts. A fault of one row sends that row to the
  load report, and a fault of the load stops the job.
- **The mapping has a third kind of table.** Beside an entity table and a relation table, an
  observation table names the column of each part of a figure. The unit is part of the key of a
  figure, because one table gives the same flow in two units. The mapping gives the code list of a
  reporter column, and the database turns the codes of the source into the codes of the fixed
  list, from a second fixed list of the codes that a source writes in its own way. A code outside
  the list sends the row to the load report.
- **The reporter and the partner are codes, not entities.** A country is a code of ISO 3166-1,
  and a group is a code of the same list (the EU, the world, a partner that the source does not
  state). The list is a fixed reference list in the seed. A country entity would duplicate a
  reference list that the record does not investigate.
- **A figure carries its licence, and the public read filters on it.** The door takes the licence
  from the provider of the document, and a document with no provider gives a restricted licence. A
  model writes the mapping, so the mapping gives no licence: a word that a model made up and the
  operator missed would publish every row. The fetch tool names the provider of a file that it
  reads at the API of Eurostat, as the official tools do. The open words are the allow-list of the
  document tier. A figure of UN Comtrade is internal, and the report shows it only as an aggregate.
- **A figure is written once.** No role updates or deletes it. A new edition of a table is a new
  stored document, and its rows are new figures. The read gives only the figure of the newest
  edition for each key, so a sum never counts a month twice. The publisher is part of the key, so
  the edition of one publisher never hides the figure of another.
- **The subject has no foreign key.** A merge or a delete of an entity is an act of the operator,
  and a figure must not stop it. The read resolves a merged subject through its alias.
- **The judgement stays out of the loader.** The split of the F7 figures (reduced, bypassed,
  lawful) is a later layer, not a step of the load.

## Cost

- A wrong mapping loads every row wrong, and no per-row review catches it. The operator reads the
  dry run of the mapping before the promotion: it gives the figure or the reason of each row.
- A wrong figure cannot be corrected in place. A correction is a new edition of the file, or a
  new migration.
- The licence allow-list is written twice: in the document tier and in the read of the figures. A
  test holds the two lists equal.
- The skeptic of the panel preferred to keep the figures outside the record, with charts from the
  CSV files and a value check. The operator chose the record, because the figures must be reviewed
  and readable there.

## Measured

25 October 2026, on the test database, with the two Eurostat SDMX-CSV files of the gas and oil
imports of the partner RU since January 2021: the gas file (10,072 rows) loads 10,040 figures in
about 5 s, and the 32 rows that Eurostat marks as missing go to the report. The oil file (72,097
rows) loads every row in about 40 s.
