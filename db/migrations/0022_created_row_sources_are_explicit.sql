-- =============================================================================================
-- 0022 — a created row publishes only the sources its act gave it, not every attribute's  ORDERED
--
-- S2 already decided this: the row-level list backs the typed columns of the row — label, type
-- and geom on an entity; type, its endpoints and its dates on a relation — and an attribute's own
-- `src` backs that one value alone. promote_proposal did not implement that split: it published
-- `src`, the act's whole citation set, as the row-level list, so a document that backs only one
-- attribute was published as if it also backed the row's name, type or position.
--
-- `payload.sources` CARRIES THE ROW'S OWN CITATION, WHEN THE ACT GIVES ONE. It is optional: a
-- create candidate from the fixture's agent-authored layer names no such field yet, because no
-- agent proposes a create today (#25 gates that). Such a candidate keeps the old, wider
-- behaviour until #25 gives it a real shape. The human-authored writer and the fixture's
-- promoted layer always give one.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The same shape `attrs_src_within` reads for one attribute's `src`, applied to a plain array:
-- non-empty, every element a non-blank string, every element inside `docs`.
CREATE FUNCTION jsonb_text_array_within(items jsonb, docs text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(jsonb_typeof(items), 'absent') = 'array'
     AND jsonb_array_length(items) >= 1
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(items) AS e(v)
        WHERE jsonb_typeof(e.v) <> 'string'
           OR length(btrim(e.v #>> '{}', E' \t\n\r\f\v')) = 0
           OR NOT (coalesce(docs, ARRAY[]::text[]) @> ARRAY[e.v #>> '{}']));
$$;

ALTER TABLE proposals DROP CONSTRAINT proposals_create_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_create_entity_shape
  CHECK (op <> 'create_entity'
         OR (payload - 'type' - 'label' - 'geom' - 'attrs' - 'sources' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'type', '')) <> ''
             AND coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''
             AND (NOT payload ? 'sources'
                  OR jsonb_text_array_within(payload->'sources', src::text[]))));

ALTER TABLE proposals DROP CONSTRAINT proposals_create_relation_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_create_relation_shape
  CHECK (op <> 'create_relation'
         OR (payload - 'type' - 'src_kind' - 'src_id' - 'dst_kind' - 'dst_id'
                     - 'valid_from' - 'valid_to' - 'attrs' - 'sources' = '{}'::jsonb
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
                      AND pg_input_is_valid(coalesce(payload->>'valid_to', ''), 'date')))
             AND (NOT payload ? 'sources'
                  OR jsonb_text_array_within(payload->'sources', src::text[]))));

RESET ROLE;
