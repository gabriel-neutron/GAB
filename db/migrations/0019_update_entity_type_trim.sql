-- =============================================================================================
-- 0019 — the type of an update_entity is trimmed of each whitespace, like its label   ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_entity_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_entity_shape
  CHECK (op <> 'update_entity'
         OR (target_kind IS NOT NULL AND target_kind = 'entity'
             AND payload - 'label' - 'type' = '{}'::jsonb
             AND (payload ? 'label' OR payload ? 'type')
             AND (NOT payload ? 'label'
                  OR (coalesce(jsonb_typeof(payload->'label'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'label', ''), E' \t\n\r\f\v') <> ''))
             AND (NOT payload ? 'type'
                  OR (coalesce(jsonb_typeof(payload->'type'), 'absent') = 'string'
                      AND btrim(coalesce(payload->>'type', ''), E' \t\n\r\f\v') <> ''))));

RESET ROLE;
