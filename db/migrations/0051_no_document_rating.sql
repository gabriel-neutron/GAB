-- =============================================================================================
-- 0051 — a document carries no rating                                                 ORDERED
--
-- THE PRODUCT REMOVED THE RATING. No door wrote a rating, no rule read one, and the screens no
-- longer draw one. The two columns and their checks go.
--
-- NO VALUE OF THE RECORD IS LOST. Measured on 7 October 2026: no document of the record and no
-- document of the test database carries a rating.
--
-- THE VIEW READS THE COLUMNS, so it goes first, and the re-runnable files create it again. Each
-- check names only these columns, so it goes with them.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP VIEW IF EXISTS api.document;

ALTER TABLE documents
  DROP COLUMN admiralty,
  DROP COLUMN admiralty_origin;

RESET ROLE;
