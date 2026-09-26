-- =============================================================================================
-- 0014 — the name of an act binds the kind of its target                                ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The promotion picks its table from target_kind alone. An act named for one kind that targets
-- the other would delete or change a row that the queue does not name. update_attrs stays free:
-- the writer sends it for both kinds.
ALTER TABLE proposals ADD CONSTRAINT proposals_op_target_kind
  CHECK ((op <> 'delete_entity'
          OR (target_kind IS NOT NULL AND target_kind = 'entity'))
         AND (op NOT IN ('delete_relation','update_relation')
              OR (target_kind IS NOT NULL AND target_kind = 'relation')));

RESET ROLE;
