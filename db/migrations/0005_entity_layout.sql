-- =============================================================================================
-- 0005 — where the graph draws each entity                                             ORDERED
--
-- A POSITION IS PRESENTATION AND NOT DATA. It is derived from the record, no source holds it up,
-- and it is not an attribute value, so it stands outside the evidentiary table and attrs_valid
-- never sees one. The rule that every attribute carries a source does not reach it.
--
-- THE CASCADE RUNS OUT OF AN EVIDENTIARY TABLE INTO A DERIVED ONE, AND THAT IS THE SAFE
-- DIRECTION. A cascade the other way would destroy an evidentiary row for a caller that holds no
-- DELETE on it; this one destroys a drawing of a row that is already gone.
--
-- ONE RUN AT A TIME, AND THE TABLE HOLDS NO RUN IDENTIFIER. A position has a meaning only beside
-- the positions of the same run, so the door replaces the whole set in one act and never one row.
-- An entity with no row here is not a fault: it has no position until the next run.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- ======================================================================== entity_layout ======
CREATE TABLE entity_layout (
  -- The primary key is also the index the foreign key needs on this side.
  entity_id    uuid PRIMARY KEY
               CONSTRAINT entity_layout_entity_fkey REFERENCES entities(id)
               ON UPDATE RESTRICT ON DELETE CASCADE,
  x            double precision NOT NULL,
  y            double precision NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),

  -- NaN and an infinity are both writable in this type, and the canvas draws neither: a node
  -- with one takes the whole picture with it. NaN is the largest value here, so it fails the
  -- upper half of each pair, and an infinity fails the same half by equality.
  CONSTRAINT entity_layout_finite
    CHECK (x > '-infinity'::double precision AND x < 'infinity'::double precision
       AND y > '-infinity'::double precision AND y < 'infinity'::double precision)
);

RESET ROLE;
