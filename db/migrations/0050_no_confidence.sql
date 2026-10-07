-- =============================================================================================
-- 0050 — a proposal states no confidence                                              ORDERED
--
-- THE PRODUCT REMOVED THE CONFIDENCE. The operator decides each act on the review screen, which
-- flags the faults of the act. No rule and no screen reads a self-report of the author, so the
-- column and the parameter of the door go.
--
-- NO VALUE OF THE RECORD IS LOST. Measured on 7 October 2026: the record holds no act with a
-- confidence. A test database can hold one that a test wrote, and it goes with the column.
--
-- THE ORDER IS THE ORDER OF THE DEPENDENCIES. The view reads the column, so it goes first, and
-- the re-runnable files create it again. The door goes before the column, because its signature
-- holds the parameter. The re-runnable files create the door again with no confidence.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP VIEW IF EXISTS api.proposal;

DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid);

ALTER TABLE proposals DROP COLUMN confidence;

RESET ROLE;
