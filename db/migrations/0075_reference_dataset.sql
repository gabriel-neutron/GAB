-- =============================================================================================
-- 0075 — the reference dataset, and the text set of a job                              ORDERED
--
-- A PUBLISHED DATASET CAN BE A REFERENCE (decisions.md S3, ADR 0012). The operator approves one
-- edition of one named dataset, in one act. The edition is a stored document. A row of a promoted
-- mapping that loads that edition passes the rules after the Doubt rule, with no second source.
-- The approval is written once, and no role updates or deletes it.
--
-- A TABLE OF A WORKBOOK IS A NAMED TEXT SET OF A DOCUMENT (decisions.md P5). A text set is a set of
-- pages of `document_text` under one extractor name, and the name holds the sheet, the filter and
-- the version of the reader. A job that maps or loads a table names its text set, so the reader
-- never takes "the newest set". NULL means the newest set, as before.
--
-- A MAPPING NAMES ITS PUBLISHER. The publisher of the table is the author of each loaded row. The
-- key is optional, because the mappings of an earlier build have none, and they keep the table
-- name as the author.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE reference_dataset (
  document_id  doc_id PRIMARY KEY
               CONSTRAINT reference_dataset_document_fkey REFERENCES documents(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  dataset      text NOT NULL
               CONSTRAINT reference_dataset_named CHECK (btrim(dataset, E' \t\n\r\f\v') <> ''),
  approved_by  text NOT NULL DEFAULT session_user,
  approved_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rule_config DROP CONSTRAINT rule_config_rule;
ALTER TABLE rule_config ADD CONSTRAINT rule_config_rule
  CHECK (rule IN ('impossible', 'doubt', 'reference_dataset', 'strong_sources', 'weak_sources'));
INSERT INTO rule_config (rule, version, settings) VALUES ('reference_dataset', 1, '{}');

ALTER TABLE jobs
  ADD COLUMN text_set text
      CONSTRAINT jobs_text_set_named CHECK (text_set IS NULL OR btrim(text_set, E' \t\n\r\f\v') <> ''),
  ADD CONSTRAINT jobs_text_set_kind
      CHECK (text_set IS NULL OR kind IN ('map_structured', 'load_mapped'));

ALTER TABLE proposals DROP CONSTRAINT proposals_map_document_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_map_document_shape
  CHECK (op <> 'map_document'
         OR (target_kind IS NULL
             AND cardinality(src) = 1
             AND model_call_id IS NOT NULL
             AND payload - 'table' - 'header_sig' - 'modality' - 'rows' - 'relations'
                 - 'publisher' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'table'), 'absent') = 'string'
             AND btrim(coalesce(payload->>'table', ''), E' \t\n\r\f\v') <> ''
             AND (NOT payload ? 'publisher'
                  OR (jsonb_typeof(payload->'publisher') = 'string'
                      AND btrim(payload->>'publisher', E' \t\n\r\f\v') <> ''))
             AND coalesce(payload->>'header_sig', '') ~ '^[0-9a-f]{64}$'
             AND coalesce(payload->>'modality', '')
                 IN ('enacts','asserts','attributes','alleges','denies')
             AND coalesce(jsonb_typeof(payload->'rows'), 'absent') = 'object'
             AND coalesce(jsonb_typeof(payload->'relations'), 'absent') = 'array'));

RESET ROLE;
