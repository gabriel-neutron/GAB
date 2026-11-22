# ADR 0036 — A report names its data release

**Status** Accepted · 10 November 2026

## Context

An audit of the report of 1 November 2026 could not rebuild some counts. The live record changes,
and no dated state of it was kept for the date of the report. The data release already writes the
public record with a checksum for each file, and the site already pins one release by tag and
checksum.

## Decision

- **No new exporter.** The data release is the dated export of the public record.
- **The stamp names the release.** `public/report/stamp.json` holds the tag and the checksum of the
  pinned release, and a test fails when they differ from the pin.
- **One release for each report.** The operator cuts a release when a report is published, pins it,
  and then prints the report (`docs/deploy.md`).

## Consequences

- A reader can load the release and count the public record. The release has fewer entities than the
  whole record (military units, for example, are mostly not public), so the counts of the report that
  cover the whole record cannot be rebuilt from it. The report must say which count it gives.
- The figures of the report that come from outside data files are not in the release. They trace to
  their own sources only.
- A release asset can be replaced under its tag, and a tag can be deleted. The checksum fixes the
  bytes but does not keep them. A deposit that cannot change is a later decision.
- The pinned release of 28 October 2026 is not the state of 27 October. This ADR does not rebuild the
  past: it gives each next report a dated release.
