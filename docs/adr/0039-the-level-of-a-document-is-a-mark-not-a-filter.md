# ADR 0039 — The level of a document is a mark, not a filter

**Status** Accepted · 28 November 2026

## Context

On 6 November 2026, the panel verdict for #1278 made the export strict: a release named only the
documents at level A of the signed list (`research/signed-list.md`), and a row with no such
document stayed in the record. No release was built under that rule until 27 November 2026.

That first build lost most of the record. Against the release `data-2026-10-28`, the entities went
from 5,366 to 3,582, and the relations from 6,235 to 4,130. Each event, each military unit, nearly
each port and facility, and each row of GEM left. Of the 2,399 documents that the old release cited,
180 stayed. The report could no longer replay its own figures on the release.

The operator decided on 28 November 2026: the level was made to tell the reader how far to trust a
source. It was never meant as a filter. The release keeps as much correct data as it can, and the
corrections of errors stay.

## Decision

- A release names each public document that is not restricted (`public.export_document`), at
  each level: A, B, C or not verified.
- The level stays a mark. The signed list still gives it, and the release still shows the NATO
  pair of each claim that has one.
- A restricted document never leaves: its title, its address and its excerpts stay in the record.
  A bought file and a document with no public address are not public, as before.
- The other rules of a release do not change: a person is in only with a designation, a relation is
  in only when its two ends are, and the release holds no candidate.

## Consequences

- The release holds again the facts of GUR, of the press, of GEM and of other documents that are
  not at level A, each with its source and its party mark (ADR 0037).
- A document whose terms of reuse were not read leaves with its excerpts. This is the operator's
  decision; the signed list keeps the conditions of each source, and a restricted mark still holds
  a document back.
- The read of the node audit through the tunnel follows the same view, so record mode can check
  each document that a release cites.
- This replaces the strict export of the verdict for #1278.
