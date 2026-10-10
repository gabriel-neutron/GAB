-- =============================================================================================
-- 0071 — an act gives the end date of an open relation                                   ORDERED
--
-- A CHANGE OF FLAG OR OWNER CLOSES THE OLD RELATION. Before this file, the only way to give an end
-- to a relation of the record was to delete it and create it again with both bounds, and the
-- delete lost the documents of the old row. Now `update_relation` has a second form: the end date
-- alone. The promotion writes the end and adds the documents of the act to the documents of the
-- relation. It refuses a type that takes no interval, a relation that has an end already, and an
-- end before the start.
--
-- THE CLOSE FORM HOLDS THE END AND NOTHING ELSE, so an act that gives an end is never also a
-- change of attributes. Each form has its own refusal. The day is in the ISO form, which each
-- DateStyle reads the same way, as in the create form of a relation.
--
-- THE SNAPSHOT OF A CLOSE is what the act replaced: no end, and the documents of the row before
-- the act added its own.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_names_attrs;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (op = 'update_relation' AND payload ? 'valid_to')
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

ALTER TABLE proposals ADD CONSTRAINT proposals_close_relation_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'valid_to'
         OR (payload - 'valid_to' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'valid_to'), 'absent') = 'string'
             AND coalesce(payload->>'valid_to', '') ~ '^\d{4}-\d{2}-\d{2}$'
             AND pg_input_is_valid(coalesce(payload->>'valid_to', ''), 'date')));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR (op IN ('update_attrs','update_relation') AND NOT payload ? 'valid_to'
             AND attrs_valid(prior_value))
         OR (op = 'update_relation' AND payload ? 'valid_to'
             AND prior_value - 'valid_to' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_to'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

RESET ROLE;
