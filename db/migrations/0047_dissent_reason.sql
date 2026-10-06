-- =============================================================================================
-- 0047 — why an act is disputed                                                       ORDERED
--
-- THE REVIEW CARD SAYS WHY A CLAIM IS DISPUTED. A machine act is disputed when a value is not in
-- its passage, or when the check by a model of another family does not support it. The propose
-- tool writes the reason with the flag, and the freeze of the act at insert keeps both.
--
-- THE REASON IS PRIVATE. It quotes the checker and names values beside a passage of a document
-- whose licence may be unknown. No view of the read API shows it; the writer reads it for the
-- review card as the operator.
--
-- AN OLD ACT HAS NO REASON. Nothing recorded why it was disputed, so no data changes.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- Origin of the length: decided. The tool cuts a longer reason, so the card stays short.
ALTER TABLE proposals
  ADD COLUMN dissent_reason text,
  ADD CONSTRAINT proposals_dissent_reason
      CHECK (dissent_reason IS NULL
             OR (dissent AND char_length(dissent_reason) BETWEEN 1 AND 1000));

RESET ROLE;
