-- =============================================================================================
-- 0049 — a structured file is mapped by a proposal, and code loads its rows             ORDERED
--
-- A STRUCTURED FILE HAD NO PATH INTO THE RECORD. Its columns do not match the attribute contract,
-- and fitting them is judgement, so it is a proposal. A model reads the header and a few rows of
-- the table, and proposes how each column maps. The operator promotes the mapping, and code then
-- loads every row with no model.
--
-- THE OP `map_document` NAMES ONE DOCUMENT AND NO TARGET. Its payload is the mapping of one
-- table. The attribute map is under `rows`, and never at the top: the checks of the attribute
-- object read `payload->'attrs'`, and a map of key to column is not an attribute object.
--
-- A MAPPING NAMES THE CALL OF THE MODEL THAT MADE IT. Only the worker role has a model call, so
-- only the worker proposes a mapping. The rows of the load carry this call, because it is the
-- origin of the reading of each row.
--
-- THE PROMOTION QUEUES A LOAD AND WRITES NOTHING TO THE GRAPH. The job kind `load_mapped` names
-- its mapping in a new column, and only a job of that kind names one.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_op_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_op_check
  CHECK (op IN ('create_entity','update_attrs','update_entity','delete_entity',
                'create_relation','update_relation','delete_relation',
                'merge_entities','map_document'));

ALTER TABLE proposals DROP CONSTRAINT proposals_target_required;
ALTER TABLE proposals ADD CONSTRAINT proposals_target_required
  CHECK (op IN ('create_entity','create_relation','map_document') OR target_id IS NOT NULL);

ALTER TABLE proposals ADD CONSTRAINT proposals_map_document_shape
  CHECK (op <> 'map_document'
         OR (target_kind IS NULL
             AND cardinality(src) = 1
             AND model_call_id IS NOT NULL
             AND payload - 'table' - 'header_sig' - 'modality' - 'rows' - 'relations'
                 = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'table'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'table', ''), E' \t\n\r\f\v') <> ''
             AND coalesce(payload->>'header_sig', '') ~ '^[0-9a-f]{64}$'
             AND coalesce(payload->>'modality', '')
                 IN ('enacts','asserts','attributes','alleges','denies')
             AND coalesce(jsonb_typeof(payload->'rows'), 'absent') = 'object'
             AND coalesce(jsonb_typeof(payload->'relations'), 'absent') = 'array'));

ALTER TABLE jobs DROP CONSTRAINT jobs_kind_word;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_word
  CHECK (kind IN ('store_only','extract_text','map_structured','second_read','research_lead',
                  'load_mapped'));

ALTER TABLE jobs
  ADD COLUMN mapping uuid
      CONSTRAINT jobs_mapping_fkey REFERENCES proposals(id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT jobs_mapping_kind
      CHECK ((kind = 'load_mapped') = (mapping IS NOT NULL));

RESET ROLE;
