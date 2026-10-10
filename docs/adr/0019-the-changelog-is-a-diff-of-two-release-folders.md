# ADR 0019 — The changelog is a diff of two release folders

**Status** Accepted · 10 October 2026

## Context

A reader follows the investigation from one release to the next, so each release tells what
changed since the previous one. The graph keeps no history (`decisions.md` M5), so the record
cannot give the change. The site links the changelog, and readers cite its rows, so its name and
its columns are costly to change after the first publication.

## Decision

### The input

- The operator gives the folder of the previous release to the release command. With no folder,
  the changelog says "first release" and lists no change.
- The changelog reads the two releases only: the entities, the relations, the claims and the log
  of the merges of each one. It reads no history in the database.
- The release refuses a previous folder when a file does not agree with the size and the checksum
  of its file manifest, when a file is missing, when the manifest names a path out of the folder,
  and when the previous release is not earlier. Then it writes nothing. A changelog from a copy
  that changed would tell a false story.

### The comparison

- The rows match by identifier: the entity, the relation, or the claim (ADR 0013 makes the claim
  identifier stable). A claim has one row for each cited passage.
- A row is added, changed or removed. The release sorts the rows of each identifier and compares
  them whole, so a value that two rows exchange is a change. A changed row names each column
  whose set of values changed. When no set changed, it names each column that differs between
  the sorted rows.
- No column of these files changes at each release, because the version and the date are in the
  preamble. The release ignores the names that a row copies from the entities that it names: a
  new name is a change of the entity, and it shows once, on the row of that entity.
- Only a column that the two releases hold counts. A column that only one release holds is no
  change. So when the previous release shows the NATO pair and the new one does not, the
  changelog holds no letter, no digit and no name of the pair (`decisions.md` S1).
- An entity that a merge absorbed shows as merged, with its survivor, and not as removed. An
  entity that an undo restored shows as unmerged, with its old survivor, and not as added. The
  claims of that entity show the same way. The log of the merges of each release gives the
  survivor of each absorbed identifier, also at the end of a chain of merges (ADR 0014). A
  release with no log of the merges reads as a release with no merge.

### The output

- One CSV file in the release folder, with the same preamble and disclaimer as the other CSV
  files (ADR 0013), and one line in the preamble that names the previous release or says "first
  release". One row for each change: the kind, the identifier, the change, the changed columns,
  the label, and the survivor of a merge.
- The file manifest lists the changelog with its checksum, and gives a short summary: the previous
  release and the number of each change for each kind. The site reads the summary and links the
  file.

## Alternatives

- **A history table in the database.** M5 refuses it. Refused.
- **A changelog in JSON only.** A spreadsheet cannot open it, and the other exports are CSV.
  Refused.
- **One row for each changed value, with the old and the new value.** It copies values of the old
  release, also the NATO pair of a release that showed it. Refused.
- **A merge as a removal and an addition.** The reader would think that a vessel left the dataset.
  Refused.

## Cost

- A merge and its undo between two releases leave no row in the changelog. The log of the merges
  holds them.
- A relation that a merge removed shows as removed.
- A new claim of a restored entity shows as unmerged. A value that a merge moved to the survivor
  shows as a claim added to the survivor.
- The file manifest itself has no checksum, so a copy that changes a file and its checksum
  together is not found.
