-- =============================================================================================
-- 0085 — the act that updates an entity can clear its geometry                         ORDERED
--
-- A GEOMETRY WITH NO GOOD SOURCE HAD NO WAY OUT OF THE RECORD. An act is append-only, and every
-- act that sets a geometry sets a valid one. The act update_entity now allows `"geom": null`
-- (JSON null) to clear the place. The promotion sets the geometry to NULL and the method to
-- `not_stated`. The old geometry stays in the prior value of the accepted act (P4).
--
-- A CLEARING ACT HAS NO PLACE TO DESCRIBE, so it carries no `geom_method` and no shape. An act
-- that creates an entity still needs a shape. An act that clears a geometry that is NULL already
-- is refused at the promotion (act_changes_something).
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_payload_geom;
ALTER TABLE proposals ADD CONSTRAINT proposals_payload_geom
  CHECK (NOT (payload ? 'geom')
         OR (op = 'update_entity' AND jsonb_typeof(payload->'geom') = 'null')
         OR (coalesce(jsonb_typeof(payload->'geom'), 'absent') = 'object'
             AND coalesce(payload->'geom', '{}'::jsonb) - 'type' - 'coordinates' = '{}'::jsonb
             AND coalesce(payload#>>'{geom,type}', '') IN
                 ('Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon')
             AND coalesce(jsonb_typeof(payload#>'{geom,coordinates}'), 'absent') = 'array'
             AND NOT jsonb_path_exists(
                   coalesce(payload#>'{geom,coordinates}', '[]'::jsonb),
                   '$.**?(@.type() != "number" && @.type() != "array")')
             AND NOT jsonb_path_exists(
                   coalesce(payload#>'{geom,coordinates}', '[]'::jsonb),
                   'strict $.**?(@.type() == "array" && @.size() == 0)')));

-- proposals_payload_geom_position needs no change: a null has no coordinates, so the path finds
-- no position.

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
                  OR (jsonb_typeof(payload->'geom') = 'object'
                      AND coalesce(jsonb_typeof(payload->'geom_method'), 'absent') = 'string'
                      AND payload->>'geom_method' IN (
                        'register_address','osm_object','operator_statement','satellite_match',
                        'photo_video_match','source_coordinates','not_stated')))));

RESET ROLE;
