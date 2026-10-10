-- =============================================================================================
-- 0069 — the operator merges two entities, and can undo the merge (M12)                 ORDERED
--
-- A MERGE IS AN ACT OF THE LEDGER. The act targets the survivor and names the absorbed entity.
-- Its snapshot is the full copy of what it changed: the absorbed row, each of its relations, the
-- values of the survivor that it changed, and the aliases that it moved. An undo is an act too:
-- it targets the absorbed entity again and names the survivor. So the ledger is the log of each
-- merge and each undo, with who decided it and its origin.
--
-- THE ALIAS IS A STATE, AND NOT A LOG. `entity_alias` holds one row for each absorbed entity of
-- a merge that stands, with the survivor of today. An undo deletes the row, and the ledger keeps
-- the history. A survivor with an alias cannot be deleted, so an old identifier always resolves.
--
-- No pending act of these two kinds can stand in a record: no door proposed one before this
-- file, so the new rule on their shape holds for each row that the table holds.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_op_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_op_check
  CHECK (op IN ('create_entity','update_attrs','update_entity','delete_entity',
                'create_relation','update_relation','delete_relation',
                'merge_entities','undo_merge','map_document'));

-- A merge and its undo each name one entity beside their target, and carry no value.
ALTER TABLE proposals ADD CONSTRAINT proposals_merge_shape
  CHECK (op NOT IN ('merge_entities','undo_merge')
         OR (target_kind IS NOT NULL AND target_kind = 'entity'
             AND cardinality(names) = 1
             AND names[1] IS DISTINCT FROM target_id
             AND payload = '{}'::jsonb));

ALTER TABLE proposals DROP CONSTRAINT proposals_prior_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_prior_value_shape
  CHECK (prior_value IS NULL
         OR (op IN ('update_attrs','update_relation') AND attrs_valid(prior_value))
         OR (op IN ('update_entity','delete_entity','delete_relation',
                    'merge_entities','undo_merge')
             AND coalesce(jsonb_typeof(prior_value),'absent') = 'object'));

CREATE TABLE entity_alias (
  -- No foreign key: the absorbed row is gone while the alias stands.
  absorbed_id  uuid PRIMARY KEY,
  survivor_id  uuid NOT NULL
               CONSTRAINT entity_alias_survivor_fkey REFERENCES entities(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- The merge that absorbed the entity. Its snapshot holds the copy that an undo restores.
  merged_by    uuid NOT NULL
               CONSTRAINT entity_alias_merged_by_key UNIQUE
               CONSTRAINT entity_alias_merged_by_fkey REFERENCES proposals(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT entity_alias_not_self CHECK (absorbed_id <> survivor_id)
);

-- The foreign key builds no index on this side, and a delete of an entity probes it.
CREATE INDEX entity_alias_survivor_idx ON entity_alias (survivor_id);

RESET ROLE;
