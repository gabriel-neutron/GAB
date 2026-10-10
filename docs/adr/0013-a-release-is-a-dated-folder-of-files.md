# ADR 0013 — A release is a dated folder of files, read through the release functions

**Status** Accepted · 10 October 2026

## Context

The FNF investigation promises open exports. A file that leaves Gabriel is copied and used again
with no control, so it must carry the label of each claim, the disclaimer and the licence
(`decisions.md` PU1), and it must never hold what the public read hides. The format of the folder
and the read are costly to change after the first publication, because readers cite the files.

## Decision

### One command, one folder

- One worker command writes one release, from the record and a release manifest that the operator
  gives at run time. The manifest is not in the public repository: it holds the contact
  addresses. Each value has a default, except the two contact addresses. The manifest refuses a
  key that it does not know, and a character that would break a line of a file.
- The parameter that shows the NATO pair (ADR 0016) is off by default (`decisions.md` S1). Off, no
  file holds a letter, a digit or a column of the pair. On, each claim row with a pair gives it,
  and the manifest of the files says so.
- The command reads one read-only snapshot, so all files show one record.
- The command writes one folder, named by the date of the release, and never writes over a folder
  of the same date. It writes in a hidden folder first and renames it at the end.
- The folder holds the export files and a manifest of the files in JSON: the version, the date,
  whether the release shows the NATO pair, the date rule of each sanctions regime, the disclaimer,
  and the path, the size and the SHA-256 checksum of each file. ADR 0015 gives the GeoJSON and the
  JSON-LD files, and ADR 0017 the alignment matrix of the sanctions lists.

### The CSV files

- UTF-8 with a byte order mark, RFC 4180, lines that end with CR LF. A spreadsheet reads UTF-8 only
  with the mark, and the record holds Cyrillic names.
- The version, the date and the disclaimer come first, as lines that start with `#` (the comment
  prefix of the W3C tabular data model). PU1 asks each file to hold the disclaimer.
- A cell that a spreadsheet runs as a formula starts with a single quote, because the values come
  from untrusted pages.
- The entities, the relations and the claims each have one file. A claim is a value of an element
  or a relation. Its identifier is the identifier of the relation, or the identifier of the
  element, a slash and the key, so it stays the same from one release to the next.
- The claims file is long: one row for each claim and each cited passage of a public document of
  the claim, and one row for a public document with no cited passage. Each row repeats the label
  and the licence of the claim.
- A citation belongs to an act and not to one value of the act. A value keeps the passages of its
  act in a document that hold the value, compared on the letters and digits alone. When no passage
  holds it, the value keeps each passage of its act in that document.

### The licence of a row

The licence of a row comes from the providers of its public documents, and the row takes the most
permissive one: CC-BY 4.0, CC-BY-NC 4.0, or the fixed text "derived fact; source under the provider
licence, not redistributed". A document with no provider, and a licence word that the release code
does not know, give the fixed text. The map is in the release code. The tools that store an
official act or list give its provider.

The UK Sanctions List is under the Open Government Licence v3.0, which asks for an attribution
only, so a row that rests on it takes CC-BY 4.0.

### The read

- The release reads the record through functions in the database that run with the rights of
  their owner. Only the roles that run a tool can call them.
- Each function reads the views of the read API as their owner. The views give the whole record to
  a role that runs a tool and the public read to every other role, so the functions get the public
  read of PU1 with no copy of its rules. They add the rules of a release: each row has a public
  document and names only its public documents; a person is in the release only when the record
  holds a designation of that person by an element that is not a person, with a public source; a
  relation is in the release only when its two ends are.
- The release holds the record only: no candidate, no held act, no rejected act.
- The functions turn off the compiled plan (jit), as the public read role does (10 October 2026:
  14.4 s with it, 0.28 s without it).

## Alternatives

- **Read the views as the operator role.** It reads every row whole. Refused.
- **Read the views as the public read role.** It reads no passage. Refused.
- **The sources in one cell.** A spreadsheet cannot filter them. Refused.
- **The disclaimer in a column, or in its own file.** PU1 asks each file to hold it. Refused.

## Cost

- A program that reads a CSV file skips the `#` lines.
- The tier of a document in the database and the map of the release code both name the open
  licences. A new licence word goes into both.
- A passage under a restrictive licence is in the release as a short quote.
- A document with no provider gives the restrictive text, also when its real licence is open.
- A value can show a passage of its act that states another value of the same act, when no passage
  holds the value word for word.
