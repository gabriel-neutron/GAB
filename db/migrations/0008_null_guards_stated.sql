-- =============================================================================================
-- 0008 — three guards written down                                                     ORDERED
--
-- THE AUDIT THAT FOUND THEM. Every CHECK of db/migrations/** and db/apply/** was read for one
-- fault: an expression that yields NULL, which a CHECK accepts. Every rule was found sound, and
-- three were found sound BY ACCIDENT OF THREE-VALUED LOGIC and not by their text:
--
--   documents.admiralty ~ '^[A-F][1-6]$'
--   documents.admiralty_origin IN ('machine','arbitrated','human')
--   jobs.failure_kind IN ('network','rejected','credits')
--
-- Each sits on a nullable column with no IS NULL guard. A NULL value makes the expression NULL,
-- and the row passes. A NULL is legal in all three, so NO ROW IS WRONG TODAY and this file
-- changes no behaviour.
--
-- WHY IT IS WORTH A MIGRATION ANYWAY. Four rules in the same schema — sha256, unit, target_kind
-- and confidence — state `x IS NULL OR ...` in their text. These three did not, so the same
-- schema said the same thing two ways, and only one of them survives a reader who does not know
-- the rule. A guard a reader can see is a guard a later edit cannot remove by accident.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0003 AND 0004. node-pg-migrate keeps a ledger in the
-- `migrations` schema, so an edit to a file already applied reaches no running database until
-- `pnpm db:reset`. A new file applies to the database the operator runs today.
--
-- EACH CONSTRAINT IS NAMED HERE. The three were written inline, so PostgreSQL named them, and a
-- generated name is one a later migration cannot rely on.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- ---------------------------------------------------------------------------- documents -----
ALTER TABLE documents DROP CONSTRAINT documents_admiralty_check;
ALTER TABLE documents ADD CONSTRAINT doc_admiralty_shape
  CHECK (admiralty IS NULL OR admiralty ~ '^[A-F][1-6]$');

ALTER TABLE documents DROP CONSTRAINT documents_admiralty_origin_check;
ALTER TABLE documents ADD CONSTRAINT doc_admiralty_origin_word
  CHECK (admiralty_origin IS NULL
         OR admiralty_origin IN ('machine','arbitrated','human'));

-- --------------------------------------------------------------------------------- jobs -----
ALTER TABLE jobs DROP CONSTRAINT jobs_failure_kind_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_failure_kind_word
  CHECK (failure_kind IS NULL
         OR failure_kind IN ('network','rejected','credits'));

RESET ROLE;
