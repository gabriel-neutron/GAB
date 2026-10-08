-- =============================================================================================
-- 0063 — the reason of a decision of an AI reviewer                                   ORDERED
--
-- AN AI REVIEWER DECIDES AS A SEPARATE ACT. The research AI accepts or rejects a unit, or rejects
-- one relation, through doors of its own in the re-runnable files. The origin of such a decision
-- is "decided by an AI reviewer". It is not a rule, and it is not "validated manually by the
-- operator".
--
-- THE AI GIVES A REASON FOR EACH DECISION. A promotion has no column for a reason, so this column
-- holds the reason that the AI gives, for a promotion and for a rejection. Only a decision of an
-- AI reviewer holds one. No machine role and no view of the read API reads the column: the
-- reason can quote a page, as the note of a rejection can.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals
  ADD COLUMN decision_reason text,
  ADD CONSTRAINT proposals_decision_reason
      CHECK (CASE WHEN decision_origin = 'decided by an AI reviewer'
                  THEN decision_reason IS NOT NULL
                       AND btrim(decision_reason) <> ''
                       AND char_length(decision_reason) <= 1000
                  ELSE decision_reason IS NULL END);

RESET ROLE;
