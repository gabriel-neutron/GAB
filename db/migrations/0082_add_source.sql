-- =============================================================================================
-- 0082 — an act adds a cited source to a relation of the record                          ORDERED
--
-- A RELATION CAN CITE A PAGE THAT IS NOT THE OFFICIAL FILE. The alignment matrix gives a
-- designation to a regime only when the relation cites a document of an official file (ADR
-- 0017). A designation that cites the Federal Register alone counts in no regime. Before this
-- file, `update_relation` could not add a source: it set a date or a type. Now it has a fifth
-- form, `add_source`: the payload holds `{"add_source": true}`, and the documents that the act
-- cites join the documents of the relation. The dates and the type stay as they are. The
-- promotion works as the start date does (0078): it takes a lock on the row, and it refuses an
-- act that adds no document.
--
-- THE SOURCE FORM HOLDS THE FLAG AND NOTHING ELSE.
--
-- THE SNAPSHOT OF A SOURCE is what the act replaced: the documents of the row before the act
-- added its own.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_names_attrs;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (op = 'update_relation'
             AND (payload ? 'valid_to' OR payload ? 'type' OR payload ? 'valid_from'
                  OR payload ? 'add_source'))
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

ALTER TABLE proposals ADD CONSTRAINT proposals_add_source_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'add_source'
         OR payload = '{"add_source": true}'::jsonb);

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
                    'merge_entities','undo_merge')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

RESET ROLE;
