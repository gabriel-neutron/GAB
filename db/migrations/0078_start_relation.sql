-- =============================================================================================
-- 0078 — an act gives the start date of a relation that has none                         ORDERED
--
-- A RELATION CAN COME INTO THE RECORD WITH NO START. The first source named the relation, but no
-- dated text was cited, and a later source gives the day. Before this file, the only way was to
-- delete the relation and create it again, and the delete lost the documents of the old row and
-- its identifier. Now `update_relation` has a fourth form: the start date alone. The promotion
-- writes the start and adds the documents of the act to the documents of the relation, as the end
-- date does (0071). It refuses a type that takes no interval, a relation that has a start
-- already, and a start after the end.
--
-- THE START FORM HOLDS THE START AND NOTHING ELSE. The day is in the ISO form, as in the close
-- form.
--
-- THE SNAPSHOT OF A START is what the act replaced: no start, and the documents of the row before
-- the act added its own.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_names_attrs;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (op = 'update_relation'
             AND (payload ? 'valid_to' OR payload ? 'type' OR payload ? 'valid_from'))
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

ALTER TABLE proposals ADD CONSTRAINT proposals_start_relation_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'valid_from'
         OR (payload - 'valid_from' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'valid_from'), 'absent') = 'string'
             AND coalesce(payload->>'valid_from', '') ~ '^\d{4}-\d{2}-\d{2}$'
             AND pg_input_is_valid(coalesce(payload->>'valid_from', ''), 'date')));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR ((op = 'update_attrs'
              OR (op = 'update_relation' AND NOT payload ? 'valid_to' AND NOT payload ? 'type'
                  AND NOT payload ? 'valid_from'))
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
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

RESET ROLE;
