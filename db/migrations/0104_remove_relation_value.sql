-- =============================================================================================
-- 0104 — a value also leaves an attribute of a relation                                  ORDERED
--
-- A SOURCE CAN STATE A VALUE FOR ALL THE RELATIONS OF A PARTY, AND NOT FOR EACH ONE. A press
-- release of the Treasury gives the items of all the deliveries of a supplier, and ten relations
-- `supplies_items_to` each took them as their own value. The relation stays, and the value must
-- leave it. An `update_attrs` act on a relation with `"remove_value": true` now takes its one
-- value out of that one key of the relation. A relation can hold any key, so the shape does not
-- name the keys. The step of the promotion refuses a key or a value that the relation does not
-- hold. The shape for an entity does not change.
--
-- No row of the record changes: the check accepts each act that it accepted before.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The shape of a removal of one value: one key, and one scalar value that leaves it. For an
-- entity, the key is a list of names or a history. A check takes no subquery, so a function holds
-- the rule.
CREATE OR REPLACE FUNCTION remove_value_valid(p_payload jsonb, p_kind text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
  SELECT coalesce(jsonb_typeof(p_payload->'attrs'), 'absent') = 'object'
     AND p_payload - 'attrs' - 'remove_value' = '{}'::jsonb
     AND p_payload->'remove_value' = 'true'::jsonb
     AND (SELECT count(*) FROM jsonb_object_keys(p_payload->'attrs')) = 1
     AND coalesce((SELECT (p_kind = 'relation'
                           OR k IN ('aliases', 'former_names', 'flag_history', 'mmsi_history',
                                    'call_sign'))
                          AND jsonb_typeof(p_payload->'attrs'->k->'v')
                              NOT IN ('array', 'object', 'null')
                     FROM jsonb_object_keys(p_payload->'attrs') AS k), false)
$$;

ALTER TABLE proposals DROP CONSTRAINT proposals_remove_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_remove_value_shape
  CHECK (NOT payload ? 'remove_value'
         OR (op = 'update_attrs' AND target_kind IS NOT NULL
             AND target_kind IN ('entity', 'relation')
             AND remove_value_valid(payload, target_kind)));

DROP FUNCTION remove_value_valid(jsonb);

RESET ROLE;
