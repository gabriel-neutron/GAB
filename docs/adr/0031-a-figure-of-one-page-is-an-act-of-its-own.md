# ADR 0031 — A figure of one page is an act of its own

**Status** Accepted · 30 October 2026 · Extends ADR 0030

## Context

ADR 0030 lets a figure enter the record only through the promoted mapping of a stored table. Some
figures that the report shows have no table. The Ministry of Finance of Russia and the Ministry
of Economic Development publish the monthly Urals price as one short announcement for each month.
A table of these values made by a research session is not a source (ADR 0030). So the record could
hold no such figure, and the report showed values that no decision covered (#1106, #1111).

The operator decided on 30 October 2026, after the expert panel (software-architect,
osint-expert, skeptic), that these figures must be decided facts of the record.

## Decision

- **A figure that one page states is one act of the review queue.** An agent proposes it
  with the same tool as a claim: the measure, the value, the unit, the period, the reporter, the
  method and the publisher, with the page and the excerpt that state the value. The act is a unit
  of its own, as an edit of an attribute is. A reviewer promotes or rejects it, and the reviewer
  never decides an act that the same agent proposed.
- **The promotion writes one figure through the same table as a mapping.** The figure names the
  act that made it where a loaded figure names its mapping. It has no load job. The span of the
  figure is the span of the excerpt in the page, so the figure points at the words that state it
  (P9).
- **Code checks what it can read.** The excerpt must be in the page, as for each act. The value
  must be in the excerpt, as the page writes it: a comma or a point for the decimals, and spaces
  between the groups of digits. A value that the excerpt does not hold makes the act disputed.
  The period and the unit are words of the page in its language, so the second model checks them
  and marks the act disputed when they are not supported.
- **The licence comes from the provider of the document, as in ADR 0030.** A document with no
  provider gives a restricted licence. The publisher is a word of the act, because a page of a
  ministry has no provider.
- **A table still goes through a mapping.** This door is for a page that states a small number of
  figures. An agent that proposes the rows of a table one by one breaks ADR 0030: the
  reviewer refuses such acts, and the agent maps the table.

## Cost

- The review queue gets one unit for each figure: 46 units for a monthly series of four years. The
  reviewer reads each one, which is the purpose.
- The figure table has two kinds of origin, a mapping and an act. A read that counts the figures
  of a mapping filters on the kind of the act.
- A wrong promoted figure is not corrected in place (ADR 0030). A correction is a new figure from a
  new edition of the page.
- A page with no provider gives a restricted licence, so the public read does not show its figure.
  The figure shows only when its document gets a provider with an open licence, and that is a
  decision of its own.
