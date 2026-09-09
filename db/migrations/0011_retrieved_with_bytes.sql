-- =============================================================================================
-- 0011 — the retrieval date is keyed on the bytes, and not on the kind                 ORDERED
--
-- WHAT WAS WRONG. doc_retrieved_required read `kind = 'manual' OR retrieved_at IS NOT NULL`.
-- It keyed a rule about EVIDENCE on a word that names a KIND, so a `url` row could not stand
-- until a date was written, whether or not one page had been read.
--
-- WHY IT MUST MOVE NOW. The two source columns of the v1 corpus hold 249 distinct tokens and NO
-- retrieval date, because v1 recorded none. One token is the literal string `[object Object]`,
-- which is a v1 defect and not an address, so 248 ADDRESSES REMAIN and every count below is 248.
-- The fetch of those hosts is refused (plan limit 11: a bulk fetch of
-- Russian-language military hosts from one address is counter-intelligence exposure, and one
-- host is a soldiers' mothers forum holding personal data). Two rules close every other door:
-- proposals_src_exists_fn refuses a proposal citing a document that does not exist, so the
-- documents must land BEFORE the entities; and promote_proposal never extends entities.sources
-- (#86), so a source cannot be attached to an entity that already stands. Either a date is
-- invented for 248 documents, or this rule changes. The operator ruled on 8 September 2026
-- that the rule changes, because an invented date is a fabricated provenance.
--
-- THE NEW RULE. A row that holds bytes carries the date they were taken. A row that is only an
-- address carries nothing, and NO STATE COLUMN IS NEEDED to say it. The absent date is the whole
-- record, and a second column holding the word `never_retrieved` would be a second way to say
-- one thing, which is two query behaviours and two defects.
--
-- M9 IS THE SAME THOUGHT AND IT IS NOT THE SAME RULE, so this file does not stand on it. M9
-- reads "a value always exists; the unknown is the absence of a KEY", and it governs the attrs
-- object, where `v` is never null. `documents` is a table of columns and not an attrs object,
-- and a nullable column is how a table says the same thing.
--
-- READ THE ABSENT DATE AS THE WEAKER SENTENCE, AND NEVER AS THE STRONGER ONE. `retrieved_at IS
-- NULL` says NO DATE IS RECORDED. It does NOT say the source was never read: a person may have
-- read a page in v1 and written nothing down, and this column cannot tell the two apart. PU1
-- publishes the candidate layer, so the stronger reading would put a claim about provenance in
-- front of a reader — a smaller false claim than an invented date, and the same kind of thing
-- this file exists to end. The one surface that prints the column already says the weaker and
-- true sentence, `No date of retrieval`, and this header agrees with it.
--
-- M6 IS NOT BENT, IT IS READ. M6 says a date "says when a source was read". A source nobody has
-- read has no such date to store. The old rule demanded one anyway, and got a false one.
--
-- WHAT IS LOST, AND IT IS REAL. 742 entities will cite addresses nobody has opened, and PU1
-- publishes the candidate layer. That is the journalist reviewer's standing objection (plan
-- limits 5 and 10). This file does not cause it — the fetch is deferred either way — it makes
-- it VISIBLE instead of hiding it behind a date that was never true.
--
-- BOTH RESERVED DOCUMENTS STILL PASS. `manual` and `inherited` hold no s3_key and no sha256,
-- so the first branch holds for each, and 95_seed.sql writes no different row.
--
-- THE RULE IS NOT ONLY WEAKER, AND THIS IS THE PART A READER WILL MISS. It REFUSES one row the
-- old rule accepted: a `manual` document that holds an s3_key or a sha256 and no date. The old
-- rule read the kind, so `manual` escaped it whatever the row held. That row is now a
-- contradiction the table states — bytes were taken, and no moment is recorded. No such row is
-- in the seed or in the committed fixture, so no database that exists today is broken by it.
--
-- THE CONSTRAINT IS RENAMED, because the old name says a rule this file no longer states. A
-- name that states the wrong rule is the defect 0008 was written to end.
--
-- IT CANNOT PASS BY THREE-VALUED LOGIC. `IS NULL` and `IS NOT NULL` each yield true or false
-- and never NULL, and AND and OR over four such terms yield one of the two.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0003. node-pg-migrate keeps a ledger in the `migrations`
-- schema, so an edit to a file already applied reaches no running database until `pnpm db:reset`.
-- 0003 stays the record of what the first schema was.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents DROP CONSTRAINT doc_retrieved_required;

-- The bytes carry the date they were taken. An address alone carries nothing.
ALTER TABLE documents ADD CONSTRAINT doc_retrieved_with_bytes
  CHECK ((s3_key IS NULL AND sha256 IS NULL) OR retrieved_at IS NOT NULL);

RESET ROLE;
