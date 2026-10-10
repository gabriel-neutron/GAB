# ADR 0015 — A release gives three formats of the same rows

**Status** Accepted · 10 October 2026

## Context

The FNF investigation promises the open dataset in CSV, GeoJSON and JSON-LD. A GIS analyst opens
the entities with a position in QGIS. A data engineer links the entities, the relations and the
claims to other datasets. Each format leaves Gabriel and is used again with no control, so each
one must carry the same rows, labels, licences and disclaimer as the CSV files (ADR 0013,
`decisions.md` PU1). The identifiers of the linked data are costly to change after the first
publication, because reusers link to them.

## Decision

### One read, three formats

- The three formats come from one read of the record, so they hold the same rows. The read names
  a public document only when a row of the release cites it: a document that only a hidden row
  cites would show what that row was about.
- The manifest of the files lists each file of each format with its size and its checksum.

### The GeoJSON file

- One GeoJSON file (RFC 7946) holds one feature for each entity of the release that has its own
  position. The properties of a feature are the columns of the entity CSV, with the same values,
  so the origin label and the licence are on each feature.
- The database keeps each position in WGS84 and gives the longitude first. It gives the outer ring
  of a polygon counter-clockwise and a hole clockwise, with 6 decimals, as RFC 7946 asks and
  recommends. The file names no coordinate system, because RFC 7946 removed that member.
- The name of the release and the disclaimer are foreign members of the collection. GDAL, and so
  QGIS, takes the name as the name of the layer.
- A position that the map borrows from a parent entity is not in the file, because it is not a
  position of the entity.

### The JSON-LD file

- One JSON-LD 1.1 file holds one graph: a node for the release, and a node for each entity,
  relation, claim and cited document. Each entity, relation and claim keeps its origin label, its
  licence text and its sources. Each claim also keeps its passages. A CC licence also has the
  address of its licence text. The release node has the version, the date, the disclaimer and the
  licence of the dataset (CC-BY 4.0); each row keeps its own licence.
- An absorbed entity has a node that names the entity that replaces it while the merge stands, so
  an old link still leads to an entity.
- The context names each term that the graph uses, and uses no default vocabulary, so a key with
  no term cannot be in the file unseen. A term takes an existing vocabulary when one fits:
  schema.org (the dataset, the name, the version, the dates of validity, the address), Dublin Core
  (the title, the identifier, the licence, the source of a passage, the replacement) and PROV-O
  (the sources). The other terms are in a release vocabulary. The graph holds the definition of
  each term of that vocabulary, with a label and a comment, so the file documents itself.
- A value keeps its JSON type, so a number stays a number. A date has its XML Schema type.
- The two terms of the NATO pair, with their definitions, are in the file only when the release
  shows the pair (ADR 0013).

### The base of the identifiers

- Each identifier is a path under one base: the release, an entity, a relation, a claim and a
  document. The vocabulary is under the same base. The static site serves the same paths, so an
  identifier can open the page of what it names.
- The release manifest gives the base. It is a full https address that ends with a slash. The
  default is an address under the public repository, which the project controls.
- The operator sets the base once, to the address of the site, before the first public release,
  and never changes it after.
- The identifier of a claim is its identifier in the CSV, so it stays the same from one release to
  the next. The identifier of the release comes from its version.

## Alternatives

- **The position of a parent entity in the GeoJSON.** It is a claim of the analyst about the map,
  not about the entity. Refused.
- **`urn:uuid:` identifiers.** An entity and a relation have a UUID, but a claim and a document do
  not, and a URN never opens a page. Refused.
- **A base fixed in the code.** The address of the site is not known before the operator deploys
  it. Refused.
- **A default vocabulary in the context.** Each unknown key would become a term with no
  definition. Refused.
- **Each public document of the corpus.** A document that only a hidden row cites leaks the
  subject of that row. Refused.

## Cost

- The static site of a release serves the paths of the entities, the relations and the claims
  (ADR 0020). A document, the release and the vocabulary have no page: a reuser reads their
  definitions in the file.
- A change of the base after a public release breaks each link of a reuser to an earlier release.
- The release builds each file in memory before it writes it. A record many times larger than the
  record of today would need a writer that streams.
