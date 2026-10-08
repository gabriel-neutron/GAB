-- =============================================================================================
-- 0058 — the job that rates a new author, and the approval of the reference set        ORDERED
--
-- A NEW AUTHOR NAME GETS A JOB BY ITSELF (ADR 0012, ticket 371). A name that no worker answer has
-- resolved reads as F. The worker reads the name with the known authors and the reference set,
-- and answers with a join or with a new letter from C to F. So a job of the new kind
-- `rate_author` holds a name and no document.
--
-- ONE JOB FOR ONE NAME. The unique index lets a name have one job that waits, runs, is done, or
-- ended on a refused answer. The refusal keeps its reason in the job, and the author stays F, so
-- the refusal is not asked again at each new act of that name. A job that failed by a fault (the
-- service, a missing setting) holds no refusal and leaves the name free: the next act of that name
-- asks again.
--
-- THE OPERATOR APPROVES THE REFERENCE SET. A reference author is stored first and is not an author
-- for any reader until its row in `reference_approval` exists. The approval is written once for
-- each author, with the role and the date.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE reference_approval (
  author_id    uuid PRIMARY KEY
               CONSTRAINT reference_approval_author_fkey REFERENCES author(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  approved_by  text NOT NULL DEFAULT session_user,
  approved_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs DROP CONSTRAINT jobs_kind_word;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_word
  CHECK (kind IN ('store_only','extract_text','map_structured','second_read','research_lead',
                  'load_mapped','rate_author'));

-- The shape of a lead and of a rating: a lead holds a text, a rating holds a name, and each of
-- them holds no document. Every other kind holds a document and neither.
ALTER TABLE jobs DROP CONSTRAINT jobs_lead_shape;
ALTER TABLE jobs
  ADD COLUMN author text
      CONSTRAINT jobs_author_form CHECK (author IS NULL OR (author <> '' AND author = name_key(author))),
  ADD CONSTRAINT jobs_lead_shape
      CHECK (CASE kind
               WHEN 'research_lead'
                 THEN document_id IS NULL AND lead IS NOT NULL AND lead_by IS NOT NULL
                      AND author IS NULL
               WHEN 'rate_author'
                 THEN document_id IS NULL AND lead IS NULL AND lead_by IS NULL
                      AND author IS NOT NULL
               ELSE document_id IS NOT NULL AND lead IS NULL AND lead_by IS NULL
                    AND author IS NULL
             END);

CREATE UNIQUE INDEX jobs_one_rating_per_author
  ON jobs (author)
  WHERE kind = 'rate_author'
    AND (status IN ('queued','running','done') OR (status = 'failed' AND refusal IS NOT NULL));

RESET ROLE;
