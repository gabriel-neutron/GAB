# ADR 0024 — A slash date of the FCDO UK Sanctions List is day/month

**Status** Accepted · 14 October 2026

## Context

`propose` keeps a start or an end of a relation only when a cited passage states that day. A date
with slashes and two parts of 12 or less, as 09/05/2025, has two readings: the ninth of May in
Europe, the fifth of September in the United States. The general rule reads such a date as no day,
so the relation has no start, or it is not proposed.

The FCDO UK Sanctions List (`https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv`) writes
each "Date Designated" with slashes. On 14 October 2026, in step 1.4 of the FNF work, 156 UK
designations of vessels had such a date. The FCDO "Format guide for the UK Sanctions List"
(`doc_b4e3296d0b41`) says that the field is "The date the person, entity or ship was designated under that regime", and the file
writes each date as DD/MM/YYYY. A panel (a skeptic, a software architect, a sanctions lawyer)
agreed on this reading.

## Decision

- When each cited passage of an item comes from the FCDO list, `propose` reads a date with slashes
  as day, month, year. A document is the FCDO list when it has the address of the list, or when
  the UK list tool gave it its provider: the same bytes can be stored first at another address.
  The check of the bounds, the check of the other values and the check of a year from the publication day read it the same way.
- An item that also cites a passage of another document keeps the general rule, because that
  passage can use the other order.
- The general rule does not change for all other documents.

## Alternatives

- A search for a dated notice for each date. Refused: a notice can name no ship, and the work is
  large for a date that the list already states.
- Accept the items with no date. Refused: no tool can add a start date to an accepted relation
  later.
- A day/month rule for each source that the operator names. Not done: one source needs it now.
  Add a source to the same check when its own guide states the order.

## Cost

The rule rests on the address or the provider of the document. A copy of the list that the
operator stores, and that the UK list tool never reads, keeps the general rule.
If the FCDO changes the date format, this ADR and the check must change.
