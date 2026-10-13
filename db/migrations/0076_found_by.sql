-- =============================================================================================
-- 0076 — the key that found the entity of a loaded row                                 ORDERED
--
-- A LOADED ROW FINDS ITS ENTITY BY A KEY (ADR 0012, decisions.md S3). The loader tries the
-- identifiers first and the name last. A row that finds an entity by its name only can name
-- another entity of the same name, so its facts wait for the operator as a doubt. The act keeps
-- the key that found its target, and the Doubt rule reads it. Only an update of the attributes of
-- a found entity has such a key, and only the batch door of a machine writes it.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals
  ADD COLUMN found_by text
      CONSTRAINT proposals_found_by_shape
      CHECK (found_by IS NULL
             OR (op = 'update_attrs' AND btrim(found_by, E' \t\n\r\f\v') <> ''));

RESET ROLE;
