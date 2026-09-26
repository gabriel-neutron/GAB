-- =============================================================================================
-- 0016 — a create payload holds only what its promotion can apply                      ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- Departure: a key is absent or it holds a value, and never a JSON null. The promotion reads
-- no other key, so an unknown key would be dropped in silence.
ALTER TABLE proposals ADD CONSTRAINT proposals_create_entity_shape
  CHECK (op <> 'create_entity'
         OR (payload - 'type' - 'label' - 'geom' - 'attrs' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'type', '')) <> ''
             AND coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''));

-- External constraint: pg_input_is_valid reads a date by DateStyle, so the pattern holds each
-- day to the ISO form, which every DateStyle reads the same way.
ALTER TABLE proposals ADD CONSTRAINT proposals_create_relation_shape
  CHECK (op <> 'create_relation'
         OR (payload - 'type' - 'src_kind' - 'src_id' - 'dst_kind' - 'dst_id'
                     - 'valid_from' - 'valid_to' - 'attrs' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'type', '')) <> ''
             AND coalesce(jsonb_typeof(payload->'src_id'), 'absent') = 'string'
             AND pg_input_is_valid(coalesce(payload->>'src_id', ''), 'uuid')
             AND coalesce(jsonb_typeof(payload->'dst_id'), 'absent') = 'string'
             AND pg_input_is_valid(coalesce(payload->>'dst_id', ''), 'uuid')
             AND (NOT payload ? 'src_kind'
                  OR coalesce(payload->>'src_kind', '') IN ('entity','relation'))
             AND (NOT payload ? 'dst_kind'
                  OR coalesce(payload->>'dst_kind', '') IN ('entity','relation'))
             AND (NOT payload ? 'valid_from'
                  OR (coalesce(jsonb_typeof(payload->'valid_from'), 'absent') = 'string'
                      AND coalesce(payload->>'valid_from', '') ~ '^\d{4}-\d{2}-\d{2}$'
                      AND pg_input_is_valid(coalesce(payload->>'valid_from', ''), 'date')))
             AND (NOT payload ? 'valid_to'
                  OR (coalesce(jsonb_typeof(payload->'valid_to'), 'absent') = 'string'
                      AND coalesce(payload->>'valid_to', '') ~ '^\d{4}-\d{2}-\d{2}$'
                      AND pg_input_is_valid(coalesce(payload->>'valid_to', ''), 'date')))));

RESET ROLE;
