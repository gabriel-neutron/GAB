# ADR 0011 — A decision table, not a score, decides the public state of each claim, and a letter rates only the originator

**Status** Accepted · 4 October 2026

**Not built: the letter of the originator.** The register cards, the track record, the letter,
the sanction flags and the trust lists are not built. A first build of their tables, doors and
loaders had no caller, and it was removed on 6 October 2026 (operator decision). The method below
stays the decision. A later spec builds the rating, and it can start from the stored name of the
originator of each claim.

## Context

GAB publishes facts about named units, companies, vessels and persons on a public map. Agents write
most of these facts, and no person reads each one (ADR 0010). Thus the method must decide with no
operator, and each public sentence must be correct, sourced, attributed and correctable. GAB must
be able to defend each public sentence in public and in court.

The earlier method graded each document and added points into a score. It graded by claim type
and by domain, and it counted copies as confirmation. This ADR replaces the rule score of ADR 0010
and decisions.md S1.

## Decision

Each decision has one tool, and no tool does the job of another:

- An **ordered decision table** decides the public state of each claim. There is no score, no
  points, no weights and no sums.
- A **letter** (A to F) rates the **originator** only: the body or person that first put the
  information out. The letter never rates a platform, a host, a domain, a document or a claim type.
- A **digit** (1 to 6) describes one claim from the count of independent origins and
  contradictions. It is an internal tag. No gate reads it.
- A **confidence** word applies only to GAB's own judgments, never to a record or to the statement
  of another party.

The letter and the digit are independent: the code that computes one never reads the input of the
other. Code never adds or multiplies them, and the public never sees them.

The parts come from ADMIRALTY, the Berkeley Protocol, the UK 3x5x2 model, ICD 203 and OCCRP
practice.

## What gets a rating

- **A new originator is F**: "no basis to judge". F is not a bad grade. An F source still counts
  for attribution.
- **A** comes from an approved register card: the originator is an official issuer of records
  (a sanctions list, a company registry, a court register, a gazette). The register of the
  subject's own country counts, not only Western issuers.
- **B to E** come only from a measured track record: claims for which this originator was first or
  first-hand, and that ground truth later settled. Agreement of other media is not ground truth. A
  claim that the rule itself accepted never enters a track record.
- **E** removes the originator from the count of support. A claim with only E origins stays
  attributed, and it never becomes a fact.
- **The operator can set a letter** as a prior, with a reason. It has no expiry. It changes only
  on a proved fabrication, a failed audit, or an operator act.
- A list of a party to the conflict gets no register card. Its entries are attributed statements
  and leads.

No model writes a letter, a digit, a state, a flag or an audit label. The app enforces this with
database grants.

## How a claim is read

- Each claim rests on a **span**: two offsets in a stored, untouched copy of the document. The
  excerpt that an agent gives is an input that code checks: code finds it in the stored text and
  checks that it holds the claim values, and the stored record keeps the offsets and cites the
  document. A failed check counts zero.
- **Two independent readings** are necessary. For free text, the second reading is a check by a
  model of another family: it reads the claim with its passage and answers supported, not
  supported or unclear. For another format, the second reader is of another kind where possible:
  a parser for a structured file, OCR for an image. When the check does not support the claim,
  when it fails, or when a second reading is missing, the claim is disputed and held. The method
  never takes a majority of model votes.
- **Access** says how the source knows: issuer, first-hand, holder of a declaration, repeater, or
  unknown. Only a stored structural fact can make a source an issuer or first-hand. A model label
  can only lower access.
- **Origins, not copies, count.** Code joins copies of one origin into one group. Two groups are
  independent only when each has its own structural mark and code finds no join. Bodies with one
  owner or controller are one group. By default, sources are dependent.
- The text of a stored document goes to the model as it is stored (operator decision of
  6 October 2026).

## The decision table in principle

The table is ordered, and the first row that matches gives the state. These principles govern the
rows:

| Situation | State |
|---|---|
| Integrity fails, or a record or verified observation contradicts the claim | Rejected, not public |
| A check cannot run, the readers disagree, or an adverse claim about a named subject waits for its denial search | Held, not public |
| An official record from a register-card host enacts the fact | Accepted, in GAB voice |
| A reproducible geolocation package verifies the tested fields | Accepted, in GAB voice, for the tested fields only |
| Two or more independent, identified, first-hand origins agree, none is a party to the conflict, and the claim is not adverse about a named subject | Accepted as a GAB assessment, moderate confidence |
| GAB's own algorithm or interpretation | Analysis, with a likelihood word |
| A passed span from an identified originator, with no anchor | Attributed: "According to X ..." |
| The only origins are under sanctions | Labelled quote, with limits |
| All other cases | Held, and the search loop runs |

Each accepted path starts **off**. A path opens per format cell (path and item format) only when
an audit of that cell shows a low enough false-accept bound. One audited false accept, or one
accepted canary, stops the cell. Only the operator opens a stopped cell again. Code never makes a
rule less strict.

A unit shows on the map only when one of its claims has its own claim-level citation. A document
of a parent unit is a lead for the child, not a citation.

## The legal guard

- Every name that a cited source gives can be public. GAB shows no personal data that a cited
  source does not already publish.
- An **adverse allegation** about a named person or company that is not an official act is always
  attributed. It never goes into GAB voice and never becomes a corroborated fact.
- Before an adverse allegation goes public, the search loop looks for a **public response** by the
  subject. The text shows the response, or says that GAB found none, with the search date.
- **GAB never contacts a subject.** No code path sends a request for comment.
- Visitors have two inbound channels: "Report an error" and "Right of reply". A reply changes the
  wording, never the state.
- Code writes every public sentence from templates. No free model text reaches the public page.
  GAB voice uses dated status words, never labels such as "evader".

## What the operator does

The operator sees exceptions and audit samples only:

- approve each register card, the list of parties to the conflict, the sanctioned host list and
  the list of adverse predicates, once, and each later change;
- do all hand checks of the audit, in small batches. Each label must name settling evidence outside
  the two sources under test. Agent agreement is never a label;
- build the geolocation gold set;
- split origin groups, decide contested letters, confirm fabrications;
- decide disputes and contested allegations that code sends to the queue.

## What is public

- Accepted, analysis, attributed and labelled-quote claims, each sentence with a footnote.
- The method statement, the rule version and the audited error bound of each cell.
- A source card with the track record in words, never the letter.
- A public audit page and a correction log.

Held and rejected claims are not public.

## Consequences

- **At launch, all accepted paths are off.** The site shows attributed, analysis and labelled-quote
  claims only. Most order-of-battle facts stay "according to" for a long time.
- **Hide until sourced removes most earlier units from the map** until the search loop finds a
  claim-level citation for each.
- **The operator's time limits autonomy.** Each format cell needs many hand checks before it opens.
- **Legal risk stays.** GAB names every person that a source names, with an anonymous publisher and
  no legal review. The operator accepted this risk. The legal guard reduces it, but does not
  remove it.
- A change that lets a model write a letter, a state, a flag or an audit label reopens this ADR.
- **What proves it wrong:** an accepted canary or an audited false accept in an open cell, or a
  sentence in GAB voice that an issuer record later contradicts.
