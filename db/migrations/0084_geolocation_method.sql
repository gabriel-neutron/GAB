-- =============================================================================================
-- 0084 — a geometry has a method of geolocation                                        ORDERED
--
-- A READER COULD NOT TELL HOW THE PLACE OF A FACT WAS FOUND. An entity had a point or a shape,
-- and the way a source found it lived in the research notes only. The column `geom_method` holds
-- one of seven words: a register address, an OpenStreetMap object, a statement of the operator
-- of the site, a match with satellite imagery, a match with a photo or a video, coordinates that
-- the source writes, or `not_stated`.
--
-- THE DEFAULT IS `not_stated`, and it is a true value: no source of the place says how it was
-- found. The entities that stand take it here, so this file guesses no method in SQL. A command
-- reads the sources of each place again and fills the method where a source states it clearly
-- (fill_geolocation_method). An entity with no geometry holds the default too, and no reader
-- reads the column of an entity with no place.
--
-- THE LIST IS CLOSED BY A CHECK. A new word is a new migration, as for the type of a document.
-- The same words stand in packages/proposal/src/geolocation-method.ts, and a test compares the
-- two lists.
--
-- AN ACT THAT CARRIES A PLACE CARRIES ITS METHOD under the key `geom_method` of the payload. The
-- shape of `create_entity` and of `update_entity` allows the key, and only beside a `geom`. The
-- shape does not require the key: an act that waits in the queue was written before this file,
-- and a CHECK that requires it would refuse the decision on that act. The door of a machine
-- (propose_change) requires it, and the door of the operator writes `not_stated` when the caller
-- gives none.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE entities ADD COLUMN geom_method text NOT NULL DEFAULT 'not_stated'
  CONSTRAINT entities_geom_method_closed
  CHECK (geom_method IN ('register_address','osm_object','operator_statement','satellite_match',
                         'photo_video_match','source_coordinates','not_stated'));

ALTER TABLE proposals DROP CONSTRAINT proposals_update_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_entity_shape
  CHECK (op <> 'update_entity'
         OR (target_kind IS NOT NULL AND target_kind = 'entity'
             AND payload - 'label' - 'type' - 'geom' - 'geom_method' = '{}'::jsonb
             AND (payload ? 'label' OR payload ? 'type' OR payload ? 'geom')
             AND (NOT payload ? 'label'
                  OR (coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''))
             AND (NOT payload ? 'type'
                  OR (coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'type', ''), E' \t\n\r\f\v') <> ''))
             AND (NOT payload ? 'geom_method'
                  OR (payload ? 'geom'
                      AND coalesce(jsonb_typeof(payload->'geom_method'), 'absent') = 'string'
                      AND payload->>'geom_method' IN (
                        'register_address','osm_object','operator_statement','satellite_match',
                        'photo_video_match','source_coordinates','not_stated')))));

ALTER TABLE proposals DROP CONSTRAINT proposals_create_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_create_entity_shape
  CHECK (op <> 'create_entity'
         OR (payload - 'type' - 'label' - 'geom' - 'geom_method' - 'attrs' - 'sources'
               - 'sources_from' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'type', '')) <> ''
             AND coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''
             AND (NOT payload ? 'sources'
                  OR jsonb_text_array_within(payload->'sources', src::text[]))
             AND (NOT payload ? 'sources_from'
                  OR (originator IS NOT NULL AND originator = 'GAB v1 ORBAT (operator)'
                      AND coalesce(jsonb_typeof(payload->'sources_from'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'sources_from', '')) <> ''))
             AND (NOT payload ? 'geom_method'
                  OR (payload ? 'geom'
                      AND coalesce(jsonb_typeof(payload->'geom_method'), 'absent') = 'string'
                      AND payload->>'geom_method' IN (
                        'register_address','osm_object','operator_statement','satellite_match',
                        'photo_video_match','source_coordinates','not_stated')))));

RESET ROLE;
