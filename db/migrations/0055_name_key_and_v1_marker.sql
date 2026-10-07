-- =============================================================================================
-- 0055 — the name of an entity as the review compares it, and the v1 marker              ORDERED
--
-- THE CHECK OF THE FAULTS FINDS THE SAME NAME AND TYPE IN THE RECORD. It compares two names in
-- lower case, with one space between two words. The function is here and not in the re-runnable
-- files, because the index of the record reads it: a change of the function needs a new index.
--
-- A V1 ACT SAYS THAT ITS SOURCES COME FROM A PARENT. The importer of the v1 work writes the name
-- of that parent in the payload, beside the attributes. The promotion copies only the name, the
-- type, the location, the attributes and the sources, so the marker never reaches the public
-- record. Only an act of the v1 import can hold it.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION name_key(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp AS $$
  SELECT lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')))
$$;

CREATE INDEX entities_name_key_idx ON entities (name_key(label), type);

ALTER TABLE proposals DROP CONSTRAINT proposals_create_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_create_entity_shape
  CHECK (op <> 'create_entity'
         OR (payload - 'type' - 'label' - 'geom' - 'attrs' - 'sources' - 'sources_from'
               = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'type', '')) <> ''
             AND coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''
             AND (NOT payload ? 'sources'
                  OR jsonb_text_array_within(payload->'sources', src::text[]))
             AND (NOT payload ? 'sources_from'
                  OR (originator IS NOT NULL AND originator = 'GAB v1 ORBAT (operator)'
                      AND coalesce(jsonb_typeof(payload->'sources_from'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'sources_from', '')) <> ''))));

RESET ROLE;
