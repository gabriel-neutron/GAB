# ADR 0017 — The alignment matrix reads the regime of a designation from the provider of its document

**Status** Accepted · 10 October 2026

## Context

The FNF investigation asks for the alignment of the EU, OFAC and UK lists, vessel by vessel. A
release gives it as one file: one row for each IMO number that at least one regime lists. Readers
count the gaps from this file and cite it, so the meaning of a row, the test that gives the regime
of a designation, and the date of a listing are costly to change after the first publication.

The record holds a designation as a relation "designated by" from a vessel to an element that
designates, mostly a legal act. No field of the record names the regime. The label of the
designating element is free text that a research AI writes.

## Decision

### The regime comes from the provider of the cited document

- A designation belongs to a regime when one of its public documents has a provider of that
  regime: EU EUR-Lex or the EU financial sanctions file for the EU, the OFAC SDN list for OFAC, the
  UK Sanctions List for the UK. Only the official tools give these providers to the files that they
  store.
- A designation that cites no such document is not in the matrix, also when the designating
  element is clearly an EU act. The research method already asks for the official file as the
  source of a designation.
- A designation that cites the documents of two regimes counts for each of them.
- The release read gives the provider of each public document for this test.

### The join is on the IMO number only

- The matrix reads the IMO value of each public vessel of the release. A value of seven digits
  counts, also with the prefix "IMO". The check digit is not tested: the matrix shows the number
  that the source states.
- All the public vessels with one IMO number give one row, so a renamed vessel and two vessels that
  the operator has not merged yet give one row. A vessel with no IMO value is not in the matrix.
- A name never joins two vessels.

### The date of a listing

- The manifest names the date rule of each regime. The defaults are the entry into force (EU), the
  date of the Recent Actions notice (OFAC) and the date designated (UK). The file and the manifest
  of the files state the rules.
- The start date of a designation holds the date that the rule names: the writer reads it from the
  source of the designation. So the date of a listing is the start date of its designation.
- When the designation has no start date, an EU listing takes the entry into force of the element
  that designates, when the record holds it as a public value. The rule names that date, and an EU
  act states it.
- Else the listing has no date. The file says so in a column for each regime, and the gaps of the
  row are empty. A date from another source, for example the day when the project read the
  document, would give a false gap.
- When one regime lists one IMO number more than once, the row gives the first listing with a date.

### Each cell points to a claim of the release

A row names the claims of the IMO values, the designation claim of each regime and the claim that
gives each date. The matrix is computed from the release record only, so each of these claims is a
row of the claims file.

### The marks

The gap between two regimes is the difference of their dates in days. Two marks give the two
directions: listed by OFAC or the UK and not by the EU, and listed by the EU and not by OFAC.

## Alternatives

- **The regime from the designating element: its label, or an identifier such as a CELEX number.**
  A label is free text in two scripts, and an OFAC or UK designation has no identifier of its act
  in the record. Refused.
- **Both the provider and the designating element.** Two tests can disagree, and the file then
  needs a rule for the conflict. Refused.
- **A date column for each rule in the record.** The record holds one start date for a relation.
  Refused.

## Cost

- A designation that a research AI proposed from a press release or a news page, with no official
  file, is not in the matrix until the official file is cited.
- A wrong start date of a designation gives a wrong gap. The matrix cannot check the date against
  the rule.
- A designation with an end date still counts as a listing. The relations file gives the end date.
- A new official provider of a regime needs a change of the release code.
