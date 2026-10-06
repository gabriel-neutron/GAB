-- =============================================================================================
-- 0038 — code checks each span and each identity, and a model writes no result       ORDERED
--
-- ONE EXTRACTOR CAN MISREAD A QUOTE OR MATCH THE WRONG VESSEL, AND NOTHING IN CODE CHECKED IT.
-- The usual error is a misread span, a hedged sentence read as a fact, or a name shared by two
-- vessels. This file adds the tables that the check door writes and the columns it reads. No role
-- holds a grant on a new table: the one door that writes a check result takes no result argument.
--
-- A NEW WORK KIND, `evidence_check`. It runs after the two readers of its document, and it asks
-- no model.
--
-- A PARSER ROW AND AN OCR ROW CARRY THE CLAIM. They come from code during the check job, so they
-- know the claim they read. A parser row also holds the fields it parsed and the effect of the act.
--
-- A CITATION NAMES ITS TEXT SET. A page number alone is not unique: one document can hold two
-- sets of text. The table holds no row yet, because no door wrote one before this file, so the new
-- column is NOT NULL at once. A row that existed would stop this file, and lose nothing.
--
-- THE MODEL CALL RECORDS ITS MINIMISER AND THE PERSONAL CATEGORIES THAT THE PROMPT STILL HELD.
-- A call made before this file ran no minimiser, so its row says `none` and holds no category.
-- The defaults then go, so the door must give both values for each new call.
--
-- THE WORD LISTS ARE TABLES WITH A VERSION, AND THEIR ROWS ARE SEED ROWS. A new list version is
-- new rows with a higher version, so an older check row still names the list it read.
--
-- THE ADVERSE PREDICATE LIST IS CLOSED FOR EACH SUBJECT KIND. The CHECK holds the closed list, so
-- a loader cannot store a word outside it. A military unit is a body, so it takes the list of a
-- company. A reader that flags a claim as adverse names no act, so its row holds the one marker
-- `reader_adverse`, and never a word of the closed list.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE jobs DROP CONSTRAINT jobs_kind_word;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_word
  CHECK (kind IN ('store_only','extract_text','map_structured','second_read','evidence_check'));

-- ------------------------------------------------------------------------- the readings ---
ALTER TABLE claim_reading
  ADD COLUMN model_family text
      CHECK (model_family IS NULL OR btrim(model_family, E' \t\n\r\f\v') <> ''),
  ADD COLUMN parsed jsonb
      CHECK (parsed IS NULL OR jsonb_typeof(parsed) = 'object'),
  ADD COLUMN act_effect text
      CHECK (act_effect IS NULL OR act_effect IN ('insert','replace','delete'));

ALTER TABLE claim_reading
  ADD CONSTRAINT claim_reading_code_claim
      CHECK (reader_kind = 'llm' OR claim_id IS NOT NULL),
  ADD CONSTRAINT claim_reading_parser_fields
      CHECK ((reader_kind = 'parser') = (parsed IS NOT NULL AND act_effect IS NOT NULL)),
  ADD CONSTRAINT claim_reading_code_has_no_call
      CHECK (reader_kind = 'llm' OR (model_call_id IS NULL AND model_family IS NULL));

CREATE INDEX claim_reading_claim_doc_idx ON claim_reading (claim_id, doc_id)
  WHERE claim_id IS NOT NULL;

-- ------------------------------------------------------------------------- the citation ---
ALTER TABLE citation ADD COLUMN text_extractor text NOT NULL;
ALTER TABLE citation
  ADD CONSTRAINT citation_page_fkey FOREIGN KEY (doc_id, text_extractor, page)
    REFERENCES document_text (document_id, extractor, page)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE UNIQUE INDEX citation_span_uidx
  ON citation (claim_id, doc_id, text_extractor, page, start, "end", modality);

-- ------------------------------------------------------------------- the check results ---
CREATE TABLE citation_check (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citation_id      uuid NOT NULL
                   CONSTRAINT citation_check_citation_fkey REFERENCES citation(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  claim_id         uuid NOT NULL
                   CONSTRAINT citation_check_claim_fkey REFERENCES proposals(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  doc_id           doc_id NOT NULL
                   CONSTRAINT citation_check_document_fkey REFERENCES documents(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  job_id           uuid NOT NULL
                   CONSTRAINT citation_check_job_fkey REFERENCES jobs(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  span_result      text NOT NULL CHECK (span_result IN ('pass','fail','not_in_ocr')),
  support          text NOT NULL CHECK (support IN ('value','name_only','none')),
  counts           boolean NOT NULL,
  hidden_text      boolean NOT NULL,
  window_run       boolean NOT NULL,
  negation         boolean NOT NULL,
  attribution      boolean NOT NULL,
  allegation       boolean NOT NULL,
  denial           boolean NOT NULL,
  hedge            boolean NOT NULL,
  future           boolean NOT NULL,
  conditional      boolean NOT NULL,
  question         boolean NOT NULL,
  court_act        boolean NOT NULL,
  identity         text NOT NULL
                   CHECK (identity IN ('pass','fail','lead','pending','not_needed')),
  ocr              boolean NOT NULL,
  -- The value before the family probe. The view of the current row adds the probe state.
  same_family      text NOT NULL CHECK (same_family IN ('true','false','unknown')),
  -- Each key is a field of the claim, and each value is the one reason it is held.
  held             jsonb NOT NULL
                   CHECK (jsonb_typeof(held) = 'object'
                          AND NOT jsonb_path_exists(held,
                            '$.* ? (!(@ == "reader_disagreement" || @ == "modality_exceeds_window"
                                     || @ == "no_second_reading" || @ == "identity_pending"
                                     || @ == "unreadable" || @ == "check_not_run"
                                     || @ == "absence_unproven" || @ == "vch_conflict"))')),
  reading_ids      uuid[] NOT NULL,
  list_version     int NOT NULL CHECK (list_version >= 0),
  probe_run_id     uuid,
  idempotency_key  text NOT NULL CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX citation_check_idempotency_key_uidx ON citation_check (idempotency_key);
CREATE INDEX citation_check_citation_idx ON citation_check (citation_id, created_at DESC, id);
CREATE INDEX citation_check_claim_idx ON citation_check (claim_id);

-- ------------------------------------------------------------------------ the family probe ---
CREATE TABLE family_probe_run (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_set_version  text NOT NULL CHECK (btrim(prompt_set_version, E' \t\n\r\f\v') <> ''),
  model_a             text NOT NULL CHECK (btrim(model_a, E' \t\n\r\f\v') <> ''),
  model_b             text NOT NULL CHECK (btrim(model_b, E' \t\n\r\f\v') <> ''),
  prompts             int NOT NULL CHECK (prompts > 0),
  matches             int NOT NULL CHECK (matches >= 0),
  threshold           numeric CHECK (threshold IS NULL OR threshold > 0),
  passed              boolean NOT NULL,
  run_at              timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT family_probe_run_matches CHECK (matches <= prompts),
  -- With no threshold, no probe passes.
  CONSTRAINT family_probe_run_threshold CHECK (threshold IS NOT NULL OR NOT passed)
);

CREATE INDEX family_probe_run_at_idx ON family_probe_run (run_at DESC);

-- -------------------------------------------------------------------------- the word lists ---
CREATE TABLE evidence_word (
  version   int NOT NULL CHECK (version >= 1),
  lang      text NOT NULL CHECK (lang IN ('eng','rus','ukr')),
  cue_kind  text NOT NULL
            CHECK (cue_kind IN ('negation','attribution','allegation','denial','hedge','future',
                                'conditional','question','absence')),
  word      text NOT NULL CHECK (word = lower(btrim(word)) AND word <> ''),
  PRIMARY KEY (version, lang, cue_kind, word)
);

CREATE TABLE court_act_cue (
  version  int NOT NULL CHECK (version >= 1),
  lang     text NOT NULL CHECK (lang IN ('eng','rus','ukr')),
  cue      text NOT NULL CHECK (cue = lower(btrim(cue)) AND cue <> ''),
  PRIMARY KEY (version, lang, cue)
);

CREATE TABLE strong_id_kind (
  version  int NOT NULL CHECK (version >= 1),
  -- An attribute key of a person that is one strong identifier by itself.
  kind     text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]*$'),
  PRIMARY KEY (version, kind)
);

-- -------------------------------------------------------------------- the adverse predicate ---
CREATE TABLE adverse_predicate_rule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id       uuid NOT NULL,
  source_file   text NOT NULL CHECK (btrim(source_file, E' \t\n\r\f\v') <> ''),
  loaded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  row_kind      text NOT NULL CHECK (row_kind IN ('keyword','key')),
  subject_kind  text NOT NULL CHECK (subject_kind IN ('company','person','vessel','unit')),
  predicate     text NOT NULL,
  class         text NOT NULL
                CHECK (class IN ('official_act','attributed','adverse_allegation')),
  lang          text CHECK (lang IS NULL OR lang IN ('eng','rus','ukr')),
  keyword       text CHECK (keyword IS NULL OR (keyword = lower(btrim(keyword)) AND keyword <> '')),
  key           text CHECK (key IS NULL OR key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT adverse_predicate_rule_closed_list CHECK (
    CASE subject_kind
      WHEN 'vessel' THEN predicate IN ('sanctions_evasion','shadow_fleet','false_flag',
                                       'belligerent_listing')
      WHEN 'person' THEN predicate IN ('sanctions_evasion','supply_to_belligerent','fraud',
                                       'corruption','war_crime','false_flag','named_crime')
      ELSE predicate IN ('sanctions_evasion','supply_to_belligerent','fraud','corruption',
                         'war_crime','false_flag')
    END),
  CONSTRAINT adverse_predicate_rule_shape CHECK (
    (row_kind = 'keyword' AND lang IS NOT NULL AND keyword IS NOT NULL AND key IS NULL)
    OR (row_kind = 'key' AND key IS NOT NULL AND lang IS NULL AND keyword IS NULL))
);

CREATE INDEX adverse_predicate_rule_load_idx ON adverse_predicate_rule (loaded_at DESC, load_id);

CREATE TABLE adverse_predicate (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id         uuid NOT NULL
                   CONSTRAINT adverse_predicate_claim_fkey REFERENCES proposals(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- A party that the record holds is named by its entity. A party that the claim itself creates,
  -- or that code found only as a label, is named by its label.
  party_entity_id  uuid
                   CONSTRAINT adverse_predicate_party_fkey REFERENCES entities(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  party_label      text NOT NULL CHECK (btrim(party_label, E' \t\n\r\f\v') <> ''),
  party_kind       text NOT NULL CHECK (party_kind IN ('person','company')),
  predicate        text NOT NULL,
  class            text NOT NULL
                   CHECK (class IN ('official_act','attributed','adverse_allegation')),
  set_by           text NOT NULL CHECK (set_by IN ('code','reader')),
  rule_id          uuid
                   CONSTRAINT adverse_predicate_rule_fkey REFERENCES adverse_predicate_rule(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  set_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT adverse_predicate_word CHECK (
    predicate IN ('sanctions_evasion','supply_to_belligerent','fraud','corruption','war_crime',
                  'false_flag','named_crime','shadow_fleet','belligerent_listing')
    OR (set_by = 'reader' AND predicate = 'reader_adverse')),
  CONSTRAINT adverse_predicate_code_has_rule CHECK ((set_by = 'code') = (rule_id IS NOT NULL))
);

CREATE UNIQUE INDEX adverse_predicate_once_uidx
  ON adverse_predicate (claim_id, lower(party_label), predicate, set_by);

-- -------------------------------------------------------------------------- the model call ---
ALTER TABLE model_call
  ADD COLUMN minimiser text NOT NULL DEFAULT 'none'
      CHECK (btrim(minimiser, E' \t\n\r\f\v') <> ''),
  ADD COLUMN personal_categories text[] NOT NULL DEFAULT '{}'
      CONSTRAINT model_call_personal_categories_word
      CHECK (personal_categories <@ ARRAY['date_of_birth','address','identity_number','phone',
                                          'email']::text[]);

ALTER TABLE model_call ALTER COLUMN minimiser DROP DEFAULT;
ALTER TABLE model_call ALTER COLUMN personal_categories DROP DEFAULT;

RESET ROLE;
