# Approved list of the tenfold wave: datasets, editions and levels

Date: 2026-11-06. Status: APPROVED by the panel under the operator's delegation. No signature of the operator exists. Operator's words of 2026-11-06, relayed by the session that coordinates the wave: "Pour tous les éléments là que tu veux que je signe, je te laisse les faire valider par le panel et non par moi." Panel: sanctions-lawyer, osint-expert, journalist, skeptic, three rounds, no dissent; each expert read the final text. Terms read on this date unless a row says otherwise.
Ticket: BLD-13. Sources of the facts: `research/out/v3-plan/rulings.md` and `research/out/v3-plan/terms-2026-11-06/`.

## Rules of this list

- **Levels.** A: terms read, reuse allowed. B: terms read, no redistribution of raw data; also a law or a policy that was read and gives no clear right to reuse. C: lead only, no citation. n.v.: terms not read. "out": not used in this wave.
- **A level rests on words read.** A paraphrase or a search summary is not a read. "Terms not found" is n.v.
- **A non-commercial term gives B.** The open dataset carries CC BY 4.0 (ADR 0015), so a non-commercial source cannot give A. A share-alike term or a no-derivatives term also gives B.
- **Below A.** The document stays internal and the export refuses it. A fact can cite a document at B or n.v., with its level shown. A document at C is a lead only: no fact cites it. Its raw data does not leave the store. A row is in a release only with a public document (`docs/spec.md`), and BLD-07 sets the licence value of each row.
- **Edition.** "Current" means the edition on the date of the read. A new edition with the same terms stays on its line. A new edition with changed terms needs a new line.
- **`enqueue_*`.** No line of this list approves `enqueue_extract` or `enqueue_mapping`, because no ticket asks for them. `start_lead`, a promotion of a mapping and the approval of a reference edition stay with the operator.
- **All lines.** No natural person unless a sanctions act designates that person. No personal address, telephone or e-mail. No leaked, hacked or stolen data. No login, no CAPTCHA, no bypass of a block. Direct exit.
- **Restricted class** (EGRUL PDF, court acts, bank statements). Store a file only with its id logged first for BLD-07. Propose no fact from it until BLD-07 merges. Excerpts name legal persons only.

## 1. Lists, acts and US government documents

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| OFAC SDN file, recent actions, enforcement PDFs | Current | A | 17 USC 105, read at Cornell LII (no sentence on the Treasury pages) | A settlement PDF that a private party signs: short excerpt only |
| Federal Register, BIS rules (govinfo copy) | Current; 123 rules | A | "There are no restrictions regarding what is reproduced" (1 CFR 2.6) | Cite govinfo. wave-bis ruling on `restricted_by` |
| BIS aircraft list | Current | n.v. | Page loads by script; content and author not read. BIS disclaimer has no reuse term | Say "potential violation" |
| US Consolidated Screening List file | Current | C | API terms are a contract with a key; file has no terms | Lead. Cite the Federal Register |
| US DOJ press releases | Current | A | "in the public domain" (justice.gov legal policies) | An exhibit is out. An indictment is an allegation |
| CourtListener RECAP | Current | C | Terms page 403, not read. Token, 125 calls a day | Lead. Not cited when justice.gov has the copy |
| EUR-Lex, Official Journal acts and consolidated texts | Consolidated 269/2014 of 2026-09-28; other acts current | A | Legal notice read: re-use of legal documents for commercial or non-commercial purposes; consolidated texts CC BY 4.0 | Legal persons only (notice: clear rights for identifiable private individuals). A robot gets an empty 202 at EUR-Lex, so the fetch origin is Cellar, and the fact gives the CELEX number, for the same document. Cellar has its own "contact us": the A rests on the EUR-Lex notice for that document, and the panel approval accepts this reading |
| EU FSF file | Current | n.v. | Host loops; terms not read | Join key only |
| CJEU judgments | Current | A | "can be reproduced provided the source is acknowledged" (curia copyright) | Third-party works out. Natural persons out |
| UK Sanctions List and its notices | Files of 2026-10-12 and 2026-11-03; current | A | OGL 3.0 | Legal persons and ships only: OGL excludes personal data. Never export the raw file. wave-uk rulings |
| OFSI notices | Current | A | OGL 3.0 | Legal persons only |
| New Zealand MFAT register | Current .xlsx | B | MFAT copyright page read in full: CC BY 4.0 in weak words, names no file. This lowers the A of wave-new | Internal. Entity, bank and ship sheets only. Individual rows out (passports, birth dates). Rest of the wave-new ruling stands |
| Australia DFAT list | Current | A | DFAT copyright page, read in a browser: CC BY 4.0 for all material of the site | Entities and ships only. Count 0 per the catalogue |
| Canada SEMA list | Current | B | Non-commercial reproduction only (canada.ca terms) | Internal. Cite the SOR when it holds the same entry |
| Switzerland SESAM | Current | B | "Any reproduction requires the prior written consent" (admin.ch) | Internal. Only entries absent from EU and UK lists. Cite Fedlex when it holds the entry |
| Ukraine NSDC, decrees | n/a | out | Blocked (403), terms not read | Blocked queue |
| GLEIF Level 1 and 2 | Current, per key | A | LEI Data Terms: CC0 | "declared to GLEIF". wave-gleif ruling |
| GLEIF BIC-to-LEI file | Current | A | Licence for any purpose, with a SWIFT notice on each copy | Join key. Notice on any copy |
| SEC EDGAR | Current | A | sec.gov: "may be copied or further distributed by users of the web site without the SEC's permission". Fails the standing rule, so this signed line is needed | What an issuer states about itself only. Third-party exhibits out. Officer names out. SEC fair-access limit |

## 2. Registers and Russian state hosts

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| FNS EGRUL extract (PDF) | Per key, at the read date | B | Art. 6 of 129-FZ read: "open and public", no text on reuse. Copy from consultant.ru, not an official host | Restricted class. Pace 1 per 30 s until the BLD-09 test passes. One session; stop on a CAPTCHA. Legal persons only. "Registered participant" (LLC) or "registered founder" (joint-stock), never "beneficial owner" or a present owner. A restricted entry is not a zero. No sole trader |
| FNS open data sets (RAFP, headcount) | Current | B | Own open licence read (nalog.gov.ru/opendata); it bars a third party in the reworking and only "does not contradict" CC BY. Set pages not read | Founder, leader and disqualified-person sets out. Company fields only. Do not distort |
| FNS accounts portal bo.nalog | Per key | n.v. | Terms not found | Values count 0 |
| Bank of Russia form 101, BIC directory, bank list, participant pages | Files from 2024; current | B | cbr.ru/about: copy with a link, "not an object of commercial use"; user agreement read | Internal. Facts cite with a link. A gap month is not a zero |
| Kremlin bank of acts, Decree 1052 | Current | A | CC BY 4.0 site wide (kremlin.ru/about/copyrights); the Decree page not read | Text only; RIA and TASS photos out. Pilot O2-08 first. "transfer stated in the act" |
| RFSD | Release of 2024 data | B | LICENCE file CC BY 4.0; only the Hugging Face badge differs; upstream rights of Rosstat and FNS not read | Value serves a named question. A missing value is not a zero |
| ClearSpending | Current, free key | B | CC BY 4.0 words and "cannot republish primary data": the strict clause wins | Internal. No raw row. Never a backend login |
| Sudact arbitral acts | Per id | n.v. | No terms. Art. 1259(6) frees the act, not the site. Robots allow `/arbitral/doc/<id>/` | Restricted class. Legal persons only. No sole trader. Names of judges, signatories and natural persons out. No ajax, print or keyed search. Stop at the CAPTCHA path. Sitemap gate of wave-arms |
| Issuer sites, disclosure.1prime.ru, defence licence PDFs | Per host | n.v. | No terms read | One line per host when a pilot passes. Read the 1prime rules first. Never install a root certificate |
| Trudvsem job API | n/a | out | Terms refused (HTTP 460); list holds CVs | S1-02 and the Trudvsem part of BLD-11c hold |
| OpenSanctions ru_egrul, egrul.org mirror | n/a | out | "must be purchased", provenance unknown | No read, no store, no purchase |
| e-disclosure, kad.arbitr, GISP, Rostekhnadzor, Rosprirodnadzor NVOS | n/a | out | Blocked, CAPTCHA or login | Blocked queue |
| Russian Maritime Register book | n/a | out | RS terms restrict reuse; Annex XIX status not read officially; V1-02 cites lists anyway | V1-02 runs with no RS |

## 3. Arms, reports, courts

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| GUR portal: Rostec, Instruments of war, components, drones, ships | Pages at the read date | n.v. | No terms found. Party to the war. Robots refuse /api, /data, /download-controller, /search | Internal. Only "GUR states that X is found in Y", with issuer and date. No person page. No link to hacked material. Own line in the count |
| ISIS reports (Alabuga) | 26 reports found | n.v. | No terms found | Internal. Authors' own voice. A line that only restates a leaked document is out. No hosted leak stored |
| Ukrainian court register | Per case number | C | Rules forbid mirrors and automated copy | Single pages by hand. Internal. Lead only: no fact, count 0. No names of persons |
| Telegram public channels | n/a | C | Terms read: access "other than ordinary, legitimate, and intended use" is prohibited | Manual lead only. `telegram_channel` is not used for S1-01 |
| Regional and exile press | Per article | Per site: URA.RU B; Idel.Realii and Kavkaz.Realii B (non-commercial); others n.v. | Terms pages read in the access test of 2026-11-06 | Internal. Short excerpt. Lead to the origin |

## 4. Finance

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| NBKR registers | Pages at the read date | n.v. | No terms found | Stripped store. Directors and contacts out |
| Kyrgyz bank statements | PDF per bank | n.v. | Optima: "all rights reserved", link if used. No duty to publish found | Restricted class. No signatory names. Wait for PIL-03 |
| Correspondent lists on bank sites | Per bank | n.v. | No norm, no terms | One line per bank when used. Join by printed BIC. "A stated relation", not proof of use |
| Kyrgyz virtual asset register | 217 rows at the read date | n.v. | No terms found | Stripped store. Contacts out |
| TronGrid, Ethereum RPC | Current | n.v. | TronGrid terms not found | Lead. A wallet needs a stored official text that names it |
| BIS locational banking | Current | A | data.bis.org legal page: use unrestricted, cite BIS | Context figure. Count 0 |

## 5. Trade

All count 0 as facts.

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| Eurostat Comext | Current | A; carve-outs B | Copyright notice read: non-commercial only for non-EU/EFTA data, Swiss data, Austrian CN8 | Tag the carve-outs |
| Kazakhstan statistics | Current | A | "for any purposes" (stat.gov.kz) | Cite the source |
| HMRC OData | Current | A | OGL | "Most content". Never the Trader part. 60 calls a minute |
| Comtrade preview and availability planner | Current | n.v. | No Comtrade text found. The un.org footer forbids "compile or create derivative works" | Internal. No raw row and no Comtrade table in the report. Paced, named code lists, stop on 429. Ruling D19 |
| Comex Stat Brazil | Current | B | CC BY-ND 3.0 on the ministry site footer | Internal |
| IMF IMTS | Current | B | IMF data terms read (imf.org): reuse with source, commercial reuse by request | Mirror figures. No bulk by robot |
| Moldova statistics | Current | n.v. | Terms not found | Pilot only |

## 6. Maritime and aviation

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| Digitraffic Marine | Daily collector | A | CC BY 4.0 (Fintraffic terms) | Credit line. Declared data only |
| Digitraffic Rail | Current | A | Same Fintraffic terms, raw: "Fintraffic's open data is licensed under the Creative Commons 4.0 By license" | Credit line. Lead |
| Danish AIS archive | Daily files on aisdata.ais.dk | B | AIS policy read: PSI act, "open data for a limited period", persons rule. The policy speaks of real-time recipients; archive terms and general conditions not read | Internal. Vessels only, no join to a natural person. No TLS bypass. Copy early |
| IMF PortWatch | Current | n.v. | IMF terms do not name it; its terms page is empty also in a browser | Internal. Label as AIS estimate. No bulk by robot |
| Kystverket open AIS | Reach test | A | Kystverket page: NLOD, no registration. NLOD 2.0 preface read: right to copy, use and distribute, with credit | Credit |
| BarentsWatch | Free client | B | "cannot change the data content"; account | The operator makes the client; no agent makes an account |
| ADS-B.lol history | Daily files | B | ODbL read: one fact is a Produced Work (4.5.b); many facts risk a Derivative Database (4.4.c, 4.6), which conflicts with CC BY | Separate layer. Internal. Facts on aircraft only. Publish no table of traces. L1-06 stays a pilot |
| GFW | Current API, token set | B | API terms read: non-commercial, revocable, account promise on ocean use (2.B), surveys (2.I). "AIS-only limit" is not a term | No new fact enters the record from GFW. L1-08 to L1-11 and V1-03 park. Nothing goes to GFW. Facts of the last wave stay, marked, out of the report and the release |
| IACS Vessels in Class | n/a | C | "may not reproduce" (IACS terms) | Lead. Class counts 0 |
| THETIS, Paris MoU, IOMOU, Tokyo MoU, Black Sea MoU, P&I search | n/a | out | Storage forbidden, or CAPTCHA | None |
| SkyTruth Cerulean | Current | n.v. | Terms not read | Lead |
| EU THETIS-MRV reports | Current | n.v. | Terms not read | Pilot only |

## 7. Geospatial and archives

Images and scenes count 0.

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| Earth Search S2, S1; Copernicus catalogue | Current | n.v. | Access words only ("free, full and open"); Sentinel Legal Notice not read | HTTPS only; stop on 403 |
| Landsat, Planetary Computer, Black Marble, ECOSTRESS | Current | A for NASA; Landsat and Planetary Computer n.v. | NASA data guidance read. USGS page refused. Planetary Computer terms not read | Support layers |
| ASF HyP3 | Free Earthdata key | A for NASA products; Sentinel-1 products n.v. | Earthdata guidance read. Sentinel-1 is not NASA data, and its notice is not read | The operator makes the key |
| Capella, Umbra open SAR | Current | n.v. | AWS registry tag CC BY 4.0 only; the licence of the issuer is not read | Named site only |
| Overture Places | Current | C | Licence per row | Candidate only, never the citation of a point. Contact columns out |
| OpenStreetMap | Current | C | ODbL | Identifier and candidate only, under research-method |
| GEM | October 2026 release | n.v. | Ownership page "All Rights Reserved"; CC BY elsewhere by paraphrase | Lead |
| Climate TRACE | Current | A; owners B | CC BY 4.0 except external data | Lead; modelled |
| UCDP GED | Current | A | CC BY 4.0 | Cross-check |
| World Bank flare volumes | 2012-2025 file | n.v. | Terms for the file not found | Sample only. Join each operator by a register |
| Wayback | Per capture | n.v. | Terms not read | Single page, cite the origin |
| Common Crawl | Per crawl | n.v. | One line read only | Lead |

## 8. Other sources

| Source and dataset | Edition | Level | Basis | Conditions |
|---|---|---|---|---|
| Registers of Hong Kong, DIFC, ADGM, India (O1-03) | n/a | n.v. | Blocked, no terms read | Public pages only if the pilot passes; else the ticket closes |
| Kazakhstan `gbd_ul`, Turkish Trade Gazette, UAE FCSC, China customs, Vietnam customs | n/a | out | CAPTCHA, account or block | Blocked queue |
| Kyrgyz justice register | Per id | n.v. | Terms not found | Companies only. Founders who are natural persons out |
| Far East Development Corporation residents, Fedresurs, Turkish maritime statistics | Current | n.v. | Terms not read | Pilot only |
| GovInfo USCOURTS | Current | n.v. | Terms not read; key for the API | Pilot only |
| Trade Integrity Project | n/a | C | Provenance not settled | Method lead; no data |
| Official legal portal, Wikidata | Current | n.v. | Terms not read | Lead only: find a document, then cite that document |
| UK PSC, SIPRI, METI overview, UK Find Case Law, Rada open data, CEPII BACI, Geostat, Statistics Norway, US Census, Japan e-Stat, AISStream, Indian port PDF, National Bank of Kazakhstan, CIPS, Hong Kong money register, Sentinel-3 FRP, OGIM, Latvian file, Firecrawl | n/a | out | Catalogue verdict "no", or personal data, or a licence that needs a request, or paid | None |
| Bright Data | n/a | Not a source | Not a level. The panel approval does not cover this route | This list approves no use of it. Its use for a host that refuses the direct exit conflicts with "no bypass of a block", so it goes to the operator |

## 9. Rulings that this list applies

These lines are a copy of the lines marked "BLD-13" in `rulings.md`. They bind each session, and they replace an earlier line where they differ.

- 2026-11-06 BLD-13 verdict (panel: sanctions-lawyer, osint-expert, journalist, skeptic, two rounds, no dissent). These lines bind each session and replace an earlier line where they differ. Levels and bases: `signed-list.md`. Facts read: 2026-11-06. The list lines take effect with the panel approval of 2026-11-06, under the operator's delegation.
- 2026-11-06 BLD-13 verdict, levels: a non-commercial, share-alike or no-derivatives term gives B, because the open dataset is CC BY 4.0 (ADR 0015). A level rests on words read; a paraphrase is not a read; "terms not found" is n.v. "At best B" and "treat as B" in tickets are void where no terms were read: GUR, ISIS, NBKR, statements, correspondent lists are n.v. A fact can cite a document below A, and its raw data does not leave the store. The money question (is a fee paid for the report) blocks nothing except GFW.
- 2026-11-06 BLD-13 verdict, moved levels: EUR-Lex acts and consolidated texts A for legal persons (legal notice read in a browser; this replaces the wave-eu line); CJEU A; fetch origin Cellar, the fact gives the CELEX number; FSF n.v. and join key only. Form 101, BIC directory, FNS open data, RFSD, SEMA, MFAT, ADS-B, Comtrade (n.v.), PortWatch (n.v.) fall below A. Kremlin stays A. OFAC stays A on 17 USC 105, now read. SEC EDGAR stays A on the sec.gov sentence, issuer statements only.
- 2026-11-06 BLD-13 verdict, register: FNS EGRUL level B, restricted, internal (Art. 6 of 129-FZ read: open access, no reuse text). A Russian state host is allowed by the operator decision on the direct exit. A restricted entry is not a zero.
- 2026-11-06 BLD-13 verdict, named question: "who owns a designated firm" is accepted, per key, with a logged failure and a legal-person owner, new, joined by identifier (O2-05, O2-09 to O2-13). O2-05 and O2-13 wait for the 30-key pilot. A joint-stock extract can give founders and not shareholders: write "registered founder", never a present owner. An LLC owner is a "registered participant".
- 2026-11-06 BLD-13 verdict, D4: a new session per EGRUL extract is refused as limit avoidance. One session; first pace 1 per 30 s; stop on a CAPTCHA; wait the measured reset; never restart to get past it. BLD-09 tests one session at 30 s for at most 60 extracts before a faster pace. The list gives the waiver for this test.
- 2026-11-06 BLD-13 verdict, D19: the Comtrade preview is an offered route and is allowed: paced, named code lists of the ticket, stop on 429, no split of a call to beat a cap, no rotation of address. Level n.v., no raw row and no Comtrade table in the report. If the route fails, TR-03 closes with holes.
- 2026-11-06 BLD-13 verdict, restricted class (EGRUL PDF, court acts, bank statements): store only with the id logged first for BLD-07; propose no fact from such a file until BLD-07 merges (this replaces the fact part of the Sudact line of wave-arms and closes the lawyer dissent). No sole trader. Excerpts name legal persons only. No signatory or judge name. If BLD-07 has not merged at the freeze, the files go to the operator queue for a decision on removal. NBKR rows and Kyrgyz detail pages take the stripped store.
- 2026-11-06 BLD-13 verdict, Sudact: robots allow `/arbitral/doc/<id>/`; the ticket text on a disallowed result path is wrong. No ajax, print or keyed search. Level n.v.
- 2026-11-06 BLD-13 verdict, GUR chain link: `associated_with`, modality attributes, originator GUR, until a `found_in` relation exists (BLD-10). This replaces `subordinate_to` in the wave-arms line, because that type reads "subordinate to" (`db/apply/95_seed.sql`) and the map walks it (`db/apply/20_views.sql`). The other conditions of that line stay. A3 counts on its own line.
- 2026-11-06 BLD-13 verdict, A3 identity (A3-04 to A3-07): machine, maker and model as printed; part, maker and part number as printed, with the weapon designation; weapon, designation as printed; firm, tax number. A page id is a locator, not an identity of the item. No nickname. A seller is not a maker. With no such print, count 0. Count once per maker, model and plant. The legal check of the wording stays open.
- 2026-11-06 BLD-13 verdict, GFW: level B on the API terms read (1.C non-commercial and revocable, 2.B account promise on ocean use, 2.I surveys). The "AIS-only limit" is not a term. No new GFW fact enters the record; L1-08 to L1-11 and V1-03 park; nothing goes to GFW; facts of the last wave stay, marked, out of the report and the release. The panel approves this under the operator's delegation, and this goes further than the operator decision.
- 2026-11-06 BLD-13 verdict, other points: O2-15 stays A under the wave-gleif line, with the scope rule. Danish AIS B, vessels only, no join to a natural person, on aisdata.ais.dk. Out of the wave: RS register, OpenSanctions ru_egrul and the egrul.org mirror (no read, no store; this replaces the lead line of wave-new), Trudvsem, e-disclosure, kad.arbitr, THETIS, IOMOU, Tokyo and Black Sea MoU, P&I search. Telegram: C, by hand, no `telegram_channel` for S1-01. Ukrainian court register: C, single pages by hand, no fact, count 0 (this replaces the wave-new line).
- 2026-11-06 BLD-13 verdict, BLD-09 waiver: the closing sample of BLD-09 has a cap of 30 keys, and the pace test has at most 60 extracts, from the test stack. BLD-06 has merged, so the lease applies and the exception for Russian state hosts ends.
- 2026-11-06 BLD-13 verdict, Bright Data: the list approves no use. Its use for a host that refuses the direct exit conflicts with "no bypass of a block", and this question goes to the operator. Until the answer, a host that refuses the direct exit goes to the blocked queue.
- 2026-11-06 BLD-13 approval: on 2026-11-06 the operator delegated to the panel the approval of the list and the standing rule, in place of a signature (words relayed by the session that coordinates the wave). The panel (sanctions-lawyer, osint-expert, journalist, skeptic) read the final text in a third round, and each expert approves it. No signature of the operator exists. The Bright Data question stays with the operator.

## 10. Standing rule

Rule 2 of `07-panel-verdict.md`, as written, with these words added: the stored terms text is a raw text and not a paraphrase; "terms not found" does not pass; a non-commercial term does not pass.

## 11. Russian state hosts and the BLD-09 waiver

BLD-06 has merged, so the host lease applies to each Russian state host, with direct exit. No exception to the lease is necessary. This list is the written waiver for the real run of BLD-09, from the test stack: a cap of 30 keys for the closing sample, and at most 60 extracts for the pace test.
