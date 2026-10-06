-- =============================================================================================
-- 0044 — the batch of a proposal                                                   ORDERED
--
-- A LINKED BATCH IS DECIDED AS ONE UNIT. A machine proposes a company, its vessels and the
-- links between them in one call, and a link names an entity that the same call creates. The
-- operator promotes or rejects the linked acts together, so the graph never holds a link to a
-- missing entity. The column holds the identity of that unit, and the batch door sets it.
--
-- ONLY A LINKED ACT GETS A BATCH. Two acts of one call that name no act of each other stay two
-- single acts, so a faulty claim never blocks a good claim that the same page stated.
--
-- AN ACT OF THE OPERATOR HAS NO BATCH. The operator signs each act whole, so no act of the
-- operator waits for a decision with another one.
--
-- AN OLD ACT HAS NO BATCH. No act before this file was decided as a unit, so each one stays a
-- single act and no data changes.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals
  ADD COLUMN batch_id uuid,
  ADD CONSTRAINT proposals_batch_machine
      CHECK (author_role <> 'gabriel_app' OR batch_id IS NULL);

CREATE INDEX proposals_pending_batch_idx
  ON proposals (batch_id) WHERE status = 'pending' AND batch_id IS NOT NULL;

RESET ROLE;
