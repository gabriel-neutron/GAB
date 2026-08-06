# OCR

Gabriel does not perform optical character recognition. A scanned document is converted
to text outside the tool before it is ingested.

## Why this is out of scope

The ingestion path accepts extractable text (PDF text, docx, txt, md, html, csv) or
structured data (GeoJSON, shapefile, CSV). That boundary is deliberate: OCR is a
recognition problem with its own error surface, its own tuning, and its own failure modes,
and none of them are investigation problems.

The arbitration criterion is that a capability must multiply investigative capacity within
the project horizon. OCR does not — mature tools already do it well, and running a scan
through one of them before ingestion costs the analyst a single step. Building it inside
Gabriel would mean owning recognition quality forever in exchange for removing that step.

There is a second, sharper reason. Every claim in the evidentiary layer must be traceable
to a source document. An OCR layer inserts a lossy, probabilistic transformation between
the original file and the text that claims are extracted from — so a claim would trace back
not to the document but to a machine's reading of it, with no signal about where the
reading was uncertain. That silently weakens the guarantee the whole system exists to make.

## Prior requests

None yet — seeded from `docs/prd.md` §5 at project setup.
