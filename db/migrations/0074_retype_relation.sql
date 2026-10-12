-- =============================================================================================
-- 0074 — an act changes a relation from designated_by to restricted_by                    ORDERED
--
-- A SECTORAL MEASURE IS NOT A LISTING WITH AN ASSET FREEZE. The record holds promoted relations
-- of type `designated_by` that state a sectoral measure, and they must be `restricted_by`. Before
-- this file, the only way was to delete the relation and create it again, and the delete lost the
-- documents of the old row and its identifier. Now `update_relation` has a third form: the type
-- alone. The promotion writes the type and adds the documents of the act to the documents of the
-- relation, as the end date does (0071).
--
-- THE TYPE FORM HOLDS THE NEW TYPE AND NOTHING ELSE, and the new type is `restricted_by`. A free
-- change of type is a judgement of the operator and needs its own decision, so the shape check
-- names the one target. The old type is checked by the promotion and by the batch door.
--
-- THE SNAPSHOT OF A RETYPE is what the act replaced: the old type, and the documents of the row
-- before the act added its own.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_names_attrs;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (op = 'update_relation' AND (payload ? 'valid_to' OR payload ? 'type'))
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

ALTER TABLE proposals ADD CONSTRAINT proposals_retype_relation_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'type'
         OR payload = '{"type": "restricted_by"}'::jsonb);

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR ((op = 'update_attrs'
              OR (op = 'update_relation' AND NOT payload ? 'valid_to' AND NOT payload ? 'type'))
             AND attrs_valid(prior_value))
         OR (op = 'update_relation' AND payload ? 'valid_to'
             AND prior_value - 'valid_to' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_to'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'type'
             AND prior_value - 'type' - 'sources' = '{}'::jsonb
             AND prior_value ? 'type'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

RESET ROLE;
