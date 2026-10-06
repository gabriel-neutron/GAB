-- =============================================================================================
-- 0046 — a lead is a job with a text and no document                                   ORDERED
--
-- THE OPERATOR GIVES A LEAD, AND AN INTERNAL AI FINDS THE SOURCES. A lead is a short text, for
-- example "company X and its vessels". The worker searches, fetches and stores pages for it, and
-- queues the extraction of each page that it stores. So a job of this kind holds a text and no
-- document: the documents come from the job and do not start it.
--
-- ONLY A LEAD HAS NO DOCUMENT, AND ONLY A LEAD HAS A TEXT. Every other kind keeps its document, so
-- a work job that names nothing stays impossible. The role that started the lead is kept with it,
-- because the operator and the research AI can both start one.
--
-- THE TEXT IS PRIVATE. It can name a person or a company before any source supports it. The grants
-- in the re-runnable files keep it from the public read and from the worker role, which receives
-- the text of the one lead that it claims and no other.
--
-- A LEAD KEEPS THE DOCUMENTS THAT IT STORED. One row links the job and one document, so the
-- operator sees what each lead found. A document that the lead met again is not added: the agent
-- does not fetch a page that is already stored.
--
-- The CHECK of the kinds was read before this file: 0036 holds five words, and no migration after
-- it changed them.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE jobs DROP CONSTRAINT jobs_kind_word;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_word
  CHECK (kind IN ('store_only','extract_text','map_structured','second_read','research_lead'));

-- The domain of a document identifier refuses NULL, so the column takes plain text. The foreign
-- key still holds each value that is present to a stored document. The job view reads the column,
-- so the view goes first, and the re-runnable files make it again.
DROP VIEW IF EXISTS api.job;

ALTER TABLE jobs
  ALTER COLUMN document_id TYPE text,
  ALTER COLUMN document_id DROP NOT NULL,
  ADD COLUMN lead text
      CONSTRAINT jobs_lead_text CHECK (lead IS NULL OR (btrim(lead, E' \t\n\r\f\v') <> ''
                                                        AND char_length(lead) <= 2000)),
  ADD COLUMN lead_by text,
  ADD CONSTRAINT jobs_lead_shape
      CHECK (CASE WHEN kind = 'research_lead'
                  THEN document_id IS NULL AND lead IS NOT NULL AND lead_by IS NOT NULL
                  ELSE document_id IS NOT NULL AND lead IS NULL AND lead_by IS NULL END);

CREATE TABLE lead_document (
  job_id      uuid NOT NULL
              CONSTRAINT lead_document_job_fkey REFERENCES jobs(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  document_id doc_id NOT NULL
              CONSTRAINT lead_document_document_fkey REFERENCES documents(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, document_id)
);

-- A foreign key builds no index on the referencing side, and ON DELETE RESTRICT probes this side
-- on every delete of a document.
CREATE INDEX lead_document_document_idx ON lead_document (document_id);

RESET ROLE;
