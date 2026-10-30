-- =============================================================================================
-- 0090 — a figure of one page is an act of its own                                     ORDERED
--
-- A FIGURE THAT ONE PAGE STATES IS ONE ACT OF THE REVIEW QUEUE (ADR 0031). Some figures have no
-- table: a ministry publishes the monthly Urals price as one short announcement for each month.
-- The research agent proposes such a figure as the act `create_observation`. The act is a unit of
-- its own. Its promotion writes one row of `observation`, and its rejection writes none.
--
-- THE PAYLOAD HOLDS THE WORDS OF THE FIGURE AND NOTHING ELSE: the measure, the value, the unit, the
-- period, the reporter, the method and the publisher, and an optional partner and subject. The
-- reporter and the partner are codes of `area_code`, and the door checks them. The act cites one
-- document, and its one citation gives the span of the figure (P9).
--
-- A FIGURE OF AN ACT HAS NO LOAD JOB. `mapping_id` names the act that made the figure, where a
-- loaded figure names its mapping, so `job_id` is null for such a figure.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_op_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_op_check
  CHECK (op IN ('create_entity','update_attrs','update_entity','delete_entity',
                'create_relation','update_relation','delete_relation',
                'merge_entities','undo_merge','map_document','create_observation'));

ALTER TABLE proposals DROP CONSTRAINT proposals_target_required;
ALTER TABLE proposals ADD CONSTRAINT proposals_target_required
  CHECK (op IN ('create_entity','create_relation','map_document','create_observation')
         OR target_id IS NOT NULL);

ALTER TABLE proposals ADD CONSTRAINT proposals_create_observation_shape
  CHECK (op <> 'create_observation'
         OR (target_kind IS NULL
             AND cardinality(src) = 1
             AND cardinality(names) = 0
             AND payload - 'measure' - 'value' - 'unit' - 'period' - 'reporter' - 'partner'
                 - 'method' - 'publisher' - 'subject_id' = '{}'::jsonb
             AND coalesce(jsonb_typeof(payload->'measure'), 'absent') = 'string'
             AND payload->>'measure' ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
             AND char_length(payload->>'measure') <= 100
             AND coalesce(jsonb_typeof(payload->'value'), 'absent') = 'number'
             AND coalesce(jsonb_typeof(payload->'unit'), 'absent') = 'string'
             AND btrim(payload->>'unit', E' \t\n\r\f\v') = payload->>'unit'
             AND payload->>'unit' <> '' AND char_length(payload->>'unit') <= 40
             AND coalesce(jsonb_typeof(payload->'period'), 'absent') = 'string'
             AND payload->>'period'
                 ~ '^[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4]|-W(0[1-9]|[1-4][0-9]|5[0-3]))?$'
             AND coalesce(jsonb_typeof(payload->'reporter'), 'absent') = 'string'
             AND payload->>'reporter' ~ '^[A-Z][A-Z0-9_]{1,19}$'
             AND (NOT payload ? 'partner'
                  OR (jsonb_typeof(payload->'partner') = 'string'
                      AND payload->>'partner' ~ '^[A-Z][A-Z0-9_]{1,19}$'))
             AND coalesce(jsonb_typeof(payload->'method'), 'absent') = 'string'
             AND btrim(payload->>'method', E' \t\n\r\f\v') <> ''
             AND char_length(payload->>'method') <= 200
             AND coalesce(jsonb_typeof(payload->'publisher'), 'absent') = 'string'
             AND btrim(payload->>'publisher', E' \t\n\r\f\v') <> ''
             AND char_length(payload->>'publisher') <= 200
             AND (NOT payload ? 'subject_id'
                  OR (jsonb_typeof(payload->'subject_id') = 'string'
                      AND pg_input_is_valid(payload->>'subject_id', 'uuid')))));

ALTER TABLE observation ALTER COLUMN job_id DROP NOT NULL;
COMMENT ON COLUMN observation.job_id IS
  'The load that wrote the figure. Null for a figure that a create_observation act wrote (ADR 0031).';
COMMENT ON COLUMN observation.mapping_id IS
  'The promoted map_document act whose load wrote the figure, or the promoted create_observation act that wrote it (ADR 0031).';

RESET ROLE;
