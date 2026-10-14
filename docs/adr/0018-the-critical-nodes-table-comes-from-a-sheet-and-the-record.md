# ADR 0018 — The critical nodes table comes from a sheet of the operator and the record

**Status** Accepted · 10 October 2026

## Context

The critical nodes table is the central deliverable of the FNF investigation. A node is retained
when it meets two documented conditions of three: (a) documented sanctions exposure, (b) documented production
or throughput in 2024-2026, (c) presence in a bypass routing across jurisdictions. The table is
the home page of the public site, and readers cite it. So the meaning of a row, the source of each
condition and the rule that retains a node are costly to change after the first publication.

The record holds the designations, so it can give condition (a). The record cannot give (b) and
(c): they are judgements of the operator over many claims. The operator also writes who controls
the node and the bypass pattern, as short texts.

## Decision

### The operator keeps a sheet, the release checks it

- The operator keeps a CSV sheet of candidate nodes outside the public repository, and the release
  manifest names its path, relative to the folder of the manifest. The sheet has one row for each
  candidate node and condition (b) or (c): the entity identifier of the node, the condition, the
  identifiers of the claims that support the tick, and the two texts. A row with no condition only
  names a candidate and its texts. The how-to guide names the columns.
- The release refuses the whole sheet, and writes no file, when a row names a node that is not a
  public entity of the release, or a claim that is not a public claim of the release. The message
  names the line. So the table never points to a hidden element (`decisions.md` PU1).
- The release does not check that a claim supports its condition. That is the judgement of the
  operator, and the file says so.
- With no sheet, the release writes the table with its header and no row, so each release has the
  same files and the site has one input.

### Condition (a) comes from the record

- Condition (a) is ticked when the node itself has a public designation in the release, of any
  regime. An ended designation counts too: it documents an exposure. The claims of the tick are
  those designations.
- A designation of an entity that the node controls, for example a vessel of a company, does not
  count. The sheet ticks the conditions of one node, and a reader must find the designation on
  that node. The operator can add the controlled entity as its own candidate.
- The sheet cannot tick condition (a).

### What a row shows

- Each condition shows one of three fixed words: sourced (a tick with at least one public claim),
  not sourced (a tick with no claim), or no tick, with the claim identifiers.
- A node is retained when it has two sourced ticks or more. A tick that is not sourced stays in its
  row, but it does not count: the conditions say "documented", and such a tick gives the reader
  nothing to check. The row gives the count of all the ticks and the count of the sourced ticks.
  The retained value, the order of the rows and the count of the retained nodes use this one rule.
  No third status is added: "candidate" already names each row of the sheet.
- The texts of the operator are public text of the release. The how-to guide tells the operator
  not to name a person that the release does not show; the release cannot check free text.
- The parameter that shows the NATO pair (ADR 0016) adds, for each condition, the pair of each
  claim of the tick in the order of the claims. Off, the file holds no column and no word of the
  pair.

### The file

- The table is one CSV file of the release, with the preamble and the disclaimer of each file, a
  note that states the rules above, and its checksum in the manifest of the files (ADR 0013).
  Retained nodes come first, then the nodes by label.
- The JSON-LD export does not hold the table. The site reads the CSV file.

## Cost

- The operator types claim identifiers by hand. A typing fault stops the release, with the line.
- A sheet row cannot say why a claim supports its condition. A reader opens the claim.
- A node with two ticks and only one sourced tick is not retained. The node stays in the table of
  the other candidate nodes, with the "not sourced" cell, until a public claim supports the tick.
- The first rule counted a tick that is not sourced. No release with the table was public under
  that rule, so no published table changes its meaning. From now on, a change of `retained` for a
  node shows only in the table: the changelog does not give a line for it.
