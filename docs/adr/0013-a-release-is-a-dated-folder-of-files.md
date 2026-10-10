# ADR 0013 — A release is a dated folder of files, read through the release functions

**Status** Accepted · 10 October 2026

## Context

The FNF investigation promises an open dataset with exports. A file that leaves Gabriel is copied
and used again with no control, so it must carry the label of each claim, the disclaimer and the
licence (`decisions.md` PU1), and it must never hold what the public read hides. Later steps add
more files and a static site to the same release. The format of the folder and the way
the release reads the record are costly to change after the first publication, because readers
cite the files and the changelog compares two folders.

## Decision

### One command, one folder

- One worker command writes one release. Its input is the record and a release manifest that the
  operator gives at run time. The manifest is not in the public repository, because it holds the
  contact addresses. Each value of the manifest has a default, except the two contact addresses.
  The manifest refuses a key that it does not know, so a wrong spelling is not silent.
- The parameter that shows the NATO pair is off by default. Until the pair is built, the command
  refuses a manifest that turns it on.
- The command writes one folder, named by the date of the release. It never writes over a folder
  of the same date. It writes the files in a hidden folder first and renames that folder at the
  end, so a run that stops leaves no half release under the name of the date.
- The folder holds the export files and a manifest of the files in JSON: the version, the date,
  the disclaimer, and the path, the size and the SHA-256 checksum of each file. A later file is one
  more entry in this list.

### The CSV files

- UTF-8 with a byte order mark, RFC 4180, lines that end with CR LF. A spreadsheet reads a UTF-8
  file as UTF-8 only with the mark, and the record holds Cyrillic names.
- The version, the date and the disclaimer come first, as lines that start with `#`, before the
  header. This is the comment prefix of the W3C tabular data model. PU1 asks each file to hold the
  disclaimer.
- A cell that a spreadsheet runs as a formula (it starts with `=`, `+`, `-` or `@`, and it is not a
  number) starts with a single quote. The values come from untrusted pages.
- The entities, the relations and the claims each have one file. A claim is a value of an element
  or a relation. Its identifier is the identifier of the relation, or the identifier of the
  element, a slash and the key of the value, so it stays the same from one release to the next.
- The claims file is long: one row for each claim and each cited passage of a public document of
  the claim, and one row for a public document with no cited passage. Each row repeats the label
  and the licence of the claim. A reader filters it in a spreadsheet with no other file.

### The licence of a row

The licence of a row comes from the providers of its public documents, and the row takes the most
permissive one: CC-BY 4.0, CC-BY-NC 4.0, or the fixed text "derived fact; source under the provider
licence, not redistributed". A document with no provider, and a licence word that the release code
does not know, give the fixed text. The map from a licence word to these three texts is in the
release code. The tools that store an official act or list give the provider of what they store,
and a migration gave the provider to the documents that they stored before.

### The read

- The release reads the record through functions in the database. Each function runs with the
  rights of its owner, and only the three roles that run a tool can call it. The public read role
  cannot.
- Each function reads the views of the read API as their owner. The views give the whole record
  to a role that runs a tool, and the public read to every other role, so the functions get the
  public read of PU1 with no copy of its rules. They then add the rules of a release: each row has
  a public document and names only its public documents; a person is in the release only when the
  record holds a designation of that person by an element that is not a person, with a public
  source; a relation is in the release only when its two ends are.
- The release holds the record only. A candidate, a held act and a rejected act made no row.
- The functions turn off the compiled plan (jit), as the public read role does. Measured on 10
  October 2026 on the test database: the claims in 14.4 s with it and 0.28 s without it.

## Alternatives

- **Read the views as the operator role.** That role reads every row whole, so a release would
  hold what the public read hides. Refused.
- **Read the views as the public read role.** That role cannot read the text of a document, so the
  release would have no passage, and its limit is 5 seconds for each statement. Refused.
- **One row for each claim, with a list of sources in one cell.** A spreadsheet cannot filter a
  list in a cell. Refused.
- **The disclaimer in a column, or in its own file.** A column repeats a long text in each row. PU1
  asks each file to hold it, so a file of its own is not enough. Refused.

## Cost

- A program that reads a CSV file must skip the lines that start with `#`. The guide says so.
- The claims file repeats the columns of a claim on each row of the claim.
- Two lists name the open licences: the tier of a document in the database and the map of the
  release code. A new licence word must go into both.
- A passage of a document under a restrictive licence is in the release as a short quote. The
  licence text of the row tells the reader that the source is not redistributed.
- A document that a person or a tool stored with no provider gives the fixed restrictive text,
  also when its real licence is open. Only a provider row makes a licence known.
