-- =============================================================================================
-- 0098 — an AI reviewer removes an accepted act, with a reason and a cited passage      ORDERED
--
-- A DECIDED ACT IS FROZEN, SO A REMOVAL IS A NEW ACT. The act `remove_act` names the accepted act
-- that it removes (names[1]) and targets the row that the removed act wrote: the relation of a
-- `create_relation` act, or the entity or relation of an `update_attrs` act. It carries no payload.
-- It cites the document of the passage that shows the removed act is wrong. Its snapshot keeps the
-- copy of what it took away, and the ledger keeps who removed it, when, and why (ADR 0035).
--
-- AN ACT IS REMOVED ONE TIME. The unique index holds one accepted removal for each removed act,
-- so a count of the removed acts never counts one act twice.
--
-- No row of the record changes: no act of this kind exists before this file.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_op_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_op_check
  CHECK (op IN ('create_entity','update_attrs','update_entity','delete_entity',
                'create_relation','update_relation','delete_relation',
                'merge_entities','undo_merge','map_document','create_observation',
                'remove_act'));

ALTER TABLE proposals ADD CONSTRAINT proposals_remove_act_shape
  CHECK (op <> 'remove_act'
         OR (target_kind IS NOT NULL
             AND cardinality(names) = 1
             AND cardinality(src) >= 1
             AND payload = '{}'::jsonb));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR ((op = 'update_attrs'
              OR (op = 'update_relation' AND NOT payload ? 'valid_to' AND NOT payload ? 'type'
                  AND NOT payload ? 'valid_from' AND NOT payload ? 'add_source'))
             AND attrs_valid(prior_value))
         OR (op = 'update_relation' AND payload ? 'valid_to'
             AND prior_value - 'valid_to' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_to'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'valid_from'
             AND prior_value - 'valid_from' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_from'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'type'
             AND prior_value - 'type' - 'sources' = '{}'::jsonb
             AND prior_value ? 'type'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'add_source'
             AND prior_value - 'sources' = '{}'::jsonb
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge','remove_act')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

CREATE UNIQUE INDEX proposals_remove_act_once ON proposals ((names[1]))
  WHERE op = 'remove_act' AND status = 'accepted';

RESET ROLE;
