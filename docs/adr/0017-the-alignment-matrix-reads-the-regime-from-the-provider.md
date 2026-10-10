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

- A designation belongs to a regime when its public documents have a provider of that regime: EU
  EUR-Lex for the EU, the OFAC SDN list for OFAC, the UK Sanctions List for the UK. Only the
  official tools give these providers to the files that they store. The EU financial sanctions
  file has no tool, so it gives no regime.
- A designation that cites no such document counts in no regime, also when the designating element
  is clearly an EU act. The research skills ask for the official file as the source of a
  designation.
- A designation that cites the files of two regimes counts in no regime: one relation cannot hold
  the two dates.
- The file counts the designations of a vessel with an IMO number that count in no regime, for each
  of the two reasons, so the operator sees what the matrix leaves out.
- The release read gives the provider of each public document for this test.

### The join is on the IMO number only

- The matrix reads the IMO value of each public vessel of the release. A value of seven digits
  counts, also as a number or with the prefix "IMO". A column tells if the check digit is right,
  and a wrong check digit does not remove the row: the matrix shows the number that the source
  states.
- All the public vessels with one IMO number give one row, so a renamed vessel and two vessels that
  the operator has not merged yet give one row. A vessel with no IMO value is not in the matrix.
- A name never joins two vessels.

### The date of a listing

- The manifest names the date rule of each regime. The defaults are the entry into force (EU), the
  date of the Recent Actions notice (OFAC) and the date designated (UK). The rule selects where the
  date comes from, and the file and the manifest of the files state the rules.
- The date of a listing is the start date of its designation, as the writer proposed it from the
  source. The research skill tells the writer which date each regime takes. The release does not
  check the date against the rule, and the file says so.
- Under the EU rule, a designation with no start date takes the entry into force of the element
  that designates, but only when that value cites a document of the designation. A base act that a
  later act amends states its own entry into force, and not the day when the vessel was added.
- Else the listing has no date. A column for each regime tells where the date comes from, and the
  gaps of the row are empty. A date from another source, for example the day when the project read
  the document, would give a false gap.
- When one regime lists one IMO number more than once, the row gives the first listing with a date,
  and its end date. The marks count each listing, ended or not.

### Each cell points to a claim of the release

A row names the claims of the IMO values, the designation claim of each regime and the claim that
gives each date. The matrix is computed from the release record only, so each of these claims is a
row of the claims file. The labels of the vessels are a JSON list, because a label is free text.

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
- A wrong start date of a designation gives a wrong gap. The release cannot check the date against
  the rule.
- A designation with an end date still counts in the marks.
- A designation that cites the files of two regimes is only counted. The writer must split it.
- A new official provider of a regime needs a change of the release code.
