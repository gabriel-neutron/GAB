-- =============================================================================================
-- 0036 — a reader stores where a claim stands in a page, and code reads the span again  ORDERED
--
-- NO AGENT READ A STORED DOCUMENT. Each proposal cost the operator tokens or time, and a model
-- that quoted a page could quote it wrong. A reading holds a page, two offsets and two enums, and
-- no quote: code reads the span again from the stored text.
--
-- ONE TABLE FOR EVERY READER. The first reader proposes the claim and names the proposal. The
-- second, blind reader names none, because it runs no proposal. A parser row and an OCR row come
-- with the comparison, and they carry the claim. reader_no and reader_kind are set by the door
-- from the job, and never by the caller.
--
-- THE OFFSETS ARE CODE POINTS IN THE STORED PAGE, and the page is named with its extractor set.
-- A page number alone is not unique: one document can hold two sets of text. The composite key
-- to document_text refuses a page that does not exist.
--
-- `adverse` IS FALSE WHEN NO READER SET IT. A reader can set the flag and never clear it, so
-- false means "this reader did not set it", and the column has a default.
--
-- `citation` IS A FIXED ROW HERE AND NOTHING MORE. It has no grant and no door. The comparison
-- writes it from the readings later, with its own door and its own write-once columns.
--
-- THE KIND `second_read` JOINS THE LIST, so a job of the second reader can exist. The CHECK was
-- read before this file: it holds three words, and no migration after it changed them.
--
-- BOTH TABLES ARE APPEND-ONLY. The triggers that refuse an update and a delete are in the
-- re-runnable files. No role holds a grant on either table.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE jobs DROP CONSTRAINT jobs_kind_word;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_word
  CHECK (kind IN ('store_only','extract_text','map_structured','second_read'));

CREATE TABLE claim_reading (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid
                      CONSTRAINT claim_reading_claim_fkey REFERENCES proposals(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  doc_id              doc_id NOT NULL
                      CONSTRAINT claim_reading_document_fkey REFERENCES documents(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  text_extractor      text NOT NULL CHECK (btrim(text_extractor, E' \t\n\r\f\v') <> ''),
  page                int NOT NULL CHECK (page >= 1),
  start               int NOT NULL CHECK (start >= 0),
  "end"               int NOT NULL,
  modality            text NOT NULL
                      CONSTRAINT claim_reading_modality_word
                      CHECK (modality IN ('enacts','asserts','attributes','alleges','denies')),
  adverse             boolean NOT NULL DEFAULT false,
  reader_no           smallint NOT NULL CHECK (reader_no IN (1, 2)),
  reader_kind         text NOT NULL CHECK (reader_kind IN ('llm','parser','ocr')),
  model_call_id       uuid
                      CONSTRAINT claim_reading_model_call_fkey REFERENCES model_call(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  input_form          text NOT NULL CHECK (btrim(input_form, E' \t\n\r\f\v') <> ''),
  reader_fingerprint  text NOT NULL CHECK (btrim(reader_fingerprint, E' \t\n\r\f\v') <> ''),
  job_id              uuid NOT NULL
                      CONSTRAINT claim_reading_job_fkey REFERENCES jobs(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  chunk_hash          text NOT NULL CHECK (chunk_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key     text NOT NULL CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_reading_span_order CHECK (start < "end"),
  CONSTRAINT claim_reading_page_fkey FOREIGN KEY (doc_id, text_extractor, page)
    REFERENCES document_text (document_id, extractor, page)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- A model reading names the call that made it. A parser and an OCR pass make no call.
  CONSTRAINT claim_reading_llm_has_call
    CHECK (reader_kind <> 'llm' OR model_call_id IS NOT NULL),
  -- The first model reader proposed the claim, and the second ran no proposal.
  CONSTRAINT claim_reading_llm_claim
    CHECK (reader_kind <> 'llm' OR ((reader_no = 1) = (claim_id IS NOT NULL)))
);

CREATE UNIQUE INDEX claim_reading_idempotency_key_uidx ON claim_reading (idempotency_key);
CREATE INDEX claim_reading_claim_idx ON claim_reading (claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX claim_reading_page_idx ON claim_reading (doc_id, page);
CREATE INDEX claim_reading_job_idx ON claim_reading (job_id);

CREATE TABLE citation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL
              CONSTRAINT citation_claim_fkey REFERENCES proposals(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  doc_id      doc_id NOT NULL
              CONSTRAINT citation_document_fkey REFERENCES documents(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  page        int NOT NULL CHECK (page >= 1),
  start       int NOT NULL CHECK (start >= 0),
  "end"       int NOT NULL,
  modality    text NOT NULL
              CONSTRAINT citation_modality_word
              CHECK (modality IN ('enacts','asserts','attributes','alleges','denies')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citation_span_order CHECK (start < "end")
);

CREATE INDEX citation_claim_idx ON citation (claim_id);

RESET ROLE;
