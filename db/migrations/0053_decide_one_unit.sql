-- =============================================================================================
-- 0053 — the operator decides one unit, and a rejection keeps its reason              ORDERED
--
-- THE UNIT IS THE THING THAT THE OPERATOR DECIDES (P11). A promotion writes the whole unit or
-- nothing. A rejection rejects the unit, or one relation of it. The rule that a linked batch is
-- decided only as one block goes: the group stays a label and a filter. The doors of one act and
-- the door of the batch go, and the re-runnable files create the doors of the unit.
--
-- A REJECTION KEEPS ONE REASON FROM A FIXED LIST, and a note. The note is required when the
-- reason is "other". Both are private: no view of the read API shows them. The freeze trigger
-- lets the decision write them, and nothing after it.
--
-- EACH DECISION KEEPS ITS MODE: one unit, one relation, or a group action. The origin of a fact
-- on the public page says "the operator" or "the operator, group action" from it. The mode is
-- not private.
--
-- AN OLD DECISION HAS NO REASON AND NO MODE. Nothing recorded them, so no data changes. The door
-- and the freeze trigger require a reason on each new rejection, and a check here would refuse
-- the old rows.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP FUNCTION IF EXISTS decide_batch(uuid, text, text);
DROP FUNCTION IF EXISTS promote_proposal(uuid, text);
DROP FUNCTION IF EXISTS reject_proposal(uuid, text);
DROP FUNCTION IF EXISTS refuse_batch_act(uuid);
DROP FUNCTION IF EXISTS apply_proposal(uuid, text);

-- Origin of the length: decided with the operator. One line explains a rejection.
ALTER TABLE proposals
  ADD COLUMN reject_reason text,
  ADD COLUMN reject_note text,
  ADD COLUMN decided_as text,
  ADD CONSTRAINT proposals_reject_reason
      CHECK (reject_reason IS NULL
             OR (status = 'rejected'
                 AND reject_reason IN ('wrong_value', 'not_in_source', 'wrong_type',
                                       'duplicate', 'out_of_scope', 'end_rejected', 'other'))),
  ADD CONSTRAINT proposals_reject_note
      CHECK (reject_note IS NULL
             OR (reject_reason IS NOT NULL AND char_length(reject_note) BETWEEN 1 AND 500)),
  ADD CONSTRAINT proposals_reject_other_noted
      CHECK (reject_reason IS DISTINCT FROM 'other' OR reject_note IS NOT NULL),
  ADD CONSTRAINT proposals_decided_as
      CHECK (decided_as IS NULL
             OR (status <> 'pending' AND decided_as IN ('unit', 'relation', 'group')));

RESET ROLE;
