-- =============================================================================================
-- 0013 — an act changes the name or the type of an entity                              ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_op_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_op_check
  CHECK (op IN ('create_entity','update_attrs','update_entity','delete_entity',
                'create_relation','update_relation','delete_relation',
                'merge_entities'));

-- The shape is refused when the act is written, and not when it is promoted: an act that can
-- never apply must not wait in the queue of the operator.
ALTER TABLE proposals ADD CONSTRAINT proposals_update_entity_shape
  CHECK (op <> 'update_entity'
         OR (target_kind IS NOT NULL AND target_kind = 'entity'
             AND payload - 'label' - 'type' = '{}'::jsonb
             AND (payload ? 'label' OR payload ? 'type')
             AND (NOT payload ? 'label'
                  OR (coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''))
             AND (NOT payload ? 'type'
                  OR (coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'type', '')) <> ''))));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR (op IN ('update_attrs','update_relation') AND attrs_valid(prior_value))
         OR (op IN ('update_entity','delete_entity','delete_relation')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

RESET ROLE;
