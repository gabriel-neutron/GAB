-- =============================================================================================
-- 0012 — a geometry is absent, or it has the shape of a geometry                       ORDERED
--
-- WHAT WAS MEASURED. `promote_proposal` builds a geometry when `p.payload ? 'geom'`
-- (db/apply/40_functions.sql). A key whose value is JSON null answers that test. So
-- ST_GeomFromGeoJSON received a null, and it raised `XX000 invalid GeoJSON representation`. The
-- proof of #8 met it on ten rows of a 57-row sample. The loader mapped a nullable column
-- straight through, and it wrote `"geom": null`. That is what a loader does before it is told
-- not to.
--
-- IT IS M9, FOR A COLUMN M9 NEVER REACHED. The unknown is the absence of the key. `attrs_valid`
-- says that of every attribute value. Nothing said it of the position.
--
-- WHAT THE RULE SHUTS. The refusal named no constraint, and it carried an internal SQLSTATE. A
-- caller could not part it from a fault inside PostGIS. No rule governed `payload->'geom'` at
-- all, so the queue accepted an act that no promotion can apply. Both faults are shut.
--
-- WHAT IT DOES NOT SHUT. A promotion that raises leaves its act pending for ever. A loader that
-- resumes cannot part that orphan from an act a person left pending on purpose. This rule
-- removes the routes below, and never the orphan itself.
--
-- THE SHAPE IS COPIED FROM proposals_payload_attrs. It is a CHECK on the table, so no write path
-- avoids it.
--
-- SIX TESTS, AND EACH ONE WAS MEASURED. A first draft read the first test alone. Four later
-- readings met the other five behind it.
--
--   the value is an object       `null` raises `invalid GeoJSON representation`
--   it holds no third key        a `crs` member moves the position, and raises nothing
--   the type is one of six       `{"type":"Bogus", ...}` raises `invalid GeoJson representation`
--   the coordinates are a list   `{"type":"Point"}` raises `Unable to find 'coordinates'`
--   every leaf is a number       `[[1,2],null]` raises `not sufficiently nested`
--   no list is empty             `[]` raises nothing, and it stores `POINT EMPTY`
--
-- THE TWO SPELLINGS ARE NOT A TYPING FAULT. PostGIS writes `GeoJSON` on the first row and
-- `GeoJson` on the third, from two paths inside it. Both are quoted here as they were measured.
--
-- THE FIFTH TEST IS THE FIRST ONE AGAIN, AT EVERY DEPTH. A null is never a value, wherever it
-- stands. `$.**` reads every depth of the list, so no nesting hides one.
--
-- THREE TESTS SHUT A FAULT THAT RAISES NOTHING, AND SILENCE IS THE WORSE FAULT.
--
--   `crs`, naming EPSG:3857  stores the metres of the act, and labels them as degrees
--   `["",""]`               stores `POINT(0 0)`, and `[true,false]` stores `POINT(1 0)`
--   `[]`                    stores `POINT EMPTY`
--
-- THE `crs` MEMBER IS THE WORST OF THE THREE. ST_GeomFromGeoJSON reads it and returns SRID
-- 3857. `promote_proposal` then wraps the value in `ST_SetSRID(..., 4326)`, which relabels the
-- geometry and never transforms it. The numbers stay and the label changes.
--
-- MEASURED: `[451000,6640000]` under EPSG:3857 named `POINT(4.0514 51.1056)`, and the store kept
-- `POINT(451000 6640000)` as degrees. No distance is quoted here. A longitude of 451000 degrees
-- names no place on the globe, and every way to measure that error gives another number.
--
-- THE SECOND TEST IS THE SHAPE OF attrs_valid, AND IT COSTS `bbox`. An attribute is exactly
-- `{v, src}` and a third key is refused. A geometry is exactly a type and a list of coordinates.
-- A lawful GeoJSON `bbox` member falls with `crs`. The union at the door of the writer refuses
-- both already, so the two doors agree.
--
-- THE SIXTH TEST MOVED THE DOOR OF THE WRITER TOO. That union set no minimum count on a list,
-- so it took `{"type":"LineString","coordinates":[]}` and the database then answered 23514. A
-- caller must read a 422 from the door, and never a constraint violation. So the union now
-- states that no list of positions is empty, at any depth.
--
-- AN EMPTY LIST NEEDS ONE PATH, AND THE WORD `strict` IS LOAD-BEARING. `$.**` reads the root in
-- both modes. The filter is what differs: lax mode unwraps `@`, so an empty array gives no item
-- and the test is never true. `strict $.**` holds the empty array itself, so `[]`, `[[]]` and
-- `[[[]]]` are all refused by one test.
--
-- THE SIX WORDS ARE THE WORDS OF THE WRITER. `geom: geometry.optional()` in
-- packages/proposal/src/request.ts states a union of six types. This rule states the same six,
-- so the two doors agree on what a geometry is.
--
-- A `GeometryCollection` IS REFUSED BY BOTH DOORS, AND THAT IS THE COST. PostGIS reads one, and
-- it carries `geometries` in place of `coordinates`. Nothing needs it: the v1 corpus that waits
-- holds 291 geometries, and every one of them is a point, measured on 8 September 2026. The day
-- a collection is wanted, this rule and that union move together.
--
-- THE DEPTH AND THE ARITY OF THE LIST ARE NOT READ. The type fixes both. This rule reads the
-- type and the leaves, and never the nesting or the count between them. Measured on 8 September
-- 2026, each of these passes this rule:
--
--   `{"type":"Polygon","coordinates":[1,2]}`              `ring are not an array`
--   `{"type":"MultiPolygon","coordinates":[[1,2]]}`       the same
--   `{"type":"MultiPoint","coordinates":[1,2]}`           `not sufficiently nested`
--   `{"type":"LineString","coordinates":[1,2]}`           the same
--   `{"type":"Point","coordinates":[1]}`                  `Too few ordinates in GeoJSON`
--   `{"type":"Point","coordinates":[[1,2]]}`              the same, and over-nested
--   `{"type":"LineString","coordinates":[[1,2],[3,4,5]]}` stores `LINESTRING Z (1 2 0,3 4 5)`
--   `{"type":"Point","coordinates":[1,2,3,4]}`            stores `POINT Z (1 2 3)`
--   `{"type":"LineString","coordinates":[[1,2]]}`         stores a line of one vertex
--
-- THE LAST THREE STORE A ROW, AND THE FIRST OF THEM INVENTS A NUMBER. A ragged list makes
-- PostGIS write a zero for an ordinate nobody wrote. Every leaf of that list is a number, so
-- the fifth test reads it and passes it. The fault arrives by the count of the ordinates, which
-- no test here reads. The other two drop an ordinate and store a line of one vertex.
--
-- WHY THEY ARE NOT SHUT HERE. A depth rule and an arity rule are tables of six numbers, one row
-- for each type. They write a part of the GeoJSON standard into a CHECK. That is a second rule,
-- and it needs its own measurement. #127 closes the null, which is what a loader writes by
-- default. The `crs` member and the empty list are shut because neither needs such a table.
--
-- CONTENT SURVIVES THIS RULE, and three examples say what content is. A coordinate outside the
-- globe passes. An unclosed ring passes. `[1e30,1e30]` passes, and the number the store keeps is
-- not the number the act wrote.
--
-- `payload` IS NOT NULL, so the expression yields no NULL and needs no guard of its own. Every
-- branch is wrapped in coalesce, because a CHECK accepts a row when its expression is NULL. The
-- last two branches take `'[]'` for an absent list, and never a NULL from the path reader.
--
-- IT VALIDATES THE ROWS THAT STAND. No count of the acts is written here, because two sessions
-- write to that record and every count is stale within the hour. `pg_constraint.convalidated`
-- is the measurement that keeps: it is true for this rule, so every standing row passes it. A
-- database that holds a bad act refuses this file until the act is settled. That is wanted: the
-- orphan is the thing the rule exists for.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0003. node-pg-migrate keeps a ledger in the `migrations`
-- schema. An edit to a file already applied reaches no running database until `pnpm db:reset`.
-- 0003 stays the record of what the first schema was.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals ADD CONSTRAINT proposals_payload_geom
  CHECK (NOT (payload ? 'geom')
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

RESET ROLE;
