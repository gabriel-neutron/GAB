-- =============================================================================================
-- 0101 — the corrections of an AI reviewer: a value, a name, a title, a source, an end   ORDERED
--
-- THE CORRECTIONS OF 2026-11-27 FOUND FIVE GAPS (ADR 0038). Each correction is a new act that an
-- AI reviewer signs with a reason and a cited passage, and the ledger keeps the act before it.
--
-- A VALUE LEAVES A LIST. An `update_attrs` act with `"remove_value": true` takes the value of its
-- one key out of the list of the entity. The act holds the value that leaves, not the list, so the
-- envelope of the attribute and the rule "src is within the act" stay true. Only the door of a
-- reviewer writes it.
--
-- A SOURCE LEAVES A RELATION. An `update_relation` act with `"remove_source": "<document>"` takes
-- one document out of the row sources. Its copy is the list before.
--
-- AN END DATE CAN NAME ITS RULE. An `update_relation` act with `valid_to` can carry
-- `"end_rule": "day_before_entry_into_force"`: the end is the day before the entry into force
-- that one cited passage gives.
--
-- A TITLE OF A DOCUMENT HAS A HISTORY. document_title_change keeps each change: the title before,
-- the title after, who, when, why and the cited passage. A row is never changed or deleted.
--
-- No row of the record changes: no act of these forms exists before this file.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_update_names_attrs;
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (op = 'update_relation'
             AND (payload ? 'valid_to' OR payload ? 'type' OR payload ? 'valid_from'
                  OR payload ? 'add_source' OR payload ? 'remove_source'))
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

ALTER TABLE proposals DROP CONSTRAINT proposals_close_relation_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_close_relation_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'valid_to'
         OR (payload - 'valid_to' - 'end_rule' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'valid_to'), 'absent') = 'string'
             AND coalesce(payload->>'valid_to', '') ~ '^\d{4}-\d{2}-\d{2}$'
             AND pg_input_is_valid(coalesce(payload->>'valid_to', ''), 'date')
             AND (NOT payload ? 'end_rule'
                  OR payload->'end_rule' = '"day_before_entry_into_force"'::jsonb)));

ALTER TABLE proposals ADD CONSTRAINT proposals_remove_source_shape
  CHECK (op <> 'update_relation'
         OR NOT payload ? 'remove_source'
         OR (payload - 'remove_source' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'remove_source'), 'absent') = 'string'));

-- The shape of a removal of one value: one key of a list, and one scalar value that leaves it. A
-- check takes no subquery, so a function holds the rule.
CREATE OR REPLACE FUNCTION remove_value_valid(p_payload jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
  SELECT coalesce(jsonb_typeof(p_payload->'attrs'), 'absent') = 'object'
     AND p_payload - 'attrs' - 'remove_value' = '{}'::jsonb
     AND p_payload->'remove_value' = 'true'::jsonb
     AND (SELECT count(*) FROM jsonb_object_keys(p_payload->'attrs')) = 1
     AND coalesce((SELECT k IN ('aliases', 'former_names', 'flag_history', 'mmsi_history', 'call_sign')
                          AND jsonb_typeof(p_payload->'attrs'->k->'v')
                              NOT IN ('array', 'object', 'null')
                     FROM jsonb_object_keys(p_payload->'attrs') AS k), false)
$$;

ALTER TABLE proposals ADD CONSTRAINT proposals_remove_value_shape
  CHECK (NOT payload ? 'remove_value'
         OR (op = 'update_attrs' AND target_kind = 'entity' AND remove_value_valid(payload)));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR ((op = 'update_attrs'
              OR (op = 'update_relation' AND NOT payload ? 'valid_to' AND NOT payload ? 'type'
                  AND NOT payload ? 'valid_from' AND NOT payload ? 'add_source'
                  AND NOT payload ? 'remove_source'))
             AND attrs_valid(prior_value))
         OR (op = 'update_relation' AND payload ? 'valid_to'
             AND prior_value - 'valid_to' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_to'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'valid_from'
             AND prior_value - 'valid_from' - 'sources' = '{}'::jsonb
             AND prior_value ? 'valid_from'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND payload ? 'type'
             AND prior_value - 'type' - 'sources' = '{}'::jsonb
             AND prior_value ? 'type'
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op = 'update_relation' AND (payload ? 'add_source' OR payload ? 'remove_source')
             AND prior_value - 'sources' = '{}'::jsonb
             AND coalesce(jsonb_typeof(prior_value->'sources'), 'absent') = 'array')
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge','remove_act')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

CREATE TABLE IF NOT EXISTS document_title_change (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id doc_id NOT NULL REFERENCES documents (id),
  before      text NOT NULL,
  after       text NOT NULL CHECK (btrim(after, E' \t\n\r\f\v') <> ''),
  decided_by  text NOT NULL CHECK (btrim(decided_by) <> ''),
  -- NULL for the command that reads the stored bytes again, which cites no passage.
  origin      text,
  reason      text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 1000),
  citation    jsonb,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (before <> after),
  CHECK ((origin IS NULL) = (reason IS NULL) AND (reason IS NULL) = (citation IS NULL))
);

RESET ROLE;
