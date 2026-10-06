# ADR 0011 — A decision table, not a score, decides the public state of each claim, and a letter rates only the originator

**Status** Accepted · 4 October 2026

Seven specialist agents (all Claude models) wrote and attacked this method on 4 October 2026. A red
team, a completeness reviewer and an STE reviewer then read it, and the operator answered all
questions the same day (E5). The agents share one model family, so their agreement is not
independent review (R12).

This ADR holds the full trust and rating method, version v4. It **replaces ADR 0010 §7** (the rule
score and its three bands), it **supersedes the designs in progress of #207 and #223**, and it **stops
#182 and #186**. The list is in "Entries this ADR changes". Code writes
`decision_origin = 'rule:v4.<n>'` on each rule decision.

The method has two goals, and it keeps them together:

1. **AI autonomy.** Several agents do the work. Clear rules decide. The operator sees exceptions
   and audit samples only.
2. **Journalistic reliability.** Each public fact is correct, sourced, attributed and correctable.
   GAB can defend each public sentence in public and in court.

GAB publishes facts about named units, companies, vessels and persons on a public map. Agents write
most facts, and no person reads each one (ADR 0010, accepted risk). Because of this, the method
makes each decision with no operator.

The words of this ADR are defined in E2. "Source" always means the **originator**. "Document"
means a stored page or file. "Code check" is a check that code does; "hand check" is a check that
the operator does. "Visitor" is a person who reads the public site.

### 1. Each decision has one tool, and the old method gave the ADMIRALTY grades the wrong jobs

| Decision | Input that drives it | Input that must NOT drive it |
|---|---|---|
| D1 Public display (state and wording) | Decision table (§8), modality, access, flags, legal gate (§13) | Letter alone, digit, domain, claim type |
| D2 Automatic promotion (`decision_origin = 'rule:v4.<n>'`) | Decision table + audit health of that format cell (§12) | Model self-confidence, agent agreement |
| D3 Review-queue order and search budget | The ordered sort keys of §10.1 step 6 (exposure, then harm class, then number of search gaps). No product, no score. | Letter (a good source can be wrong on a key claim) |
| D4 Search for more evidence | The search-gap list that code makes (§10.1 step 1) | Count of copies, majority |
| D5 Letter maintenance | Resolved claims against ground truth | Agreement of other media; rule-accepted claims |
| D6 Legal gate per named subject | Official act (class 1), adverse predicate, denial search result | Letter |

The old method caused five past faults. It gave the ADMIRALTY letter and digit jobs that the
doctrine does not give them:

| Misuse | Past example in GAB | How v4 avoids it |
|---|---|---|
| Grade by claim type | CARTO plan §4: "A1 listing, A2 reasons, B2 for flag/owner fields" (#140); "Established press C3" (#156); #217 `P_authority` "for this fact" | No claim-kind column. Access and modality are per span. The register card says which fields the issuer declares. |
| Digit on the document | S1 in `decisions.md`; #182 regex on `documents.admiralty`; #186 "A6" | The digit is a view on the claim. Documents carry no rating. |
| Digit as a decision band | #207: "2 = accept", "6 = one origin", "1 = three origins" | The decision table decides. The digit keeps its doctrinal meaning. |
| Grade by domain or medium | #223: "User-content hosts ... always get 0"; GABRIEL ADR 0008 "web/social = F" | Carriers are never rated. Originators are keyed by canonical id. |
| F read as bad | #207: "E, F = 0" | F counts in full. Only a proved track record gives E. |
| State-media class cap | #223: "state-funded ... C at most; 0 on its own state" | No class cap. Party = belligerent table + stored control record. Sanctions per regime, from the lists. |
| History by majority agreement | #223 item 5 | Track record only from first or first-hand claims that ground truth settled. |
| Model panel rates sources | #223 panel (collector, advocate, critic, judge) | No model writes a letter. Models propose originator facts with stored spans. |
| Copies counted as confirmation | Rule v1 free `upstream` word: ten wire copies count ten | Origin groups by code; default dependent; two repeater-unknown groups never count as two. |

### 2. The method has seven layers, and ADMIRALTY is an internal tag only

| Layer | Object | Standard | Who |
|---|---|---|---|
| Layer 1 Item | Capture, hash, untouched copy, earliest archive capture, chain of custody | Berkeley Protocol paras 155, 167-168, 178 | Code + collector agent |
| Layer 2 Origin | Originator (canonical id), origin group, access, modality per span | Berkeley para 177; Bellingcat "earliest poster"; UK 3x5x2 | Readers propose; code decides |
| Layer 3 Letter | A-F per originator | ADMIRALTY reliability (STANAG 2511) | Code, from register cards and track records; operator letters as priors |
| Layer 4 Digit | 1-6 per claim, a SQL view | ADMIRALTY credibility | Code |
| Layer 5 State + confidence | ACCEPTED / ATTRIBUTED / ANALYSIS / LABELLED QUOTE / HELD / REJECTED + DISPUTED overlay; confidence on GAB judgments only | ICD 203, UK PHIA | Code |
| Layer 5b Legal gate | Official act, adverse predicate, denial search, status wording | Loi du 29 juillet 1881, LCEN, Defamation Act 2013, GDPR Art. 85 | Code + search loop; operator by exception |
| Layer 6 Public text | Code templates from structured fields; one footnote per sentence | OCCRP, Bellingcat | Code |

In this ADR, "layer n" is a row of this table, and "Ln" is always a lock of §11.

Reasons for this combination (E3 compares the standards):

1. ADMIRALTY is the only widely known scale with two separate axes. It also has an honest "no
   basis" value (F, 6). Code can compute it from recorded facts, so the human failure (87 % of
   ratings on the diagonal, Baker 1968) does not apply. ADMIRALTY has no provenance rules, no
   publish decision and no claim confidence. Because of this, it stays an internal tag only.
2. The Berkeley Protocol and Bellingcat give the provenance backbone: preservation, "the earliest
   poster is the source", and "a biased or non-credible source can still post content that can be
   independently verified".
3. UK 3x5x2 gives the question "how does the source know?" and the "untested" default. This is the
   `access` enum.
4. ICD 203 and PHIA separate fact, likelihood and confidence. They apply to GAB's own judgments
   only.
5. OCCRP and ICIJ give the public rule: primary records make facts; other media are attributed
   statements; every sentence has a footnote.

**How ADMIRALTY is used.**

1. The letter rates the **originator**, never the host, domain, document or claim type.
2. The digit rates **one claim**, from the count of independent origin groups and contradictions
   only. It is a SQL view. No gate reads it.
3. The letter function reads no claim table. The digit function reads no originator table. Only
   the gate reads both. A CI test checks this (lock L2). This is the doctrine: "Reliability and
   credibility ... must be considered independently of each other" (STANAG 2511, annex A-2).
4. A new originator is **F** ("no basis to judge"). F is not E and not 0. F counts for attribution
   and for the digit.
5. Digit 1 needs a **different traced origin**, not more copies. One origin with nothing else on
   the subject is **4**, not 6. Contradicted is 5. No passed citation is 6.
6. Letters B to E come only from a measured track record against ground truth. A comes from a
   register card (or from 75 resolved claims with no error).
7. Code never adds or multiplies a letter and a digit. Code never shows them to the public.
8. Code stores the reason for each letter (the track record or the register card).

### 3. What gets a rating, and who does what

| Object | Table | What it carries | Who sets it |
|---|---|---|---|
| Originator | `originator` (new) | Canonical key; kind; imprint; role (issuer / holder / relay / person / own algorithm); flags `sanctioned{regime, list_entry_id, date}`, `party` (`true` / `false` / `unknown`), `contested`; control record; letter A-F; `letter_origin` (register / track record / operator / gold set); track record (n_resolved, n_true, n_fabricated, list of resolved claims) | Agents propose originator facts with stored spans. Code sets the letter and the flags. The operator sets or contests a letter with a reason. |
| Register card | `issuer_card` (new) | Hosts, TLS names, URL patterns, record kinds, fields with their declarant (issuer or holder), identifier types, terms of use, jurisdiction | An agent drafts it. The operator approves it once per issuer. |
| Document | `documents` (exists) | Hash, untouched copy, `retrieved_at`, earliest archive capture, `uri`, `archive_uri`, OCR text item for images, flag `sanctioned_host` | Collector code. **No rating.** |
| Citation | `citation` (replaces `proposal_citation` of #219) | `claim_id`, `doc_id`, `originator_id`, `origin_group_id`, span offsets, access, structural mark, modality, check results, `post_hoc`, `same_family`, `ocr`, model family and served model per reading | Readers propose offsets and enums; code verifies. |
| Origin group | `origin_group` (new) | The documents that carry one origin; flag `sanctioned_origin` | Code joins; the operator splits. |
| Claim | `proposals` + `claim_eval` (new) | State, `valid_from` / `valid_to` (event time), as-of date, `adverse_predicate`, confidence (judgments only), digit (view), rule version, `decision_origin` | Code |
| Subject legal record | `subject_legal` (new) | `denial_search` per allegation: date, queries, languages, result (documents found, or none) | Code + search loop; operator by exception |

**Never rated:** a platform or carrier (substack.com, t.me, vk.com, x.com, archive.today,
tgstat.ru, sanctions.lursoft.lv, audit-it.ru), a registrable domain, a URL path, a document type, a
claim type, a subject, a model vote, a panel. `documents.admiralty` stays NULL, and a later
migration drops it.

| Task | Code | Agents | Operator |
|---|---|---|---|
| Capture, hash, archive, deep-link check, hidden-text strip | Yes | Collector | - |
| OCR of images (Tesseract rus+ukr+eng, versioned) | Yes | - | - |
| Span check, identity check, date check, sanctions-list match by entry id, register-card host check | Yes | - | - |
| Personal-data minimisation before each model call, with same-length placeholders (§3.2) | Yes | - | - |
| Claim extraction (offsets and enums only) | Compares the two readings field by field | Reader 1 and reader 2 (§3.1) | - |
| Access and modality | Consistency checks; a model label can only lower access | Readers propose | - |
| Adverse predicate | Keyword list per subject kind; claim schema field | Readers propose; a reader can set it, never clear it | Approves the predicate list once |
| Origin grouping | Joins (hash, perceptual hash, citation chain, shared unique details, cross-lingual similarity) | Tracer proposes an upstream with a URL; code accepts it only when it can fetch and store it | Splits only |
| Party relation | From the belligerent table + subject affiliation + stored control record | Proposes controller facts only with a stored record span | Approves the belligerent table once |
| Sanctioned flags and regime | From the EU and US lists by entry id, and from the sanctioned host table. A UK-only listing gives no flag (§10.1 step 7). | Proposes host-table rows with the list entry | Approves the host table once. Each later change needs a new approval. |
| Letter | From register cards, track records and gold sets | Proposes originator facts with spans; never a letter | Approves register cards; may set or contest a letter with a reason (no expiry, §7.1) |
| Digit, gate, state, confidence, queue order, wording | Yes | - | Exceptions only (§10.2) |
| Verified observation | Re-checks the evidence package (§6.3) | Geolocator 1 and 2 propose packages, blind to each other | Builds the 40-item geolocation gold set; weekly sample |
| Search loop, with denial search | Search-gap list, budget, order | Pro and contra searchers, equal budget | - |
| Audit | Samples, bounds, brakes, canary table, code-built gold set from issuer rows | Red-team canary writer (separate pipeline) | All hand checks: gate path (c) checks, geolocation gold set, weekly sample |

No model writes a letter, a digit, a state, a flag, an origin split or an audit label. Database
grants enforce this, as `db/apply/90_grants.sql` does today for `documents.admiralty`.

#### 3.1 Two independent readings

Back-end AI runs through freellmapi with a second model family (ADR 0010 §1 and §4). Model families
still make correlated errors. Because of this, the second reading uses a different kind of input
or reader where it can:

- Structured issuer files (OFAC `SDN.CSV`, EU OJ XML, annex XLII): reader 2 is a non-LLM parser.
- Images: reader 2 is the OCR text. A vision model can only propose a value that the OCR text
  contains. Names match with a fuzzy match. Identifiers (v/ch number, IMO, OGRN, MMSI, CIN, LEI)
  must match exactly, never fuzzy. No match: the citation counts 0.
- Images, relation claims: a relation on a chart (parent unit, subordination) needs a layout check.
  Code finds the bounding boxes of both names in the OCR output and the connector line between
  them. Without a passed layout check, the relation stays a lead, and the chart row gives a name
  citation only.
- Free text: reader 2 is a model of another family, given the untouched HTML or a screenshot
  (another input form) when possible.
- Each citation stores `same_family`. A claim whose only readings are same-family never anchors and
  never counts for gate path (c). It can still be ATTRIBUTED (§8 row 8).
- **Family probe (weekly, code).** Code reads `same_family` and "served-model mismatch" from the
  model name that freellmapi returns. A free aggregator can send two model names to one backend, or
  fall back to another model with no notice. Because of this, code runs a fixed prompt set each
  week against both pinned names. If the answers match above a threshold (a parameter row), code
  sets `same_family = unknown` for all free-text readings since the last passed probe. `unknown`
  fails closed for free text: like `true`, it blocks anchor use and gate path (c) use. It does not
  put the claim in HELD.
- Disagreement on a field: that field is HELD and goes to the search loop. The gate never takes a
  majority of model votes.
- Fail closed: when no second reading exists (an outage of the second family, or a served-model
  mismatch that refuses the answer), the claim is HELD (§8 row 3a). The job pauses and resumes. It
  never falls back to one reading. This is the only case in which the model family puts a claim in
  HELD. A second reading with `same_family = true` or `unknown` blocks only anchor use and gate
  path (c) use (lock L16).

#### 3.2 Model tier and personal data (Q4)

- **All model calls use the free tier** (freellmapi), also calls that hold personal data.
  OpenRouter stays the paid switch of ADR 0010 §4, but the method does not require it.
- **Code minimises personal data in each prompt.** Before a call, code removes dates of birth, home
  and postal addresses, identity numbers and contact data from the text, unless the task of that
  call needs the field. Example: a call that extracts "X is a director of company Y" gets the names
  and the company, not the date of birth or the address.
- **Offsets stay valid.** Code replaces each removed field with a placeholder of the same length in
  Unicode code points (for example, `#` repeated). The offsets that the reader returns then point
  to the same characters in the untouched copy, and code runs the span check on the untouched copy.
  If a same-length placeholder is not possible, code keeps an offset map per call and stores it in
  `model_call`. A CI test uses a page that holds a date of birth and an address, and checks that
  each span passes on the untouched copy.
- Identity checks on dates of birth and identifiers run in code. No prompt needs a date of birth
  for an identity check.
- The `model_call` table (ADR 0010 §4) stores, per call, the categories of personal data that the
  prompt held after minimisation.
- The residual GDPR risk is R8 (accepted by the operator).

### 4. Name rule: every name that a source gives can be public (C4)

Every name of a person or a company that a cited source gives can be public. A name needs no
public-interest record and no role category. A name follows the state of its claim like any other
field (§8). This keeps the mitigation of PU1: GAB shows no personal data on a natural person that a
cited source does not already publish.

The safeguards that do not restrict names stay:

- attribution always: a claim that is not an anchor or a gate path (c) fact shows as "According to
  X ...";
- the adverse predicate and its wording (§13 item b, class 3);
- the denial search before an adverse allegation goes public (§10.1 step 3);
- no gate path (c) for an adverse claim about a named subject, with a second guard for a named
  natural person (§8 row 6, items 11 and 12);
- no labelled quote of an adverse allegation about a named natural person (§8 rows 9 and 10);
- status wording with a snapshot date (§13 items d and e).

A name match is still a lead for identity (§5.4). The name rule decides display, not which entity a
name is.

### 5. The citation: access, modality, checks, identity

#### 5.1 Access and span value

`issuer` (the record is the act; needs a fetch from a register-card host over TLS) /
`first_hand` (the originator saw, measured or holds the thing) / `holder` (holds a declaration of
another party: owner field in a registry, AIS message) / `repeater` (cites, copies or compiles
another origin) / `unknown`.

1. Code sets `issuer` and `first_hand` only from a stored structural fact.
2. For `issuer`, the structural fact is a register-card host.
3. For `first_hand`, the structural fact is a **structural mark**: the originator's own media with
   a hash and an earliest capture, its own sensor id, its own record, or its own filing.
4. An identified originator with no structural mark is not `first_hand`. Its span is `repeater,
   origin unknown` until the tracer stores its upstream, or `unknown`.
5. Analysis and compilation are not observation. An order-of-battle compilation (ISW OOB PDF, unit
   `340659f4`; CNA SMD report, unit `57760b26`; `henrybolton.substack.com`, unit `5fb7a62b`) is
   `repeater, origin unknown`.
6. A self-declared "we saw" with no structural mark is `unknown`.
7. A reader label can never raise access from `unknown` or `repeater` to `first_hand`. Only a
   stored structural fact can. A model label can only lower access.

**Span value rule.** The span must contain the claim value: the place name, the coordinates, the
number, the date, or the related entity. A span that contains only the subject name supports only
the existence claim and the name claim of that subject. Example: a span that names a child unit
does not support the child's position, even when the parent's position is known.

#### 5.2 Modality, per span (not per document)

`enacts`, `asserts`, `attributes`, `alleges`, `denies`.

- An `attributes` span ("Reuters reported, citing ...") moves the citation to the named origin only
  when code stores the attributed document and that document passes its own span check. Else access
  = `repeater`, origin unknown.
- A denial that attaches a record carries two spans: the denial (`denies`) and the record
  (`issuer`). The record counts as a contradiction.
- Modality does not decide if a claim is adverse. The adverse predicate (§13 item b) decides it.

#### 5.3 The data type selects the checks, never a grade

| Item kind | Checks (code first) | Typical access |
|---|---|---|
| Structured issuer list (`SDN.CSV`, OJ XML, annex XLII) | Card host, hash against the bulk file, non-LLM parser, identifier checksum, list version, as-of date | issuer |
| Issuer PDF or HTML (MCA21 MGT-7, GISIS page, EGRUL extract) | Card host, two readers of different input form, field checksum (IMO, OGRN, LEI, CIN), terms of use | issuer for the entry; holder for declared fields |
| Telegram / VK / X post | Post id (not channel), numeric channel id, message id, edit date, forward-from id, hash, earliest copy, re-fetch schedule | first_hand only with a structural mark (own media with hash) |
| Image / video | Hash, perceptual hash, reverse search, OCR, evidence package (§6.3) | verified observation of tested fields only |
| Image of a chart (org chart) | OCR, exact identifier match, layout check for relations (§3.1) | name citation only, unless the layout check passes |
| Satellite scene | STAC scene id, acquisition time, footprint, cloud mask, resolution limit (object length >= 5 px to detect, >= 20 px to classify) | first_hand sensor; never identity alone |
| AIS | MMSI-IMO match, MID against flag, gap and speed tests, duplicate MMSI, same message across vendors merged | holder (the vessel declares) |
| Military map / aggregator | Deep link, capture, search for a cited upstream | repeater, origin unknown unless code stores the upstream |
| Text report (press, think tank, blog, forum) | Byline, canonical account, imprint, quotes, wire detection | attributes or repeater; first_hand only with a structural mark |
| Own derived record (STS algorithm) | Inputs and code version stored | derived; never an origin for its own inputs |

A failed span or identity check counts 0. An unreadable document (dead link, captcha, channel link
with no post) gives HELD.

#### 5.4 Identity keys

- **Vessel:** IMO plus a dated history (name, flag, MMSI, owner, manager) as time-bounded
  attributes. A check passes only if all three conditions are true: the IMO is valid; the document
  date falls in the window of the MMSI / name / flag pair in a record; no issuer record marks the
  IMO scrapped, cloned or duplicate. A cloned identity is a separate claim (HELD).
- **Company:** OGRN, LEI, CIN, or registry number.
- **Person:** two identifiers (date of birth, registry id) or one strong id. A name match is a lead
  (#208).
- **Military unit:** v/ch number + designation + parent formation + date range. A name match ("1st
  Tank Army" against "1st Guards Tank Army") is a lead. The v/ch number matches exactly. Two v/ch
  numbers for one unit are a contradiction (K), not a match. Example: unit `289b598e` (47th Tank
  Division), whose note records 45807 and 54096.

### 6. Origins, independence, verified observations, event time

#### 6.1 Origin groups and independence (C3, C7)

- **Default: dependent.** Two origin groups are independent of each other only under L23: each
  group has a different structural mark (§5.1), and code finds no join. A tracer label never proves
  independence. Two text claims with no structural mark are dependent and stay dependent.
- **Independence means "not the same owner or controller" (C3).** Two originators that one body
  owns or controls, from a stored record, are one origin group. This join applies to all origin
  grouping (O, O' and the gate path (c) legs). The flag `same_family`
  is about AI model readings only (§3.1). It never describes two originators.
- Code joins documents by: same hash; perceptual hash of images; one cites the other; same
  originator; same owner or controller (from a stored record); shared unique details (coordinates,
  serial numbers, bort numbers); cross-lingual similarity >= 0.85 with a pinned, versioned
  embedding model.
- Code calibrates the embedding model on UK/RU/EN/AR pairs before the first run. For a language pair
  with no calibration, independence is `unknown`, and `unknown` is dependent for gate path (c).
- No time window decides independence.
- Two `repeater, origin unknown` groups never count as two (L6). A repeater counts only with its
  stored upstream (L7).
- A merge is automatic. A split is an operator act only. A merge from an external free field
  (Wikidata "owned by") is not allowed; a merge needs a stored record span or an operator act.
- **Flags.** The flags have two levels:
  - `party` and `sanctioned_origin` apply to the origin group. A copy on another site inherits the
    flag of its origin. A group with `sanctioned_origin` counts 0 (Q3).
  - `sanctioned_host` applies to each document whose host or account is in the sanctioned host
    table, whatever its group. That document gets the display limits of a labelled quote (§14.1).
    Example: `ria.ru/20250912/svo-2041421725.html` (unit `126dfa78`) reports a Ministry of Defence
    statement. The document joins the MoD group (party, not sanctioned). The document still gets
    the display limits, if RIA is in the host table (G7).
- **Party value (C7).** `party = true` needs the belligerent table and a stored control record
  (state body, state funding, state ownership). A state body of a belligerent and its official
  channels fail closed: with no record, they are party. An analyst or an outlet with unknown
  control gets `party = unknown`. `unknown` blocks a gate path (c) leg. `unknown` puts no party
  label on the text. `party = true` puts the party label on the text (§14.1).
  `party = false` needs one of these: a stored control record (ownership, funding, registration)
  that shows no belligerent owner or controller, and an originator jurisdiction outside the
  belligerents; or an operator act with a reason. The default is `unknown`. A CI test checks that a
  new originator with no record has `party = unknown`. Examples: CAST / `bmpd.livejournal.com` (unit `be930838`);
  `a-rakovskij.livejournal.com` (4 units).
- **Circularity.** An item that cites GAB, or matches GAB text and appeared after it without a
  named primary, joins GAB's own group and counts 0.

#### 6.2 `post_hoc`

Code sets `post_hoc` from the earliest archive capture (CDX) or from GAB `retrieved_at`, never from
the page date.

- A later issuer record or verified observation counts in full (a new OFAC listing can close a
  search gap).
- A later F or repeater document counts for attribution and for the digit, never as an anchor.
- A document with `post_hoc = true` is never a gate path (c) leg. A later leg can count only if its
  structural mark (own media, own record) is dated before GAB's entry.
- Contradictions, retractions, delistings and annulments always count, whatever their date.

#### 6.3 Verified observation

A verified observation is a reproducible package, not a model verdict:

- coordinates; hash of the media;
- at least 3 matched features that code checks against reference imagery with a stored scene id,
  within a set distance;
- shadow azimuth and sun angle for the stated time window;
- separate verdicts: place, time window, object type, unit or hull marking (tactical sign, bort
  number, IMO on the hull, read by OCR).

OSM may propose candidate features only. OSM is an editable free field (L19). The match must be
with reference imagery. The package stores the OSM object version and date of each candidate.

It anchors only the fields with a verdict:

- "A strike happened at X on D" can be a fact.
- "Unit U is at X" needs a marking verdict, or a second origin that meets the gate path (c) leg
  conditions (§8 row 6, items 2-7). Else the unit field stays ATTRIBUTED. Only the tested fields go
  public in GAB voice ("A video verified by GAB shows tanks at X on D").
- "Person P did it" goes through the legal gate (§13). An observation never makes an adverse
  claim about a named person or company a fact (§8 row 5).

Example: unit `289b598e` (47th Tank Division) has nightwatch as its only source, and its note
records a v/ch conflict. A verified video of tanks at Mulino does not make "the 47th Tank Division
is at Mulino" a GAB fact.

The originator "GAB geolocation check v<n>" anchors only after its track record on the
**geolocation gold set** reaches B. The operator builds this set: 40 images with a known place and
date, in small batches (#222). The tool shows the image, the proposed place and time, and the
correct / wrong buttons. The gold set has a known answer, so it needs no "cannot settle" button
(§12). 40 correct of 40 gives a Wilson lower bound of 0.91 (B needs 0.85). The
gold-set result sets the letter of this originator directly (§7.1). Until then, a pass is a lead
plus an ANALYSIS statement. Monthly canaries of recycled media keep testing it.

Two LLM readings of one image count as one reading. A second reading of a satellite or STS image
uses a different method (a code detector with a known error rate, or another sensor: Sentinel-1
SAR against Sentinel-2 optical).

#### 6.4 Event time

Each claim has `valid_from` and `valid_to` (event time with an error bar), apart from the post
date. Corroboration counts only items with overlapping windows. Re-posted old footage fails the
chronolocation window. A fact expires, or code re-checks it, at its measured change rate.

**Withdrawn claims.** Code re-fetches each cited post on the schedule of §5.3. When the
originator deletes the post, edits it so that the span is gone, or publishes a `denies` span about
its own claim, code ends the citation ("ended", not deleted) and writes the correction log
(§14.3). A claim with no remaining citation leaves the public page. The public text never shows a
withdrawn allegation.

### 7. The letter, the digit and the confidence are three outputs, and there is no score

**There is no score.** No points, no weights, no sums. The gate is an ordered decision table (§8).
The letter, the digit and the confidence are three separate outputs with three separate inputs.

#### 7.1 The letter (per originator)

- **F** is the default for each new originator: "no basis to judge".
- **A**: the originator has an approved register card.
  - Register cards: OFAC, EU OJ / EUR-Lex, GLEIF, IMO GISIS, Paris MoU, Companies House, MCA21,
    EGRUL / FNS, flag registries, kremlin.ru for decrees, SAMR, court registers, the UK sanctions
    list (FCDO / OFSI).
  - The register must hold the subject's own jurisdiction (EGRUL, MCA21, SAMR, flag registries),
    not only Western issuers.
  - The letter is A on the originator. It does not read the claim. Access and modality say if a
    span is an act or an assertion: an OFAC listing span = `issuer` + `enacts`; an OFAC statement
    of reasons = `asserts` or `alleges`.
- **Belligerent lists get no register card (C5).** GUR (`war-sanctions.gur.gov.ua`) is a party
  originator with no register card. Its list is not a legal sanctions act. The same rule applies to
  a list of any belligerent of the covered conflict. Its entries are ATTRIBUTED and leads only
  (§10.1 step 7, §15 row 13). A party's own legal act on a register-card host (a kremlin.ru decree)
  is a different thing: gate path (a) can state that the act exists (§8 row 4).
- **B to E**: from the measured track record only.
  - A **resolved claim** is a claim by this originator that ground truth later settled, true or
    false. The originator must be first or first-hand for that claim.
  - "First" means the earliest self-asserting member of its origin group by document date. The
    capture date is the tie-break.
  - Not counted: claims that nobody settled; claims that only other media agree with;
    rule-accepted claims; restatements of a record that existed before the claim; claims where the
    originator was a repeater. Example: a channel that reposts OFAC designations adds nothing to
    its track record.
- **Gold-set letters.** For an own algorithm (for example "GAB geolocation check v<n>"), the
  gold-set result sets the letter directly.
- **Operator letters (C8).** The 82 `sources.csv` rows (A 47, B 34, C 1) load as originators with
  `letter_origin = operator`. Code keys them by a canonical id that the operator checks once, never
  by name (`load:originators`). An operator A means reliability, never issuer access. No digit is
  loaded. **An operator letter has no expiry.** It changes only on one of these events:
  1. a proved fabrication: code sets `contested` and queues the originator; the operator confirms E
     (§7.4);
  2. an audit failure: an audit label or an issuer record shows that a first or first-hand claim of
     the originator is false; code sets `contested` and queues the originator. The operator then
     sets a new letter with a reason, or he removes the operator letter. In the second case, code
     computes the letter from the track record (F with too few resolved claims), with
     `letter_origin = track record`;
  3. an operator change, with a reason.
- **Staff authors**: a signed author with fewer than 10 resolved claims uses the letter of the
  imprint. This applies only when the page is on the imprint's own canonical host or account. A
  byline on another host inherits nothing.
- **Impersonation**: a new id that uses an existing name (a Telegram channel named "Reuters",
  `reuters-defence.co`) is a new originator at F until the operator merges it. Until then, its
  display name never appears alone in public text (§14.1).
- **Step limit.** A move from F to the first measured letter (B, C, D or E) is one step. Between
  measured letters, an external originator moves at most one step per 90 days. The step limit does
  not apply to gold-set letters. Code stores the resolved list behind each letter.
- An **AUDIT job** takes up to 10 past first or first-hand claims of an F originator and checks
  them against anchors. A good Substack analyst can then leave F with no operator task, if anchors
  exist for its claims. In the ORBAT domain, few anchors exist (R2, R17).
- **What the letter changes:**
  - Letter E removes the origin group from O (§8). A claim whose only origins have letter E is
    still public as ATTRIBUTED, and it never promotes (C2).
  - The staff-author rule reads the imprint letter.
  - The source card shows the track record, never the letter (§14.2).
  - The letter never changes queue order or search budget (D3). It never opens a gate alone and
    never makes a fact (L15).

#### 7.2 The digit (per claim, SQL view, no gate reads it)

Inputs: O' (all independent origin groups with a passed span check) and K (contradictions).

O' does not read the flags. The digit is the doctrinal ADMIRALTY credibility, internal only, and no
gate reads it (L2, L15). Because of this, a sanctioned or E group can change the digit. The rule
"counts 0" applies to O in the gate (§8), not to the digit.

Code evaluates the rows in this order. The first row that matches gives the digit.

| Order | Digit | Condition |
|---|---|---|
| 1 | 6 | No passed citation |
| 2 | 5 | K >= 1 |
| 3 | 1 | O' >= 2 and K = 0 (independent groups have different traced origins by definition, L23) |
| 4 | 3 | O' = 1 with a soft conflict (name variant, date gap) |
| 5 | 2 | O' = 1 and consistent with an issuer record or a verified observation on the same subject |
| 6 | 4 | All other cases (O' = 1 and nothing else on the subject) |

"Consistent" reads issuer records and verified observations only, never rule-accepted claims
(L17).

#### 7.3 Confidence (ICD 203)

- Only on GAB judgments: gate path (c) facts and ANALYSIS.
- Not on issuer-record facts (they are information). Not on attributed statements (they are
  someone else's information).
- Gate path (c): always **moderate confidence** (Q1).
- ANALYSIS: an ICD 203 likelihood word that code selects from the audited precision of that method.
- Never a confidence level and a likelihood word in one sentence.

#### 7.4 Bands

| Scale | Band | Rule |
|---|---|---|
| Letter | A | Register card; or 75 resolved claims with no error (Wilson 95 % lower bound 0.951) |
| Letter | B | Wilson 95 % lower bound of the true share >= 0.85 and zero proved fabrications; minimum n for a perfect track record: 22 (22/22 gives 0.851) |
| Letter | C | Lower bound >= 0.65; minimum n for a perfect track record: 8 (8/8 gives 0.676) |
| Letter | D | Lower bound >= 0.40 and n >= 5 |
| Letter | E | Upper bound < 0.40 with n >= 5; or one proved fabrication (an authored and doctored item) that the operator confirms |
| Letter | F | All other cases |
| Digit | 1-6 | Table §7.2 |
| Confidence | moderate | Gate path (c) |
| Likelihood | ICD 203 row 1 ("very unlikely" ... "almost certain") | ANALYSIS only, from the audited precision band |
| Audit bound | cell open / brake | Wilson 95 % upper bound of false accepts <= 2 % per format cell (§12) |

Code evaluates the letter rows in this order: E first (a confirmed fabrication, or the upper
bound), then A, then B, C and D by the lower bound, then F. A proved fabricator never keeps a
better letter. A CI test checks that one confirmed fabrication with 20 true of 22 gives E.

Each letter row is a parameter row with a CI test: a perfect track record at the stated minimum n
reaches the letter. An operator letter (§7.1) is a prior: these bands do not move it.

### 8. An ordered decision table gives the state of each claim

The table is ordered. The first row that matches gives the state. The DISPUTED overlay is not a
row; code adds it after the table.

Let **O** = independent origin groups with a passed span check, minus groups with
`sanctioned_origin` or letter E. The gate removes them, not the digit. Let **K** = contradictions
from an issuer record, a verified observation, or an origin that meets the gate path (c) leg
conditions (row 6, items 2-7).

**Unit rule (Q6).** A unit shows on the map only when it has at least one claim with its own
claim-level citation. Each other claim of the unit (name, position, parent, v/ch number) is public
only with its own claim-level citation.

| # | State | Condition | Public? |
|---|---|---|---|
| 1 | REJECTED | Integrity fails (hash, span, or identity not cured in 90 days); the only source is an AI answer or a broken value; an issuer record or a verified observation contradicts; a canary | No (the audit log keeps it) |
| 2 | HELD (legal) | The claim has an adverse predicate about a named person or company in the claim span (§13 item b), it is not class 1 (§13) or it is a party court act about the adversary (§13 item c.1), and the denial search has not run on the current version of the claim | No |
| 3 | HELD (v1 inherited) | A v1 claim whose only reference is the parent unit's document, or an entity-level URL with no span for this claim (Q6) | No. The parent's document and the entity-level URL are leads for the search loop. |
| 3a | HELD (fail closed) | No second reading exists (outage, served-model mismatch, §3.1); the two readers disagree on a field; the identity check is pending; the document is unreadable (dead link, captcha, channel link with no post); a check cannot run | No. The job or the search loop resumes. |
| 4 | **ACCEPTED gate path (a), record** | An `issuer` + `enacts` span from a register-card host; two readers of different kind (parser or input form); identifiers pass; K = 0 against anchors; the parameter row `path_a.<cell>` exists. A party originator can anchor gate path (a) only for its own act as issuer with a register card (for example a kremlin.ru decree). Its other content stays ATTRIBUTED. If the claim has an adverse predicate about a named person or company (§13 item b), the act must be class 1 (§13 item c.1); else row 8. A court act of a belligerent about a national or a body of the adversary uses the party wording of §13 item c.1. | Yes, GAB voice, status wording with as-of date |
| 5 | **ACCEPTED gate path (b), observation** | A verified observation of the tested fields, from a geolocation originator at letter B or better on the gold set; K = 0; the parameter row `path_b` exists. For a field that the observation did not test, one more origin that meets row 6, items 2-7. Without it, only the tested fields go public in GAB voice, and the untested field stays ATTRIBUTED. A claim with an adverse predicate about a named person or company never uses this row; it goes to row 8 (§6.3). | Yes, GAB voice, tested fields only |
| 6 | **ACCEPTED gate path (c), corroborated** | All must be true: (1) two or more origin groups; (2) each leg is from an identified on-record originator with a canonical id, and has `first_hand` access with a structural mark (§5.1); (3) no leg has `party = true` or `party = unknown`; (4) no leg has `sanctioned_origin` or letter E; (5) no leg is a repeater; (6) no leg has `post_hoc = true`; (7) no leg rests on readings with `same_family = true` or `unknown`; (8) the legs are independent of each other under L23, and no language pair is uncalibrated; (9) no two legs share an owner or controller; (10) event windows overlap and K = 0; (11) the claim has no adverse predicate about any named person or company in the claim span (§13 item b); (12) as a second guard, the claim is not adverse about a named natural person; (13) the parameter row `path_c.<cell>` exists for the format cell of each leg (§12). | Yes, as a GAB assessment with moderate confidence |
| 7 | ANALYSIS | Output of an own algorithm, or a GAB interpretation (STS, hull from imagery, a geolocation not yet anchor-grade) | Yes, with an ICD 203 likelihood word |
| 8 | ATTRIBUTED | A span passed, from an identified originator (canonical id), with no anchor, and one of: O >= 1 (all repeater-unknown groups together count as one, L6); or the only origins have letter E (C2). These claims stay here: party statements, whatever the count, with the party label (§14.1); claims whose only origins are repeater-unknown (an aggregator or a compilation, §15 row 1); claims whose readings have `same_family = true` or `unknown` (§3.1); holder declarations ("declared in its MGT-7 filing of <date>"); adverse allegations that passed row 2; gate path (c) candidates while their cell is not open; claims whose only origins have letter E, which never promote. | Yes, attributed wording |
| 9 | LABELLED QUOTE | The only origins have `sanctioned_origin` (Q3), and the quote is not an adverse allegation about a named natural person. A class-3 allegation about a company comes here only after the denial search (row 2), and the denial-search result shows with the quote (§14.1). | Yes, labelled quote only (§14.1); the group counts 0 |
| 10 | HELD | All other cases: no passed span from an identified originator, and no E origin; anonymous or collective originator (Wikipedia, forum, unsigned directory) = lead only; `alleges` alone with no identified originator; a sanctioned quote that is an adverse allegation about a named natural person | No; the search loop runs |

**DISPUTED overlay (after the table).** Code adds the DISPUTED overlay to the state from the table
when one of these is true: K comes from a counted origin that is not an anchor; or a dispute passed
the code span check (§14.3). The overlay shows both positions, each attributed. A claim in state
ANALYSIS can also have the overlay.

**Sanctioned statements on a claim with other origins.** The claim keeps the state from the table.
The sanctioned statement shows as a labelled quote in the details panel only. It never shows when
it is an adverse allegation about a named natural person.

**Launch state of each gate path.**

| Gate path | At launch | What opens it (writes the parameter row) |
|---|---|---|
| (a) structured issuer list (record-row cell) | Off | Code-built gold check: the parser reads at least 190 annex XLII and SDN rows against the bulk files with no false accept. Code writes `path_a.record_row`. |
| (a) issuer PDF / HTML | Off | About 190 weekly-sample hand checks in that cell with no false accept, or a code compare with a structured file of the same issuer. Code writes `path_a.<cell>`. |
| (b) | Off | The geolocation gold set gives letter B (40 of 40, §6.3). Code writes `path_b`. The weekly sample and the brake then watch it. |
| (c) | Off (Q1) | About 190 hand checks in one format cell with no false accept. Code writes `path_c.<cell>` for that cell only. Each cell opens separately. |
| ANALYSIS | On | No promotion. Until a method has an audited precision, the template says "GAB analysis (precision not yet measured) indicates ..." with no likelihood word. |

**Gate path (c) and the audit (Q1).** Code computes gate path (c) candidates in shadow mode. The
visitor sees them as ATTRIBUTED. The operator checks them by hand in small batches (§12). One false
accept in a cell raises the need for that cell to about 280 checks; two raise it to about 360.

**Brake (all gate paths).** The brake works per format cell. It fires on a measured false accept
in the cell (a "wrong" label of a hand check or of the weekly sample), or on one accepted canary of
that cell. The cell then shows claims as ATTRIBUTED only, for 8 weeks, and after that until its
bound (all checks of the cell, §12) is again <= 2 %. The new error raises the number of checks that
the cell needs (about 280 after one error, about 360 after two). A second hit removes the parameter
row, and only the operator writes it again. Code never makes a parameter row less strict; only the
operator does.

### 9. Public states, and v1 units stay hidden until sourced

| State | Voice | What the visitor sees |
|---|---|---|
| ACCEPTED (a) | GAB | Plain sentence with status wording, as-of date, footnote to the issuer record |
| ACCEPTED (b) | GAB | "A video verified by GAB shows ..." with the evidence package; tested fields only |
| ACCEPTED (c) | GAB assessment | Plain sentence with two or more footnotes; details panel: "GAB assessment, moderate confidence" |
| ANALYSIS | GAB judgment | Likelihood word; method and audited precision in the details panel |
| ATTRIBUTED | The originator | "According to X ..." with the carrier and handle where needed |
| DISPUTED (overlay) | Both sides | Both positions, each attributed; descriptive words only |
| LABELLED QUOTE | The sanctioned outlet | The label and limits of §14.1 |
| HELD, HELD (legal), HELD (v1 inherited), REJECTED | - | Not shown |

**v1 units (Q6): hide until sourced.** The unit rule of §8 applies. The parent's document is a
lead only. The search loop fetches it and looks for a span that names the child unit.

- If the parent's document names the child in a text span, that span becomes the child's own
  citation for the name claim and the existence claim only (span value rule, §5.1).
- A position, a parent relation or a v/ch number needs a span that contains that value.
- On a chart image, a parent relation needs a passed layout check (§3.1). Else the chart gives a
  name citation only.
- The 267 units with entity-level references follow the same rule. Each entity-level URL is a lead
  until a span ties it to one claim.

This ADR changes the visible behaviour of ADR 0009. A **borrowed position** (ADR 0009, the
precision word `inherited`) is the child's own claim that its best known position is its parent's
point. The map draws it with a halo only when that claim is public, so it needs its own
claim-level citation. An **inherited document** (#13 import) is a document of the parent. This ADR
never counts it as a citation for a claim of the child. The map read draws only units and
positions in a public state (see "Entries this ADR changes").

### 10. The search loop works on named gaps, and the operator sees exceptions only

#### 10.1 Search loop (#219)

1. **Search gaps.** Code names the search gaps of each HELD or ATTRIBUTED claim: no anchor; no
   second independent origin; weak identity; unresolved contradiction; stale; adverse predicate with no
   denial search; v1 claim with an inherited document or an entity-level reference only.
2. **Order of searches.**
   - Vessels and companies: issuer lists (OFAC, EU OJ, UK), GISIS, PSC MoUs (Paris, Tokyo, Black
     Sea, Indian Ocean), flag registry, company registry and LEI, gazettes, AIS and SAR / optical
     scenes, then press and NGO reports as leads.
   - Units: follow relays upstream (aggregator to the Telegram post or mil.ru page), registers,
     court records of the v/ch number, geolocatable media. For v1 units, the parent's document first.
   - A press report that cites a record sends the agent to the record. The report is never itself
     the second origin.
3. **Denial search (Q2, C1).** This step applies to each claim with an adverse predicate that is not
   class 1.
   - Each round runs at least one query family for a public response by the subject: its own site
     and press office, its filings, its official channels and accounts, and press quotes of the
     subject, in the subject's language.
   - A found denial or response becomes a stored document with a `denies` (or `asserts`) span by the
     subject.
   - If the response is on a sanctioned host (for example TASS for Rostec, UAC or Almaz-Antey), the
     loop first looks for the same words on the subject's own site or on a host that is not
     sanctioned.
   - The search runs for each named person or company that carries the adverse predicate in the
     claim span (§13 item b), not only for the subject entity.
   - Code writes the result in `subject_legal.denial_search`.
   - **Span rules for a found response.** Code redacts the names of third-party natural persons in
     the shown span until the operator decides. Code runs the adverse-predicate keyword list on the
     span. A span with an adverse predicate about a third party shows only as "<Subject> published a
     response on <date> [2]", with a footnote and no verbatim text.
   - GAB never contacts the subject (L22).
4. **Budget.** Pro and contra searchers with equal budget. Per claim and per round: 4 fetches per
   search gap, at most 12 fetches, and at most 60k tokens. At least one query family in the
   subject's language each round (language lock). The denial search uses the contra budget. The
   letter does not change the budget (D3).
5. **Rounds** at day 0, 7, 30, 90. **Stop rule:** a claim that does not change after round 2 at low
   exposure stops and stays ATTRIBUTED or HELD. ATTRIBUTED is a stable end state, not a queue item.
6. **Daily budget and order.** The daily budget is a parameter row. Record paths (parser, no search)
   run first. Then code sorts claims by three keys, in this order (no product, no score):
   1. **Exposure:** the claim is public now (ATTRIBUTED or ACCEPTED) before a HELD claim; then by
      the number of public pages that show the subject.
   2. **Harm class:** class 3 (adverse predicate) first, then claims that name a natural person,
      then all other claims.
   3. **Search gaps:** more remaining search gaps first.
7. **Belligerent list entries** (GUR, #208, and any other party list) generate leads. Code queries
   the EU, OFAC and UK lists by IMO. A match creates a separate ACCEPTED "listed by X" fact. The
   party statement stays ATTRIBUTED. A UK-only listing creates an ACCEPTED "listed by the UK" fact,
   but no sanctioned flag and no sanctions label (§14.1).

#### 10.2 Operator queue (exceptions only, in #222 batches)

1. Disputes with a code-found span. The DISPUTED overlay is already public. The operator decides
   within 72 h of the publication of the overlay. This is not a wait for a reply from a subject.
2. Adverse allegations where the denial search found a denial that attaches a record, or where an
   inbound reply (§14.3) contests the claim.
3. HELD claims of high exposure after round 3.
4. Origin-split requests.
5. Register cards; belligerent table; sanctioned host table; adverse predicate list.
6. Audit batches: gate path (c) hand checks, geolocation gold set, weekly sample (§12).
7. Contested letters and E proposals.
8. Replies whose identity code cannot verify (§14.3). The operator checks them with inbound
   evidence only and sends no message (L22).

Rate limit: 20 items per origin per day.

### 11. Twenty-four locks, and each lock has a test

- **L1** No role writes a letter, digit, state, flag or origin split directly; only code and the
  operator.
- **L2** The letter function reads no claim table; the digit function reads no originator table. A
  CI test scans the rule module for attribute keys, claim types and digit reads.
- **L3** A failed span or identity check counts 0.
- **L4** Groups with `sanctioned_origin` and E origins are excluded from O, at origin-group level.
  An E-only claim stays ATTRIBUTED and never promotes. `sanctioned_host` limits the display of each
  document.
- **L5** One origin group counts once.
- **L6** Two repeater-unknown groups never count as two.
- **L7** An `attributes` span or a repeater counts only with its stored upstream.
- **L8** Issuer access needs a register-card host over TLS.
- **L9** `post_hoc` comes from capture dates only.
- **L10** Agent outputs are offsets and enums; code re-reads spans from the untouched copy; code
  strips and flags hidden text.
- **L11** No parameter row = rule off (this includes `path_a.<cell>`, `path_b` and
  `path_c.<cell>`).
- **L12** Agent agreement is never an origin and never ground truth.
- **L13** A letter change re-runs the gate on dependent claims.
- **L14** The text generator refuses any letter, digit or score. Wording never goes stronger than
  the strongest access ("alleges" stays "alleges").
- **L15** A letter never changes a state alone.
- **L16** Fail closed: no second reading (outage, served-model mismatch), reader disagreement on a
  field, pending identity, missing check = HELD. `same_family = true` or `unknown` (also after a
  failed family probe) blocks only anchor use and gate path (c) use; the claim can be ATTRIBUTED.
- **L17** A rule-accepted claim is never an input to a track record or to the digit (no self-feed).
- **L18** A canary claim can never be shown (hidden `canary` table, read only by the display guard
  and the auditor).
- **L19** No external free field (Wikidata, WHOIS, OSM, report text, reply text) is a hard-rule
  input.
- **L20** Audit labels come only from ground truth or from the operator, never from a model.
- **L21** Code removes personal data that a call does not need before the call, and keeps offsets
  valid (§3.2).
- **L22** No code path sends a message to a subject (no request for comment, no letter, no e-mail).
- **L23** Two origin groups are independent of each other only when each has a different structural
  mark and code finds no join. A tracer label or a model label never proves independence. Test: two
  text documents with no structural mark and no join give O = 1 for gate path (c).
- **L24** A sender domain or a From header alone never verifies the identity of a reply sender, and
  no verification step sends a message (§14.3). Test: a reply with a forged From header and no
  DKIM pass shows as "A person who states that he is X".

### 12. Each format cell opens on its own audit bound

- **Ground truth** = issuer records, verified observations of tested fields, and operator decisions
  that name their evidence. Never agent agreement. An agent may pre-sort a batch. An agent never
  gives a label that enters a bound (L20).
- **Format cells:** gate path (a, b, c, ANALYSIS) by item format (record row, RU text, EN text, UK
  text, image / OCR, AIS / derived).
- **Bound rule (one rule for all cells).** A cell opens only when its Wilson 95 % upper bound of
  false accepts is <= 2 %. With zero errors this needs about **190 audited claims in that cell**
  (3.84 / (190 + 3.84) = 0.0198). 50 claims give 7.1 %; one week of 20 gives 16.1 %. The bound
  reads all checks of the cell since its first check, with errors included. It has no time window,
  so old checks never leave it, and the operator can do them in small batches over any time. A
  cell with fewer than 190 checks stays ATTRIBUTED. Gate path (b) is the exception: the 40-image
  gold set is its gate (§6.3, §8 launch table).
- **English-majority control.** 64.5 % of v1 references are English. A sample that follows the data
  certifies EN text and leaves RU text and image / OCR with few checks. The per-cell rule stops
  this. A gate path (c) claim with a leg in a closed cell stays ATTRIBUTED.
- **Who checks (Q5):** the operator does all hand checks himself, in small batches (#222):
  - about 190 checks to open the first gate path (c) cell (shadow candidates); each further cell
    needs about 190 more;
  - 40 known-place images for the geolocation gold set (§6.3);
  - the weekly sample (at least 20 rule decisions, spread over the cells).
- **The check tool (C6)** shows the fact, its sources (each span highlighted in the stored copy,
  with originator and capture date) and three buttons: **correct / wrong / cannot settle**.
  - A "correct" or "wrong" label needs settling evidence outside the two origins of the candidate.
    The tool asks: "Which record settles this?" The operator names one item: an issuer record, a
    verified observation, or his own evidence (with a one-line note that names it). An operator
    letter of one of the two legs is not evidence.
  - The tool refuses a bare click. A candidate with no settling evidence is "cannot settle". It
    does not enter n.
  - A "wrong" asks for one line of reason.
- **Gold data per gate path:**
  - gate path (a): code-built from the 674 annex XLII rows (#145) and SDN rows. These labels come
    from issuer rows (ground truth), not from a model. It measures gate path (a) only.
  - gate path (b): the 40-item geolocation gold set plus operator-checked observation cases.
  - gate path (c): the operator's hand checks with settling evidence.
  - The 328 operator claims (#187) join the shadow set when the operator copies them to the machine
    (G4).
- **Canaries:** 20 per month by attack type (copy chain, impersonation, backdating, injection,
  same-name entity, cloned IMO, stale delisting, altered mirror, recycled media, OSM edit, forged
  reply). A separate red-team agent or code templates write them. The extractors never see them.
- **Trigger.** The brake of §8 is the only trigger. Weekly counts only inform the operator.
- **Agent health:** error rate per agent and per family against ground truth; agreement-when-wrong
  per agent pair on canaries; extractor kappa per field; cost per accepted fact; share of HELD
  claims that the loop resolved; family probe results.
- **Fairness:** acceptance rates by subject country and by language; share of `party = true` and
  `party = unknown` legs by country of the originator; OCR failure rate by language.
- **Public audit page:** n and the bound per format cell, the canary results, and the fairness
  rates.

### 13. The legal gate attributes, searches for a denial, and never contacts a subject

GAB never contacts subjects (Q2): no request for comment, no letter, no waiting period. Every name
that a source gives can be public (§4, C4).

a. **Names.** No public-interest record and no role category are necessary (§4).
b. **Adverse predicate.** "Adverse" is a code property of the claim, not of the modality. The claim
   schema stores `adverse_predicate` from a closed list per subject kind:
   - companies and bodies: sanctions evasion, supply to a belligerent, fraud, corruption, war
     crime, false flag;
   - persons: the same list, plus any crime named in the claim;
   - vessels: sanctions evasion, shadow fleet, false flag, listing by a belligerent.
   - **Scope.** The list applies to each named natural person and each named company in the claim
     span, not only to the subject entity. A vessel claim with a predicate carries it for each
     named owner, manager and operator. A unit claim that names a commander carries the predicate
     for the commander. The denial search runs for each of them (§10.1 step 3). A CI test uses a
     GUR tanker entry that names an owner and a manager, and a unit claim that names a commander.
   - The operator approves the list once. Each later change needs a new approval.
   - Code sets the predicate from the attribute key or relation type (for example #156
     `settles_through`) and from a keyword list in the subject's language. A reader can set it. No
     reader can clear it.
   - Any claim with an adverse predicate about a named person or company in the claim span enters
     §8 row 2, whatever the modality.
c. **Three classes of claims about a named subject:**
   1. **Class 1, official act.** All must be true:
      - an issuer record from a register-card host (court register, official gazette, sanctions
        list, company registry, or a charge sheet with a case number on a register-card host of a
        prosecutor or a court);
      - when the issuer is party to the covered conflict about this subject, only a court decision
        from a court register is class 1. A party charge sheet or notice of suspicion is class 3.
      - GAB shows the act with its words. A charge carries "presumed innocent" wording. No denial
        search is necessary, except in the next case.
      - **Party court about the adversary.** When the issuing court belongs to a belligerent and the
        subject is a national or a body of the adversary, the fact is only the existence of the act.
        The text names the issuer as a party ("A court of <state> (party to the conflict) convicted
        <person> on <date> under article <n> [1]"). The denial search runs before the text goes
        public, and the class 3 denial-search line follows. GAB voice uses no crime word outside
        the quoted act.
   2. **Class 2, attributed, not adverse:** ATTRIBUTED.
   3. **Class 3, adverse allegation that is not an official act** (an imputation of an unlawful or
      dishonourable act), for persons and for companies:
      - always ATTRIBUTED ("X alleges ..."), or a LABELLED QUOTE with the denial-search line when
        the only origins are sanctioned and the subject is a company (§8 row 9); never GAB voice,
        never gate path (c) (§8 row 6, item 11);
      - a party press post or a notice of suspicion about a named person is class 3. Example:
        `gp.gov.ua/en/posts/udar-po-zitlovix-kvartalax-pokrovska-...` (unit `eb66df78`) gives
        "Ukraine's Prosecutor General (party to the conflict) states that ...";
      - before it goes public, the search loop runs the denial search (§10.1 step 3);
      - when the search finds a public denial or response, it shows next to the allegation,
        verbatim (or a span of it), with its date and footnote, under the span rules of §10.1
        step 3 (third-party names redacted; no verbatim text when the span is adverse about a third
        party);
      - when the search finds none, the text says "GAB found no public response by <subject>
        (search of <date>)" (C1). It never says "did not reply", because GAB sent no request.
   - **Response on a sanctioned host.** A `denies` or `asserts` span by the subject itself, found
     only on a sanctioned host, counts 0 as evidence. It shows next to the allegation, attributed
     to the subject: "Rostec stated, as reported by TASS (<sanctions label>) on <date>:
     '<quote>'". The quote has 200 characters or fewer (Q3). It has no link and no archive link.
d. **Status wording only** (CARTO plan §10, #158): "listed by the EU on <date> under Regulation <n>;
   status checked on <snapshot date>". GAB voice never uses "evader", "shadow fleet vessel" or
   "fraudulent registry" unless an issuer text uses the word, with that text cited.
e. **Status freshness:** each issuer-record status carries `valid_to`, `list_snapshot_date`, list
   version, and for EU listings a CURIA `court_case` check (#158 items 2-3). Re-fetch: daily for SDN
   and EU lists, weekly for registries. A delisting creates a new act and ends the old claim
   ("ended", not deleted).
f. **Inbound channels stay** (they are not outreach): "Report an error" and "Right of reply"
   (§14.3), through a contact form or an address that only receives.
g. **Publisher and editorial frame (Q8a, Q8b).** The publisher is anonymous: the site names no
   directeur de la publication. GAB has no editorial code, and no lawyer reads the method. The
   residual legal risks are R5, R6, R8, R16 and R21-R24, which the operator accepted on 4 October
   2026 (E4.4).

### 14. Code writes every public sentence from templates

#### 14.1 Templates

Code fills the templates from structured fields. No free LLM text reaches the public page.

**Sanctions label (Q3a).** Code names the regime from the lists, by the list entry codes of the
originator or of the host-table row: "under EU sanctions", "under US sanctions", or "under EU and
US sanctions". `<sanctions label>` below is one of these three. The label applies to each document
with `sanctioned_host`, whatever its origin group (§6.1). A host-table row with no list entry gives
no label, and the operator does not approve it. A UK-only listing gives no label (§10.1 step 7).

**Party label (C7).** When an origin of an ATTRIBUTED claim has `party = true`, code writes
"(party to the conflict)" after the originator name: "<Originator> (party to the conflict) states
that ...". `party = unknown` gives no label.

**Unmerged display names.** An originator with no approved imprint link shows as its carrier and
handle: "the Telegram channel @<handle>", "the Substack account <id>". When its display name
matches an existing originator, code adds "(not verified as <name>)". The display name of an
unmerged id never appears alone.

| State | Template |
|---|---|
| ACCEPTED (a) | "Designated by OFAC on <date> (SDN <entry id>); status checked on <snapshot> [1]." / "Registered in <city> (EGRUL extract of <date>) [1]." |
| ACCEPTED (b) | "A video verified by GAB shows <object> at <place> on <date window> [1]." |
| ACCEPTED (c) | "<plain sentence> [1][2]." Details panel: "GAB assessment, moderate confidence." |
| ANALYSIS | "GAB analysis of AIS data indicates a likely ship-to-ship transfer on <date> [1][2]." Before the precision is measured: "GAB analysis (precision not yet measured) indicates ... [1]." |
| ATTRIBUTED | "According to Henry Bolton (Substack, <date>), ... [1]." / "Nightwatch lists ..., without a cited source [1]." / "Declared in its MGT-7 filing of <date> [1]." |
| ATTRIBUTED, party | "The Russian Ministry of Defence (party to the conflict) states that ... [1]." |
| ATTRIBUTED, unmerged name | "According to the Substack account cdsdailybrief (not verified as the Centre for Defence Strategies) ..." (unit `1bef054a`). The rule "Unmerged display names" above applies to each such originator. |
| ATTRIBUTED, party act about a person (class 3) | "Ukraine's Prosecutor General (party to the conflict) states that ... [1]." Then the denial-search line. |
| Adverse allegation, response found | "<Originator> alleges that ... [1]. <Subject> stated on <date>: '<verbatim span>' [2]." The span rules of §10.1 step 3 apply. A span that is adverse about a third party: "<Subject> published a response on <date> [2]." |
| Adverse allegation, response found only on a sanctioned host | "<Originator> alleges that ... [1]. <Subject> stated, as reported by <outlet> (<sanctions label>) on <date>: '<quote of 200 characters at most>'." No link, no archive link. |
| Adverse allegation, no response found | "<Originator> alleges that ... [1]. GAB found no public response by <Subject> (search of <date>)." |
| Charge (class 1 official act) | "<Authority> charged <person> on <date> with ... [1]. <Person> is presumed innocent." |
| Court act of a party about the adversary (class 1, §13 item c.1) | "A court of <state> (party to the conflict) convicted <person> on <date> under article <n> [1]." Then the denial-search line. |
| LABELLED QUOTE | "<Outlet> (<sanctions label>) stated on <date>: '<quote of 200 characters at most>'." No outbound link, no archive link. Never an adverse allegation about a named natural person. |
| LABELLED QUOTE, adverse allegation about a company | "<Outlet> (<sanctions label>) stated on <date>: '<quote of 200 characters at most>'. GAB found no public response by <Subject> (search of <date>)." With a response found, the response line of the adverse-allegation templates replaces the last sentence. No link, no archive link. |
| Contested by an unverified reply | "<claim wording> A person who states that he is <X> contests this claim (<date>)." |
| DISPUTED | "Registry R lists flag F (extract of <date>) [1]; the PSC record of <date> lists flag G [2]." Descriptive words only. |

#### 14.2 Details panel and source card

- **Method statement:** "Accepted by method v4 on <date> from the records listed below. A person
  did not review this claim; the operator reviews a weekly sample. Report an error / right of
  reply: <links>."
- Documents with hash and capture date, origin groups, rule version, audited error bound of the
  format cell, contradicting sources, labelled quotes from sanctioned outlets (§8).
- **Source card:** name, kind, imprint, owner and state funding (from records), sanctions status per
  regime, track record, letter origin. **Never the letter.**
  - Track record text: "12 of 13 resolved claims confirmed by records", with a link to each anchor.
  - A false claim shows as "contradicted by <record> on <date>", never as a bare "false".
  - Under 5 resolutions, the card shows no track record. A new originator shows "new source, no
    track record".

#### 14.3 Two inbound channels for visitors

Both channels receive messages only, through a contact form or an address. GAB sends none (L22).

- **"Report an error"** (URL required):
  - Code fetches the URL, stores it and runs the span check with a negation window.
  - The DISPUTED overlay becomes public at once only when the contradicting span comes from an
    origin that meets the gate path (c) leg conditions (§8 row 6, items 2-7).
  - A report against an `enacts` anchor needs an anchor against it (delisting, court act).
  - All other reports go to the queue. The rate limit is per reporter and per claim.
- **"Right of reply"** (named subject only, no URL required; LCEN art. 6 IV):
  - GAB publishes the reply verbatim within 72 h. The 72 h is the time to publish an inbound reply.
    It is not a wait before the publication of a claim.
  - **Identity.** Code verifies the identity of the sender only in one of these cases:
    1. the message passes DKIM and SPF alignment for the subject's own domain (the domain in its
       register card, its filings or its own site);
    2. the subject puts a token on its own TLS host or in a filing. The reply form shows the token
       to the sender on screen when he submits; GAB sends no message;
    3. the operator checks it with inbound evidence only: the subject's own domain, a filing, or a
       second message that the sender starts from an official channel of the subject.
  - A sender domain or a From header alone never verifies an identity (L24). The operator sends no
    message to the sender (L22).
  - With a verified identity, the reply changes the wording of gate path (c) and attributed claims
    about the subject to "X denies" at once. This changes the wording only, never the state of the
    claim (L19).
  - With an unverified identity, the reply shows as "A person who states that he is X replied". The
    claim wording stays. The claim gets the line "A person who states that he is X contests this
    claim (<date>)". The reply goes to the queue (§10.2 item 8).
  - Code redacts third-party names in the reply until the operator decides.
  - A reply does not change a gate path (a) issuer-act fact (the act exists).
  - A reply never enters extraction as evidence.
- **Correction log:** claim id, date, state change, the record that caused it, the new text. The
  public log never shows a retracted imputation verbatim. The internal audit trail keeps the
  verbatim history.

### 15. Each item type: how its originator gets a letter and which gate path it can use

Gate paths: (a) issuer record; (b) verified observation; (c) two independent identified first-hand
origins with structural marks (after audit, per format cell); ATTR = ATTRIBUTED only; LQ =
labelled quote; lead = never public support. The column "Letter" gives the letter of the
originator only. One originator has one letter.

| # | Item type | Originator / carrier | Access, modality | Letter of the originator | Gate paths it can use | Example from our data |
|---|---|---|---|---|---|---|
| 1 | OSINT aggregator / military map | Site operator; own site | repeater, origin unknown; asserts | F; track record only from first claims | ATTR ("Nightwatch lists ..., without a cited source"); one origin per item; search upstream. With a stored upstream, the upstream counts. A chart image gives name citations only, unless the layout check passes. | tochnyi.info PNG `unit-tree-level-1-1st-tank-army.png` (unit `174c6b84`): many units, 1 origin. `nightwatch.services/map` (unit `f06931f8`): no deep link, HELD |
| 2 | News media | Imprint, or byline on the canonical host | attributes or repeater; first_hand only with a structural mark (own photo or video with hash) | F until track record; operator prior if in `sources.csv` | ATTR; one leg of (c) only with a structural mark and not party; LQ when the document has `sanctioned_host` | `tass.com/defense/2118563` + militarnyi.com copy (org `74212d89`): one group; TASS on Russian subjects = party. `ria.ru` (unit `126dfa78`); `news-front.su` (unit `ac96b041`): sanctions status to check (G7) |
| 3 | Wikipedia | None identifiable | repeater | Not used | Lead only; follow its footnotes | `ru.wikipedia.org/wiki/4-я_гвардейская_танковая_дивизия` (unit `36020626`) |
| 4 | Unit directory | Unsigned compilation | repeater, unknown | Not used | Lead only; search for a register or court record of the v/ch | `voinskaya-chast.ru` v/ch 30683 (unit `0d3cadb0`) |
| 5 | Think tank / NGO | The body; named authors | repeater, origin unknown for compilations; first_hand only for own data with a structural mark (own record, own survey file with hash) | F until track record; staff authors use the imprint on its host | ATTR ("CNA (2022) assessed ..."); one leg of (c) only for own data with a structural mark | `cna.org` SMD report (unit `57760b26`) and ISW OOB PDF (unit `340659f4`): compilations, repeater |
| 6 | Social media (not Telegram) | Account by numeric id; platform = carrier | unknown unless a structural mark | F | ATTR with handle; media go to verification for (b) | `x.com/ChrisO_wiki/status/1698943584148283626` (unit `0b8dcaae`); VK captcha page (unit `58a035d4`): HELD |
| 7 | Analyst blog / Substack / LiveJournal | The author by publication id; Substack and LiveJournal = carriers | repeater, origin unknown for analysis; first_hand only with a structural mark; `party = unknown` when control is unknown | F; changes by track record and the AUDIT job | ATTR; one leg of (c) only with a structural mark | `henrybolton.substack.com` (unit `5fb7a62b`); `frontelligence.substack.com` (org `02b83897`); `bmpd.livejournal.com` = CAST (unit `be930838`), `party = unknown` |
| 8 | Forum / Q&A | Anonymous | unknown | Not used | Lead only | `otvet.mail.ru/question/76556298` (unit `072a0eb8`) |
| 9 | Official statement / government site | The body | Act with a register card: issuer + enacts. Statement: first_hand party, asserts. Press post about a person: party, alleges (class 3). | A if the body has a register card; else F | Decree: (a). Statement about the adversary: ATTR, party. Party press post or notice of suspicion naming a person: class 3, ATTR, denial search. A charge sheet is class 1 from a register-card host of a prosecutor or a court when the issuer is not party. When the issuer is party, only a court decision from a court register is class 1, with the party wording of §13 item c.1. | `en.kremlin.ru/acts/news/77336` (unit `f0409484`): decree, (a). `gp.gov.ua` post on a Russian colonel (unit `eb66df78`): class 3 |
| 10 | Other wiki | Editors | repeater | Not used | Lead only | `ru.ruwiki.ru` (unit `42c95ff0`) |
| 11 | Plain web site | Webmaster | unknown | F | Lead only unless an identified originator | `27omsbr.moy.su` (unit `2c6cb277`) |
| 12 | Sanctions list | OFAC, EU (register card); a mirror = carrier | issuer + enacts | A | (a) after a fetch of the issuer file; a mirror is a lead | `sanctions.lursoft.lv` OFAC 36431 (org `74212d89`) leads to OFAC `SDN.CSV`; EU annex XLII (#145) |
| 13 | Party list (C5) | GUR, or any other belligerent (party; no register card) | first_hand party; alleges | F until track record; operator prior if in `sources.csv` | ATTR only: "Ukraine's GUR (party to the conflict) lists X as ...". Lead generator for an EU / OFAC / UK match (§10.1 step 7). An entry about a named company ("war sponsor") has an adverse predicate: class 3, denial search. A tanker entry carries the predicate for each named owner, manager and operator (§13 item b). | `war-sanctions.gur.gov.ua/en/rostec` (org `23dfd3ce`); about 1,400 tankers (#208) |
| 14 | Legal act | EU OJ (card) | issuer (OJ); holder (consolidated text) | A | (a) with snapshot and CURIA check | OJ L 2025/1476 (#157) |
| 15 | Company registry / filing | Registry = issuer of the registration; company = declarant of fields | issuer / holder | A (registry) | "Registered": (a). Owner field: ATTR "declared in its filing" | `audit-it.ru` OGRN 1116164001546 (unit `57760b26`) = mirror, fetch EGRUL; MCA21 MGT-7 of Nayara (#154) |
| 16 | Maritime register / PSC | GISIS, Paris MoU, flag registry | issuer for entries; PSC inspector first_hand | A | Entry: (a). "Registry does not list IMO N" is a fact. A false flag contradicts the vessel's self-report; the registry keeps its letter | IMO GISIS (#150); Paris MoU (#151); Gabon / Comoros `flagged_falsely` (#137, #155) |
| 17 | AIS | Vessel = declarant; vendors = carriers | holder | - | ATTR "AIS signal of MMSI X reported P at T"; a real position or STS needs another sensor; two vendors on one message = one origin | Datalastic (#143); GFW (#144) |
| 18 | Satellite | ESA (register card for scene metadata); GAB detector = own originator | ESA: issuer for scene metadata, first_hand sensor. Detector: derived. | ESA: A. Detector: gold-set letter. | Scene facts within the resolution limit; hull identity or STS = ANALYSIS; (b) for tested fields | Sentinel-1/2 through STAC (#153) |
| 19 | Map / geodata | OSM contributors | repeater | Not used | Candidate features for geolocation only; never a match; not an origin for unit facts | `openstreetmap.org/way/84140228` (unit `b3b4ef0c`) |
| 20 | Investigation | Outlet or team | first_hand where it shows documents with hash | F until track record | ATTR; published documents count as their own items (can reach (a) when they are issuer records) | `kyivindependent.com` investigation (org `f0be4fd5`); `notes.citeam.org` (unit `86ca53b5`) |
| 21 | Telegram | Channel by numeric id. In a public megagroup (amended 6 October 2026), the sender by numeric id: a channel that posts as itself is a channel originator; a user is an anonymous originator, and the post is a lead only (§8 row 10). A private chat, a user dialog and a bot are never read. Telegram and tgstat = carriers | first_hand only with a structural mark (own media with hash) | F | ATTR; media to (b); a channel link with no post: HELD; a mirror joins the post; edits and deletions tracked (a deletion ends the citation, §6.4) | `t.me/shock3OA` (unit `1bef054a`); `tgstat.ru/@specnazahmat/2042` (unit `6593bedb`) leads to `t.me/specnazahmat/2042`; Akhmat = party |
| 22 | Leaks | ICIJ, OCCRP as holders | holder | F until track record | A name match = lead; a record verified against a registry = item "according to records obtained by ICIJ" (ATTR) | ICIJ Offshore Leaks, OCCRP Aleph (#174, #208) |
| 23 | Operator's own work | The cited originators, not the operator | Per cited originator | Operator letters as priors on canonical ids | Per cited originator; the 328 claims re-run all checks | `sources.csv` S01-S82 (#186); claims (#187) |
| 24 | Own derived records | GAB algorithm v<n> | derived | Gold-set letter against imagery and PSC | ANALYSIS with a likelihood word | STS algorithm (#152) |
| 25 | Not a source | - | - | - | REJECTED at capture | `perplexity.ai` (unit `701c4af3`); `[object Object]` (unit `553005f6`) |
| - | v1 units with a **document inherited from parent** (742) | The parent's originators | Lead only | - | HELD (v1 inherited) until a claim-level citation exists; the parent's document is the first lead | #13 import, `inherited` document |
| - | v1 entity-level references (267 units, 17 organisations) | Per URL | Per type above | Per type | Each URL is a lead until a span that contains the claim value ties it to one claim | All v1 rows |

**Worked case (copy chain).** Unit `6593bedb` cites a Telegram post (through the tgstat mirror), a
tochnyi PNG and amalantra.ru. The mirror joins the post (one origin; party: Akhmat). The PNG and
amalantra are repeater-unknown (L6: they do not count as two). There is no anchor. Result:
ATTRIBUTED to the channel with the party label (§8 row 8, §14.1), and a search for an upstream or
a geolocatable item.

**Worked case (two compilers).** Unit `340659f4` (3rd Motorized Rifle Division) cites the CNA
report and the ISW OOB PDF. Both are compilations with no structural mark: `repeater, origin
unknown` (§5.1). L6 and L23 apply: they count as one, not two. Gate path (c) does not apply.
Result: ATTRIBUTED to each (§8 row 8: one repeater-unknown group), after a span that contains the
claim value passes.

### Entries this ADR changes

| Entry | Change |
|---|---|
| ADR 0010 §7 | Replaced. The decision table of §8 replaces the rule score and the three bands. §7 of ADR 0010 is now a pointer to this ADR, and lists what stays. |
| ADR 0010 title and status | A status note under the title says that §7 is replaced by this ADR. The file name stays. |
| ADR 0010 §1 | The back-end AI does span checks and gate inputs (this ADR), not scoring. |
| ADR 0010 §9 step 1 | The rating door of #19 is removed. `load:originators` (§7.1) loads the 82 rated sources as originators with operator letters. Their documents carry no rating. |
| ADR 0010 §9 step 7 | #220 calibration (the calibration part of #9 moved there), then `decide_by_rule`. |
| ADR 0009 | The map read draws only units and positions in a public state (§8, §9). A borrowed position needs its own claim-level citation. The 142 units with `position_precision = inherited` are hidden until they have one (Q6). |
| ADR 0010 §10, rows P1, #42, S3 | The operator, or the decision table of §8, moves a claim to a public state. Queue order uses the sort keys of §10.1 step 6, not a score. |
| ADR 0010, Consequences | "The rule is only as good as the register cards, the span checks and the audit." |
| S1 | Superseded. No document carries an ADMIRALTY grade. The letter rates the originator (§7.1); the digit is a SQL view per claim (§7.2). |
| S3 | Amended again. The automatic method is the decision table, measured by the per-cell audit of §12. The S3 statement "accuracy unmeasured" stays true for a cell until its bound passes. |
| S4, PU1 | The decision origin stays a typed, published column, with the value `rule:v4.<n>` and the method statement of §14.2. The letter and the digit are internal: they are not exported and not shown. PU1 changes: HELD and REJECTED claims are not public (§9). The PU1 mitigation "no personal data beyond what a cited source publishes" stays (§4). |
| P5 | Amended for images: code runs OCR (Tesseract rus+ukr+eng) on stored images, as a second reader (§3.1). |
| #207 DECIDE-BY-RULE | The design in progress (points table, digit bands, "rule v2") is superseded. `decide_by_rule` returns the state of §8. |
| #223 SOURCE-RATING | The design in progress (domain rules, rating panel, class caps, 12-month expiry) is superseded. It is rewritten as the `originator` and `issuer_card` tables (§3, §7.1). |
| #182 RATE-DOCUMENT | Stopped (Q7). No `rate_document`, no `/write/rate-document`, no `upstream` word. |
| #186 SOURCES-LOADER | Stopped (Q7). A new ticket `load:originators` replaces it (§7.1): 82 originators with operator letters, keyed by canonical id, no digit. |
| #217, #218, #219, #220, #221, #222 | Each changes to match §3.1, §5, §6.1, §10, §12, §14 and the locks of §11. |
| #145, #156, #158, #187, #208, #209, #9 | #145 rows go through gate path (a). #156 `settles_through` has an adverse predicate. #158 item 1 becomes the denial-search record (no letters to subjects). #187 claims re-run all checks. #208 and #209 follow §15 rows 13 and 21. The calibration part of #9 moves to #220. |

### Data tasks before the first run

All questions are answered (E5). These tasks need no decision:

- The operator copies to the machine: `sources.csv` (G1), the `.private` catalogue (G2), the CARTO
  plan `00-PLAN-v2.md` (G3), and the 328 claims with about 100 PDFs (G4).
- The operator approves once: the belligerent table, the sanctioned host table, the adverse
  predicate list, and the first register cards.

## Consequences

- **A public sentence in GAB voice needs an anchor or an audited cell.** At launch, all gate paths
  are off, so the public site shows ATTRIBUTED, ANALYSIS and LABELLED QUOTE claims only. Most ORBAT
  facts stay "according to" for a long time (R2, R14).
- **The method is only as good as the register cards, the span checks and the audit.** A change
  that lets a model write a letter, a state, a flag or an audit label reopens this ADR.
- **Hide until sourced removes most v1 units from the map** (742 inherited, 267 entity-level), until
  the search loop finds a claim-level citation (R9).
- **The operator's time is the limit of autonomy.** Each gate path (c) format cell needs about 190
  hand checks with settling evidence (R4, R15).
- **GAB names every person that a source names, with an anonymous publisher, no editorial code and
  no lawyer read.** The operator accepted these legal risks on 4 October 2026 (R5, R6, R8, R21-R24).
  Attribution, the adverse predicate, the denial search and status wording reduce them; they do not
  remove them.
- **What proves it wrong.** A canary or an audited false accept in an open cell (the brake fires),
  or a public sentence in GAB voice that an issuer record later contradicts.

---

## Evidence

### E1. Inventory (4 October 2026)

| Data set | Where | Size | Real or invented | Rated? |
|---|---|---|---|---|
| A. v1 GeoPackage | GABRIEL `public/project.gpkg` (branch `main`) | 1,010 units + 17 organisations; 417 distinct (entity, URL) references | Real | No grade, no source date, no author |
| B. GAB fixture | `src/shared/committed-fixture/corpus.ts` | 5 documents, 29 entities, 18 relations, 6 proposals | Invented | 3 of 5 documents |
| C. Planned corpus | #159 (research tickets #136-#158), #174 | Estimates: 674 annex XLII vessels (#145), about 1,400 GUR tankers (#208), at most 60 hulls (#149) | Planned | Claim-type grades from CARTO plan §4 (removed) |
| D. Operator `sources.csv` | Operator PC (G1) | 82 rows | Real | Letter only (A 47, B 34, C 1) |

Item types in the v1 references (unit of count: one distinct (entity, URL) pair; total 417):

| # | Item type | v1 refs (share) | Planned corpus (estimate) |
|---|---|---|---|
| 1 | OSINT aggregator / military map | 161 (38.6 %) | None |
| 2 | News media | 47 (11.3 %) | Press, think tanks, NGO and Telegram together < 5 % |
| 3 | Wikipedia | 43 (10.3 %) | None |
| 4 | Directory of military units or addresses | 38 (9.1 %) | None |
| 5 | Think tank / NGO / academic report | 31 (7.4 %) | CREA, KSE (#142); IISS (#183) |
| 6 | Social media (not Telegram) | 19 (4.6 %) | None |
| 7 | Analyst blog / Substack / LiveJournal | 15 (3.6 %) | None |
| 8 | Forum / Q&A | 14 (3.4 %) | None |
| 9 | Official / government statement or site | 13 (3.1 %) | Government statements (#156) |
| 10 | Other wiki | 7 (1.7 %) | None |
| 11 | Plain web site | 6 (1.4 %) | None |
| 12 | Sanctions list (official or mirror) | 6 (1.4 %), of which 4 are GUR | Sanctions lists + legal acts about 55-65 % |
| 13 | Party list | counted in row 12 | About 10-15 % (#208) |
| 14 | Legal gazette / legal act | 0 | In row 12 share (#157) |
| 15 | Company registry / filings | 3 (0.7 %) | About 5-10 % |
| 16 | Maritime register / port record | 0 | In registries share |
| 17 | AIS data | 0 | AIS + PSC + imagery about 5-10 % |
| 18 | Satellite imagery | 0 | In AIS share (#153) |
| 19 | Map service / geodata | 4 (1.0 %) | No rule |
| 20 | Investigation | 4 (1.0 %) | None |
| 21 | Telegram channel or post | 4 (1.0 %) | #209 |
| 22 | Leaks | 0 | Name match = lead (#208) |
| 23 | Operator's own work | 0 | About 10 % |
| 24 | Own derived records | 0 | STS (#152) |
| 25 | Not a source (AI answer, broken value) | 2 (0.5 %) | - |

Facts on the v1 data:

- 742 of 1,010 units (73.5 %) have a **document inherited from parent**: `units.sources` is empty,
  and the #13 import loaded them with one `inherited` document. 267 units have an own entity-level
  reference, with no URL tied to one fact. One unit (`553005f6`) has a broken value. All 17
  organisations have 2-3 references.
- No author, no publication date, no access date. One URL can support many units: the tochnyi.info
  chart of the 3rd Combined Arms Army supports 21 units, and it is one origin.
- Two aggregators give 157 references (nightwatch.services 103, tochnyi.info 54). 110 units have
  aggregator data as their only item type.
- Languages: English 64.5 %, Russian 33.3 %. Without the two aggregators, Russian is 53 %.
- The old GABRIEL domain table gives `F` to 80.6 % of the v1 citations, with CNA, ISW, RAND and RUSI
  in that group, and ranks Wikipedia (D) above CNA (F). A domain-type table does not discriminate.
- The three inventories counted 413 to 417 references; this ADR uses 417 (reproducible, with URLs
  in notes).

Data gaps:

| # | Data gap | Effect |
|---|---|---|
| G1 | `sources.csv` (82 operator-rated sources) is on the operator PC | `load:originators` waits for the file |
| G2 | The `.private` catalogue is on the operator PC | Not used |
| G3 | CARTO plan `00-PLAN-v2.md` is on the operator PC | Only rows copied into #140-#158 are known |
| G4 | 328 operator claims (#187) and about 100 PDFs (#176) are on the operator PC | Shadow mode cannot use them until the copy |
| G5 | Design-session transcripts | The five past faults are known from one operator message and the tickets |
| G6 | Content of v1 pages | Dead links, page authors and image language are not checked |
| G7 | EU / US sanctions status of tass, ria, news-front, almayadeen | The rule exists; the data does not |
| G8 | AJP-2.1, STANAG 2511 (HTTP 403), ICD 206, ICIJ and Amnesty rules | ADMIRALTY definitions come from a secondary text (Icard 2024, arXiv 2405.19968) |
| G9 | Old text of #207 options (a) and (b) | Not used |

### E2. Glossary

"Gets a rating" means: carries an ADMIRALTY letter, an ADMIRALTY digit, or a confidence level. A
check result (pass or fail) is not a rating. A public state is not a rating.

- "Class 1, 2, 3" means the claim classes of the legal gate (§13) only.
- "Gate path (a), (b), (c)" means a route through the decision table (§8).
- "Promote" means a state upgrade of one claim. "Open" means that a format cell or a gate path
  starts to run with no operator. "Fail open" means that a check lets a claim through when data is
  missing; it is the opposite of "fail closed".
- "Ln" (L1 to L24) always means a lock of §11. "Layer n" means a row of the table of §2.
- "Inherited document" means the parent's document that the #13 import gave to a child unit. It is
  different from the ADR 0009 precision word `inherited` (a borrowed position).
- "Counts 0" means that the origin group does not count in O (§8).
- "Data gap" means missing data (G1-G9). "Search gap" means a missing piece of evidence for one
  claim (§10.1).
- "Reader" means a model or a parser that reads a span.

| Term | Definition (one sentence) | Real example | Gets a rating |
|---|---|---|---|
| **Source** | In GAB text, "source" always means the originator; we do not use the word for a host, a document or a domain. Exception: the v1 field and file names `units.sources`, `research_sources` and `sources.csv` keep their names. A v1 URL or document is a "reference" or a "document". | The author of `henrybolton.substack.com/p/order-of-battle-russian-army-hqs` (unit `5fb7a62b`). | Yes, as originator: letter A-F. |
| **Author** | The named person or account that wrote or posted an item. | `ChrisO_wiki` on X (unit `0b8dcaae`). | Yes, when the author is an originator with a canonical id. A staff author uses the imprint's letter until it has 10 resolved claims (§7.1). |
| **Organisation** | A body that employs authors or issues records under its own name. | CNA (unit `57760b26`). Not the v1 table `organisations`, which holds subject companies. | Yes, when it is an originator. |
| **Publisher** | The organisation that makes an item public and takes editorial responsibility for it. | TASS for `tass.com/defense/2118563` (org `74212d89`). On Substack the publisher is the author. | Yes, as originator (imprint). |
| **Platform or carrier** | A service that hosts or transmits other people's content and has no editorial role. | substack.com, vk.com, t.me, x.com, archive.today, tgstat.ru, sanctions.lursoft.lv. | **No, never.** |
| **Channel (Telegram)** | A Telegram account, keyed by its numeric id, whose owner is the originator of its posts; Telegram is the carrier. | `t.me/shock3OA` (unit `1bef054a`). | Yes, the channel owner as originator. A channel link with no post id supports no claim. |
| **Document** | One stored, dated copy of one item with its hash, untouched copy and capture date. | v1 `research_sources` row `b6514b5c`. | **No.** |
| **Origin (first-hand)** | The first party that saw, measured, held or recorded the information; all copies, mirrors, translations and rewrites of it are one origin. | The tochnyi.info chart in 21 v1 units is one origin. | No. Code counts it. |
| **Information or claim** | One atomic statement about one subject (entity, field, value, event time) that a citation supports. | "UAC is designated by OFAC" (org `74212d89`). | An internal digit 1-6. A confidence level only on a GAB judgment. |
| **Observation** | A record by a sensor or a person of a thing at a place and time, which we can test for place and time. | A Sentinel-2 scene (#153). | No. A verified observation is a check result per field. |
| **Primary record** | A record that the issuing authority makes as part of its own act; for that act, the record is the fact. | EU annex XLII in the Official Journal (#145). The audit-it.ru page (unit `57760b26`) is a mirror. | No. Its issuer gets letter A through a register card. |
| **Originator** | Who first put the information out, keyed by a canonical id (platform account id, issuer host from a register card, or own algorithm id), never by a display name or a domain. | Telegram channel `@specnazahmat`, not tgstat.ru (unit `6593bedb`); OFAC, not lursoft. | Yes: letter A-F, default F. |
| **Imprint** | An originator with editorial control over its staff authors, valid only on its own canonical host or account. | TASS on tass.com; CNA on cna.org. | Yes. |
| **Register card** (`issuer_card`) | An operator-approved record of one issuer: hosts, TLS names, URL patterns, record kinds, declarant per field, identifier types, terms of use. | The card for OFAC lists `SDN.CSV` on `ofac.treasury.gov`. | No (it gives the issuer letter A). |
| **Issuer record** | A record fetched over TLS from a register-card host, whose span is an act of the issuer. | The UAC entry in OFAC `SDN.CSV`. | No. It is an anchor. |
| **Anchor** | Evidence that can make a public fact in GAB voice by itself: an issuer record with an `enacts` span (gate path a) or a verified observation of the tested fields (gate path b). | A row of EU annex XLII for one vessel. | No. |
| **Verified observation** | A reproducible evidence package that code re-checks, with a separate verdict per field (§6.3). | A geolocated video of a strike, with place and time verdicts. | No. Its originator gets its letter from the gold set. |
| **Structural mark** | A stored, re-checkable fact that shows how the originator knows: its own media with a hash and an earliest capture, its own sensor id, its own record, or its own filing. | The scene id of a Sentinel-2 scene. | No. |
| **Citation** | One link between one claim and one span of one document, with originator, origin group, access, modality and check results. | The span of the UAC entry in `SDN.CSV`. | No (pass or fail). |
| **Span** | The exact character offsets of the supporting text in the stored untouched copy (or its OCR text); it contains the claim value (§5.1). | Offsets of one vessel row in the annex XLII XML. | No. |
| **Origin group** | The set of documents that carry one origin. | `t.me/specnazahmat/2042` and its tgstat mirror. | No. `party` and `sanctioned_origin` apply to the group. |
| **Access** | How the originator knows, per span: `issuer`, `first_hand`, `holder`, `repeater` or `unknown`. | AIS message = `holder`. | No (an enum). |
| **Modality** | What the span does: `enacts`, `asserts`, `attributes`, `alleges` or `denies`. | OFAC listing = `enacts`; statement of reasons = `asserts` or `alleges`. | No. |
| **Adverse predicate** | A code property of a claim: the claim imputes an act from a closed list (§13 item b) to a named person or company in the claim span, whatever the modality. | #156 `settles_through` claims about Nayara Energy. | No. |
| **Repeater** | An originator that cites, copies or compiles another origin; it counts only with its stored upstream. | nightwatch.services; the ISW OOB PDF (unit `340659f4`). | Yes, as originator. A repeater claim never adds to its track record. |
| **Holder** | An originator that holds a declaration of another party. | The `owner` field in an MCA21 MGT-7 filing (#154). | Yes, as originator. The declared field stays ATTRIBUTED. |
| **Party** | An originator that is a belligerent of the covered conflict, or controlled by one, about a subject of that conflict: `true`, `false` or `unknown` (§6.1). | GUR on Russian subjects; TASS on Russian subjects. | No. A flag. A party statement stays ATTRIBUTED, with the label "(party to the conflict)". |
| **Sanctioned** | `sanctioned_origin` on an origin group whose originator is on an EU or US sanctions list or in the sanctioned host table (the group counts 0); `sanctioned_host` on each document whose host or account is in that table (display limits of a labelled quote). Each flag carries its regime. | RIA Novosti (status to check, G7). | No. Two flags. |
| **Sanctions label** | The regime words that code takes from the list entries: "under EU sanctions", "under US sanctions" or "under EU and US sanctions" (§14.1). | "<outlet> (under EU sanctions)". | No. |
| **Lead** | An item that can point the search loop to evidence but never supports a public claim. | Wikipedia page of a division (unit `36020626`); the parent unit's v1 document for a child. | No. |
| **ACCEPTED** | Public state of a fact in GAB voice, through gate path (a), (b) or (c) (§8). | "Designated by OFAC on <date> (SDN <entry id>)." | Gate path (c) only: confidence "moderate". |
| **ATTRIBUTED** | Public state of a claim shown as the statement of a named originator ("According to X ..."), never in GAB voice; a stable end state; also the state of a claim whose only origins have letter E, which never promotes. | "According to Henry Bolton (Substack, <date>), ..." | No confidence level. |
| **ANALYSIS** | Public state of a GAB interpretation or own-algorithm output, with an ICD 203 likelihood word. | "GAB analysis of AIS data indicates a likely ship-to-ship transfer on <date>." | Likelihood word from the audited precision. |
| **LABELLED QUOTE** | Public display of a statement from a sanctioned outlet: outlet, date, quote of 200 characters or fewer, the sanctions label of its regime, no link (§14.1). | "<outlet> (under EU sanctions) stated on <date>: '...'." | No. The group counts 0. |
| **DISPUTED** | An overlay that shows two positions, each attributed, when a counted origin contradicts a claim. | "Registry R lists flag F; a PSC record lists flag G." | No. |
| **HELD** | Not public; the search loop works on the claim. | A unit whose only v1 reference is a document inherited from its parent. | No. |
| **Ground truth** | Issuer records, verified observations of the tested fields, and operator decisions that name their evidence; never agreement of agents or of other media. | An OFAC listing that settles an earlier press claim. | No. |
| **Resolved claim** | A claim of an originator, where it was first or first-hand, that ground truth later settled as true or false. | A relocation that a later verified video confirms. | No. It feeds the track record. |
| **Track record** | The list of resolved claims of one originator, with n resolved, n true and n fabricated. | "New source, no track record". | No. Code computes the letter from it. |
| **Denial search** | The search loop step that looks for a public denial or response by the subject before an adverse allegation goes public; GAB never contacts the subject. | A press release of the company on its own site. | No. |
| **Format cell** | One audit cell: a gate path (a, b, c, ANALYSIS) by an item format (record row, RU text, EN text, UK text, image / OCR, AIS / derived). | Gate path (c) x RU text. | No. It gets a measured error bound. |
| **Canary** | A known-false test claim that a separate pipeline plants to test the gate; code never shows it. | A recycled 2019 video with a 2026 date. | No. |
| **`same_family`** | A citation flag about AI model readings only: `true` when both readings of the span came from one model family; `unknown` when the weekly family probe fails. | Two Claude readings of one Russian page. | No. |
| **Same owner or controller** | A relation between two originators: one owns or controls the other, or one body owns or controls both, from a stored record; such originators are not independent (C3). | TASS and a TASS regional site. | No. |
| **`post_hoc`** | A citation flag: true when the document's earliest capture date is later than the claim's entry in GAB. | A blog post first archived after GAB published the claim. | No. |
| **Letter** | The ADMIRALTY reliability A-F of an originator, computed by code, internal only. | OFAC = A. New Substack author = F. | It is the rating. |
| **Digit** | The ADMIRALTY credibility 1-6 of one claim, a SQL view, internal only, read by no gate. | One origin, nothing else known = 4. | It is the rating. |
| **Fail closed** | If a check cannot run, or no second reading exists, the claim is HELD (§8 row 3a). | An outage of the second model family. | No. |
| **Shadow mode** | Code computes a decision and stores it; the visitor sees only the claim's current public state. | Gate path (c) candidates before `path_c.<cell>` exists. | No. |
| **Brake** | The rule of §8 that limits a format cell to ATTRIBUTED when its error bound fails. | One accepted canary on gate path (c). | No. |
| **Gold set** | A set of items with a known true answer that measures one gate path. | The 40 known-place images (§6.3). | No. |
| **Parameter row** | A versioned database row that holds one threshold or switch; no row = rule off (L11). | `path_c.en_text`. | No. |
| **Tracer** | The agent that proposes an upstream for a document (#217); code accepts it only when it can fetch and store the upstream. | An upstream from nightwatch to a Telegram post. | No. |
| **Relay** | An originator role: it passes on other origins and adds nothing first-hand. | nightwatch.services. | Yes, as originator. |
| **Prior** | An operator letter that loads before any track record exists, with no expiry (§7.1). | The 82 `sources.csv` letters. | It is a letter. |
| **Hide until sourced** | The Q6 rule: a v1 claim is not public until it has its own claim-level citation. | The 742 units with a document inherited from parent. | No. |

Abbreviations: **ORBAT** = order of battle. **STS** = ship-to-ship transfer. **PSC** = port state
control. **SAR** = synthetic aperture radar. **OCR** = optical character recognition. **v/ch** =
military unit number (войсковая часть).

### E3. Comparison of standards

| Method | What it rates | Scale | Strength | Weakness | Fit for AI agents | Fit for public journalism | Role in GAB v4 |
|---|---|---|---|---|---|---|---|
| ADMIRALTY / STANAG 2511 (AJP-2.1) | Source (letter); information in one report (digit), separately | A-F, 1-6; F and 6 = no basis | Two axes; honest "no data" state; widely known | Humans collapse axes; vague words; no provenance; no claim confidence; no publish rule | Medium-good if code computes it | Poor as a public label | Internal tag only (layers 3 and 4) |
| UK 3x5x2 (APP, 13 Jan 2026) | Source; how the source knows; handling | 1-3, A-E, P/C | "Untested" default; first-hand vs hearsay; corroboration must be "independent and not from the same original source" | Built for informants | Good | Medium | `access` enum; independence rule |
| ICD 203 / ICD 206 (ODNI) | Analytic judgments; source base of a product | 7 likelihood terms; high / moderate / low confidence | Separates fact, likelihood, confidence | For trained analysts; ICD 206 not read (G8) | Good for the claim layer | Good | Confidence on gate path (c); likelihood words on ANALYSIS |
| UK PHIA (2025) | Judgments | 7-band yardstick; confidence criteria | Explicit confidence criteria | Holistic | Good | Good | Same as ICD 203 |
| Berkeley Protocol (OHCHR 2022) | Process: source, file, content, preservation | None | Provenance, hash, chain of custody; written for court use | No grade, no decision rule | Very good as backbone | Very good | Layers 1 and 2; verified observation |
| Bellingcat / GLAN J&A (2022) | Items, incidents | No formal grades | Earliest poster = source; examinable vs descriptive content; second reviewer | Slow; no numbers | Good for structure | Very good | Origin rule; verified observation; equal pro / contra search |
| OCCRP / ICIJ | Each sentence | Proven or not | Primary records; "Referring to other media reports doesn't count"; every sentence footnoted | Human, slow | Good | Very good | Decision table; ATTRIBUTED wording; footnotes |
| LLM ratings of sources or claims | Domains, claims | Various | Cheap, fast | rho 0.50 with experts (rho 0.79 between LLMs, Yang and Menczer, WebSci 2025); correlated errors; over-confidence | Only with calibration | Not alone | **Rejected** as a rating. Models extract offsets and enums only. |
| Points tables and weight sums (#207 rule v2) | - | Points | Simple | No measured basis; hides the reason; letters used as numbers | - | - | **Rejected** for any decision |

### E4. Red-team ledger and residual risks

Status: FIXED (the method stops it); PARTLY (the risk is smaller, a residual stays); SETTLED (an
operator answer of 4 October 2026 decides it); Residual (E4.4: a risk that stays after the
mitigation); Accepted by the operator on 2026-10-04 (E4.4: a residual risk that follows from an
operator answer, and that the operator accepted).

#### E4.1 Attacks

| # | Attack | Answer | Status | Residual |
|---|---|---|---|---|
| A1 | Copy chain: post + mirror + PNG + directory = "many origins" (unit `6593bedb`) | Default dependent; L6, L7, L23; worked case §15 | FIXED | GAB also refuses a true second origin with no structural mark. |
| A2 | "According to Reuters" copy chain | §5.2 `attributes` moves only with the stored named document | FIXED | - |
| A3 | False track records from copies of OFAC designations | §7.1 first or first-hand only; L15 | FIXED | Letters change slowly. |
| A4 | Majority history | Ground truth only | FIXED | - |
| A5 | Backdating a page | §6.2, L9 | FIXED | An early capture with a forged date counts for attribution only. |
| A6 | Mirror substitution (lursoft) | L8 | FIXED | - |
| A7 | Lookalike issuer host, forged PDF | Register card with TLS names; bulk-file hash | FIXED | A hacked real issuer page (R3). |
| A8 | Prompt injection | L10, L19; hidden-text strip | PARTLY | Visible injected text can bias offsets. |
| A9 | Many false dispute reports | §14.3 leg conditions; queue; rate limit | FIXED | A true unlinked complaint waits. |
| A10 | "All agents are Claude; no second family" | §3.1 parser, OCR, other input, `same_family`, probe, L16 | PARTLY | R1. |
| A11 | Western and English bias | Language lock; local registers; per-cell bound; fairness rates | PARTLY | R2, R20. |
| A12 | Party flag change through the graph | Belligerent table + control record | FIXED | - |
| A13 | Same-name entity | §5.4 identity keys | PARTLY | Units with no v/ch stay leads. |
| A14 | Sanctions evasion by a copy | `sanctioned_origin` per group (Q3) | PARTLY | A rewrite that escapes the join is repeater-unknown and cannot anchor (R20). |
| A15 | Gold set covers only the operator's domain | Format cells; canaries | FIXED | R4. |
| A16 | Two compilers make a GAB-voice fact (unit `340659f4`) | §5.1 compilation = repeater; L23 | FIXED | R14. |
| A17 | Gate path (b) accepts an untested field (unit `289b598e`) | §8 row 5 | FIXED | - |
| A18 | Gate path (c) makes an adverse allegation about a company a fact (Nayara) | §8 row 6 item 11 | FIXED | - |
| A19 | A reader labels an adverse claim `asserts` | §13 item b: code property, set never cleared | PARTLY | R18. |
| A20 | "Party to the conflict" makes every serviceman a named subject (unit `ac96b041`) | C4: every name a source gives can be public; the other safeguards of §4 stay | SETTLED | R23. |
| A21 | A belligerent's press post passes as class 1 (unit `eb66df78`) | §13 item c: register card; court register for a party act | FIXED | - |
| A22 | A sanctioned outlet that copies a non-sanctioned origin gets a link (unit `126dfa78`) | `sanctioned_host` per document | FIXED | - |
| A23 | Russian companies answer through TASS or RIA | §10.1 step 3 own site first; 200-character quote | PARTLY | R16. |
| A24 | A labelled quote repeats an allegation about a named person | §8 rows 9, 10 | FIXED | - |
| A25 | Chart OCR passes any parent-child pair; fuzzy v/ch | Layout check; exact identifiers | FIXED | Charts give names only until the layout check exists. |
| A26 | A child's name span supports the parent's position | Span value rule | FIXED | - |
| A27 | Minimisation shifts offsets | §3.2 same-length placeholders; CI test | FIXED | - |
| A28 | The aggregator routes two names to one backend | Weekly family probe | PARTLY | R1. |
| A29 | Gate path (c) labels agree with the same two origins | C6: settling evidence outside the two origins; "cannot settle" | PARTLY | R15. |
| A30 | 190 checks certify EN text and run on RU and OCR | Bound per format cell | FIXED | R4. |
| A31 | Unknown control makes Russian analysts party | C7: `party = unknown`, no label; fail closed for state bodies | PARTLY | `unknown` still blocks gate path (c). |
| A32 | A tracer "proof" of independence | L23 | FIXED | R14. |
| A33 | A forged reply changes claims to "X denies" | §14.3 identity rule: DKIM and SPF alignment, token, or operator check with inbound evidence; L24 | PARTLY | R25. PARTLY until the DKIM check exists. |
| A34 | An attacker's own post makes DISPUTED public at once | §14.3 leg conditions | FIXED | - |
| A35 | Two post-hoc paraphrases of GAB's claim open gate path (c) | §6.2; §8 row 6 item 6 | FIXED | - |
| A36 | An OSM edit makes a false geolocation | Reference imagery; L19 | FIXED | - |
| A37 | UK and AR text fail OCR or escape the join | OCR rus+ukr+eng; calibration; `unknown` | PARTLY | R20. |
| A38 | The letter is a volume rule | The letter does not change order or budget | PARTLY | R17. |
| A39 | Digit 2 reads the gate's own output | L17 | FIXED | - |
| A40 | A belligerent's court convicts an adversary national, and GAB states the crime in its own voice | §13 item c.1 party court wording: existence of the act, party label, denial-search line | FIXED | - |
| A41 | A denial-search response accuses a third party, and the denial line publishes it | §10.1 step 3 span rules: redaction, predicate check, no verbatim text | FIXED | - |
| A42 | A vessel or unit claim imputes an act to a named owner, manager or commander who is not the subject | §13 item b scope: each named person or company in the span | FIXED | R18. |
| A43 | An impersonating channel is shown as "According to Reuters" | §14.1 unmerged display names | FIXED | - |
| A44 | The originator deletes its post, and GAB keeps the allegation public | §6.4 withdrawn claims | FIXED | Between two re-fetches, the claim stays public. |
| A45 | Repeater-unknown claims and same-family readings get contradictory states | §8 rows 3a, 8, 10; L16 | FIXED | - |

#### E4.2 Objections between the specialists

| Objection | Answer | Status |
|---|---|---|
| Similarity 0.85 within 14 days as the only grouping defence | No time window; L6, L7, L23 | FIXED |
| ">= 3 points = disputed" | §14.3 | FIXED |
| Display-name keys let lookalikes inherit operator letters | Canonical id; impersonation rule | FIXED |
| A 50-claim seed cannot show 2 % (bound 7.1 %) | About 190 per format cell | FIXED |
| Annex XV media are listed by name only | Sanctioned host table, approved by the operator | FIXED (R10) |
| Self-declared first-hand + two hearsay = fact | Structural mark; no sum | FIXED |
| Operator A/B letters open a gate | Prior on a canonical id; L15 | FIXED |
| A graph-only party flag fails open | Fail closed for state bodies; `unknown` blocks (c) | FIXED |
| "Later items count 0" blocks honest closure | §6.2 later anchors count | FIXED |
| Imprint inheritance by byline | Own canonical host only | FIXED |
| "B = uncontradicted" rewards silence | Resolved = settled by ground truth | FIXED |
| A verbatim unverified reply is an injection and defamation channel | "A person who states that he is X"; third-party names redacted; never evidence | PARTLY (R5) |
| The anchor lock is too strict for two independent reporters | Gate path (c) after audit, moderate confidence | SETTLED (Q1); R14 |
| No right-of-reply step before an adverse allegation | No outreach; denial search; inbound reply | SETTLED (Q2); R6 |
| Anonymous items published as attributed | Lead only (§8 row 10) | FIXED |
| Geolocation by two LLM calls becomes an anchor | Package re-checked by code; gold set | PARTLY (R19) |
| AIS treated as fact | AIS = holder; STS = ANALYSIS | FIXED |
| A checksum is not vessel identity | Dated history | FIXED |
| Search budget on the free tier (742 x 60k = about 44.5M tokens a round) | Daily budget, sort keys, stop rule, hide until sourced | PARTLY (R9) |
| Attribution is not a defence; companies can sue | Class 3 for companies; denial search; status wording | SETTLED (Q2); R6 |
| A cluster count or a role category is not public interest (Satakunnan) | C4: all names that a source gives can be public | SETTLED; R23 |
| The source card imputes "false" to named analysts | "Contradicted by <record>"; nothing under 5 | FIXED |
| Free-tier models get personal data with no processor agreement | Free tier; minimisation (§3.2, L21) | SETTLED (Q4); R8 |
| A full copy or link of a sanctioned outlet is distribution (Reg. 833/2014 art. 2f) | Labelled quote, 200 characters, no link | SETTLED (Q3) |
| No editorial code, no directeur de la publication | Anonymous publisher, no code, no lawyer read | SETTLED (Q8a, Q8b); R5, R21, R22 |

#### E4.3 Rejected fixes

| Fix proposed | Reason for rejection |
|---|---|
| "Items later than GAB's text count 0" for all items | It blocks delistings and corrections. Kept only for GAB echoes and gate path (c) legs (§6.2). |
| Replace the second model family with screenshot + OCR only | A second family exists at runtime. Keep both kinds of diversity. |
| Show the full copy of a sanctioned outlet, or a subject's full denial that only it reports | Reg. 833/2014 art. 2f; Q3 limits each statement to 200 characters with no link. |
| Raw-rate letter table (B: <= 5 % contradicted) | Not a partition; rewards silence. |
| "Low confidence" on attributed statements | Confidence belongs to GAB judgments only (ICD 203). |
| Reply request with a 72 h wait before an adverse allegation | Q2: GAB never contacts subjects. |
| Paid endpoints with a processor agreement | Q4: free tier for all calls, with minimisation. |
| A fixed label "under EU/US sanctions" | Q3a: code names the regime from the lists. |
| A public-interest record and a role category before a name shows, and no name for a person with no role | C4: every name that a source gives can be public. |
| E-only claims HELD | C2: they are ATTRIBUTED and never promote. |
| 12-month expiry of operator letters | C8: no expiry; a letter changes only on a proved fabrication, an audit failure or an operator change. |
| One-page editorial code and one lawyer read | Q8b. |

#### E4.4 Residual risks

| # | Risk | Mitigation | What remains | Status |
|---|---|---|---|---|
| R1 | Correlated model error. `same_family` and the served-model check read the model name that freellmapi returns; an aggregator can route two names to one backend. | Parser, OCR, other input form; weekly family probe; fail closed; canaries | The probe detects a full collapse to one family, not a partial one. | Residual |
| R2 | Military ORBAT facts have almost no issuer records | Gate path (c) after audit; gate path (b) after the gold set | Until both are on, most unit facts stay ATTRIBUTED. | Residual |
| R3 | A wrong register card or a hacked issuer page gives a one-origin fact | Operator approval per card; bulk-file hash; canaries | A single-point failure per card. | Residual |
| R4 | Operator time: about 190 hand checks per gate path (c) cell, about 190 per issuer PDF/HTML cell, 40 gold-set images, 20 weekly items, approvals | Small batches (#222); check tool; pre-sort by agents | Each cell stays off until its checks are done. | Residual |
| R5 | **No lawyer read.** The legal points of this ADR come from a media-law agent, not from a lawyer. | Attribution, adverse predicate, denial search, status wording, inbound reply | Nobody qualified checks the class-3 wording, the reply labels, the sanctioned-host display or GDPR compliance. | **Accepted by the operator on 2026-10-04** (Q8b) |
| R6 | **Repetition rule.** French law (Loi de 1881) and English law have a repetition rule: a person who repeats a defamatory allegation is liable for defamation, also with "X alleges". The Defamation Act 2013 does not remove this rule. With no request for comment (Q2), GAB cannot show that it gave the subject a chance to answer. Nayara Energy litigates (India BNS s.356, #158); #158 also names UAE (Decree-Law 34/2021, art. 43) and Cyprus exposure. | Status wording; attribution always; adverse predicate; denial search; no gate path (c) for adverse claims; no labelled quote of an adverse allegation about a person; inbound reply in 72 h | Attribution and a shown denial reduce the risk. They do not remove it. | **Accepted by the operator on 2026-10-04** (Q2) |
| R7 | The 328 claims, `sources.csv`, the `.private` catalogue and the CARTO plan are not on the machine | The method runs without them | Shadow mode and `load:originators` wait (G1-G4). | Residual |
| R8 | **GDPR Art. 28 and Art. 32.** Free-tier endpoints have no processor agreement and no stated security terms. Names and roles of persons go to them, and with C4 there are more names. The provider may keep or train on inputs. | Minimisation in code (§3.2, L21); identity checks in code; `model_call` logs the categories sent | GAB, as controller, cannot show Art. 28 processor terms or Art. 32 measures for these calls. | **Accepted by the operator on 2026-10-04** (Q4) |
| R9 | Hide until sourced removes most v1 units from the map | Parent's source as the first lead; sort keys | 742 inherited and 267 entity-level units compete for the free budget with 674 annex XLII rows. | Residual |
| R10 | Sanctions status of tass, ria, news-front, almayadeen is not checked (G7); the host table goes stale | Operator approval of each host-table change | The data does not exist yet. | Residual |
| R11 | Grouping errors in the false-split direction double-count | L6, L7, L23, default dependent | Two structural marks with an unseen common source (a staged scene) still pass. | Residual |
| R12 | Shared prior of the panel (all Claude) | Standards survey; red team; operator review | The method can carry an error that one model family does not see. | Residual |
| R13 | Free tier has no SLA; quality falls late in the UTC day | Pinned models; L16; quota pause | Throughput is not predictable. | Residual |
| R14 | Gate path (c) needs a structural mark on each leg; most ORBAT text has none | Gate path (b); the tracer looks for marks | Gate path (c) fires rarely for units. | Residual |
| R15 | Ground truth for gate path (c) checks is scarce in ORBAT; many "cannot settle" | Settling evidence outside the two origins (C6) | A cell can take a long time to fill. The operator's own evidence can share a prior with the sources (47 of 82 operator letters are A). | Residual |
| R16 | Russian companies respond through TASS, RIA and Interfax; on a sanctioned host their response shows as 200 characters with no link (Q3) | Own-site search first; attribution to the subject | The subject's words can be cut. Class 3 is less fair to Russian subjects. | **Accepted by the operator on 2026-10-04** (Q3) |
| R17 | The letter route needs anchors; unit analysts stay F while wires and registries reach B or A. Operator letters have no expiry (C8). | The letter does not change order or budget | A wrong operator prior stays until a proved fabrication, an audit failure or an operator change. | Residual |
| R18 | The adverse predicate for free text depends on a keyword list and on readers | Set never cleared; approved list; canaries | A new kind of imputation outside the list passes as not adverse until the operator adds it. | Residual |
| R19 | Gate path (b) opens on 40 of 40 gold-set images: a Wilson lower bound of 0.91, not a 2 % error bound | Weekly sample, canaries, brake | Its error rate is less well measured than the other paths. | Residual |
| R20 | Languages other than RU and EN (UK OCR, UK and AR similarity, Farsi, Hindi) | OCR rus+ukr+eng; calibration; `unknown` | Uncalibrated languages get no gate path (c), and rewrites escape the join. | Residual |
| R21 | **Anonymous publisher.** The site names no directeur de la publication. LCEN art. 6 III requires a professional publisher to name one. A non-professional publisher can stay anonymous only when it gives its identity to its host. A right-of-reply request (LCEN art. 6 IV) and a legal claim then go to the host. A court can order the host to give the identity. | Inbound "Report an error" and "Right of reply" channels; correction log | If a court reads GAB as a professional online press service, the anonymity does not conform. | **Accepted by the operator on 2026-10-04** (Q8a) |
| R22 | **No editorial code.** The GDPR Art. 85 journalistic exemption (in France, Loi Informatique et Libertés art. 80) protects processing for journalism. With no written code (purpose, attribution, corrections), GAB has less evidence that its processing of personal data is journalism. | The method in this ADR is public in the repository; the method statement on each claim | The exemption may not apply, and then the full GDPR applies to the names. | **Accepted by the operator on 2026-10-04** (Q8b) |
| R23 | **All names public (C4).** GAB shows every name that a source gives, also of private persons such as servicemen (unit `ac96b041`). This is processing of personal data with no balance test per person (Satakunnan), with data on alleged offences (GDPR Art. 10), and with a safety risk to named persons. | Attribution; adverse predicate; denial search; no gate path (c) for adverse claims about a named natural person; status wording; inbound reply with third-party names redacted | A named private person can claim a breach of privacy (Code civil art. 9) or of the GDPR, and the repetition rule (R6) applies to each allegation. | **Accepted by the operator on 2026-10-04** (C4) |
| R24 | **E-only claims are public (C2).** A claim whose only origin is a proved fabricator shows as ATTRIBUTED. GAB repeats a statement that is probably false. | Attributed wording; it never promotes; the source card shows "contradicted by <record>" | A visitor can read the attribution as support. The repetition rule (R6) applies to an adverse E-only claim. | **Accepted by the operator on 2026-10-04** (C2) |
| R25 | Reply identity. The DKIM and SPF check reads the mail of the subject's own domain. | §14.3 identity rule; L24; canary "forged reply" | A compromised mail domain or token host of the subject passes. Until the check exists, all replies are unverified. | Residual |

### E5. Operator answers of 4 October 2026

| # | Answer |
|---|---|
| Q1 | Gate path (c) is allowed, after the per-cell audit, with moderate confidence. |
| Q2 | GAB never contacts subjects. A denial search replaces a request for comment. |
| Q3 | A sanctioned outlet shows as a labelled quote (200 characters, no link); its group counts 0. |
| Q3a | The sanctions label names the regime, from the lists, by code. |
| Q4 | Free tier for all model calls, with personal-data minimisation. |
| Q5 | The operator does all hand checks. |
| Q6 | v1 units are hidden until they have their own claim-level citation; the parent's document is a lead only. |
| Q7 | Stop #182 and #186; `load:originators` replaces them. |
| Q8a | Anonymous publisher; the inbound "Report an error" and "Right of reply" channels stay; GAB sends nothing. |
| Q8b | No editorial code and no lawyer read. |
| C1 | Keep "GAB found no public response by <subject> (search of <date>)". |
| C2 | A claim whose only origins have letter E is public as ATTRIBUTED and never promotes. |
| C3 | Independence means not the same owner or controller; `same_family` is for AI model readings only. |
| C4 | Every name that a source gives can be public. |
| C5 | GUR, and any other belligerent, is a party originator with no register card; its entries are ATTRIBUTED and leads only. |
| C6 | A hand-check label needs evidence outside the two origins; the third button is "cannot settle". |
| C7 | `party = unknown` blocks gate path (c) legs and puts no party label on the text; state bodies fail closed as party. |
| C8 | Operator letters have no expiry. |
