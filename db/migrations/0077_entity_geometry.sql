-- =============================================================================================
-- 0077 — the act that updates an entity can set its geometry                           ORDERED
--
-- AN ENTITY THAT EXISTS CAN GET A PLACE, OR A BETTER ONE (decisions.md S3, P4). The act
-- update_entity names a name, a type, a geometry, or any of the three. The old geometry stays in
-- the prior value of the accepted act, so the history keeps it. The promotion replaces the source
-- list of the row, as it does for a name (S2).
--
-- A loaded row that finds an entity can propose this act, so the key that found the entity is
-- allowed on it too. The shape of the geometry is held by proposals_payload_geom and
-- proposals_payload_geom_position, which read each act that has the key.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_entity_shape
  CHECK (op <> 'update_entity'
         OR (target_kind IS NOT NULL AND target_kind = 'entity'
             AND payload - 'label' - 'type' - 'geom' = '{}'::jsonb
             AND (payload ? 'label' OR payload ? 'type' OR payload ? 'geom')
             AND (NOT payload ? 'label'
                  OR (coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''))
             AND (NOT payload ? 'type'
                  OR (coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'type', ''), E' \t\n\r\f\v') <> ''))));

ALTER TABLE proposals DROP CONSTRAINT proposals_found_by_shape;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_found_by_shape
      CHECK (found_by IS NULL
             OR (op IN ('update_attrs', 'update_entity')
                 AND btrim(found_by, E' \t\n\r\f\v') <> ''));

RESET ROLE;
