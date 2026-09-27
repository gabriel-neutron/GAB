-- =============================================================================================
-- 0017 — a position lies on the globe, with two ordinates, in a valid shape            ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- External constraint: entities.geom refuses a third ordinate, so an act that carries one can
-- never be promoted. A position is each list whose first leaf is a number. A filter that meets
-- an error is not true, so a list too short to read is left to proposals_payload_geom.
ALTER TABLE proposals ADD CONSTRAINT proposals_payload_geom_position
  CHECK (NOT payload ? 'geom'
         OR NOT jsonb_path_exists(
              coalesce(payload#>'{geom,coordinates}', '[]'::jsonb),
              'strict $.**?(@.type() == "array" && @[0].type() == "number"
                            && (@.size() != 2 || @[0] < -180 || @[0] > 180
                                || @[1] < -90 || @[1] > 90))'));

-- External constraint: ST_SetSRID labels the numbers as degrees and moves nothing, and an empty
-- geometry has no extent. So a row in metres, an empty row or an invalid shape is refused here.
ALTER TABLE entities ADD CONSTRAINT entities_geom_on_globe
  CHECK (geom IS NULL
         OR coalesce(public.ST_IsValid(geom)
                     AND public.ST_XMin(geom) >= -180 AND public.ST_XMax(geom) <= 180
                     AND public.ST_YMin(geom) >= -90 AND public.ST_YMax(geom) <= 90, false));

RESET ROLE;
