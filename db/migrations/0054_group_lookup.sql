-- =============================================================================================
-- 0054 — the acts of one group, found by an index                                     ORDERED
--
-- THE CHECK OF THE FAULTS NAMES THE GROUP OF EACH END THAT WAITS, AND OF EACH ENTITY WITH THE SAME
-- NAME, by its subject. The subject reads every act of the group, also the decided acts, so that
-- the name of a group does not change while the operator decides it. The index of the pending acts
-- does not hold the decided acts. Measured on 7 October 2026: a read of one subject scanned the
-- 2,075 acts of the record twice, and the check of every unit took 2.7 s.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE INDEX proposals_batch_idx ON proposals (batch_id) WHERE batch_id IS NOT NULL;

RESET ROLE;
