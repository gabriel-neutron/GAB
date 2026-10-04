-- =============================================================================================
-- 0026 — a job has a kind, and storing a file starts no work                           ORDERED
--
-- STORING A PAGE STARTED WORK THAT NOTHING COULD FINISH. put_document queued one job for each
-- document that is not `manual`, the job had no kind, and no door ended a job as done. So the
-- operator who stores forty acts and needs five of them read held thirty-five jobs that stayed
-- `queued` for ever, and the runner could not tell an extraction from a mapping.
--
-- THE KIND IS A CLOSED LIST OF THREE WORDS. `store_only` is the record that a document entered
-- the door and nothing else. `extract_text` and `map_structured` are the two paths of P6, and
-- they are work. Only a work kind is ever queued, claimed, failed or completed.
--
-- THE 0004 BAN ON A DEFAULT KIND IS LIFTED BY THIS FILE, FOR ONE STATEMENT. The column is added
-- with a default so that the rows already there take `store_only`, and the default is dropped
-- in the next statement. The table then holds no default kind, so a writer that forgets the kind
-- is refused and never guessed for.
--
-- THE OLD ROWS TAKE `store_only` AND END `done`. No worker ever ran them, and an address-only row
-- of the v1 corpus has no bytes to extract. A `failed` or `running` row loses its state in this
-- backfill, and so does its failure text, because the data of this stack is disposable and a
-- row that no kind of work describes has no state worth keeping. Its claim columns stay as they
-- were. The hour it ended is the hour of this file.
--
-- A `store_only` ROW IS BORN `done` AND IS NEVER CLAIMED, so jobs_ended_was_claimed is amended
-- for that kind alone. The two work kinds keep the old rule: no work kind ends unclaimed. And
-- jobs_store_only_is_done says the other half: a `store_only` row is never `queued`, `running`
-- or `failed`, so no claim can ever take one.
--
-- ONE OPEN JOB OF A KIND FOR A DOCUMENT. The unique index refuses a second `queued` or `running`
-- row of one kind for one document. A finished row does not count, so a document can be
-- extracted again after the first extraction ended.
--
-- fail_job AND release_expired_claims ARE NOT TOUCHED. They keep their behaviour for the two work
-- kinds, and a `store_only` row is never `running`, so neither one can reach it.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE jobs
  ADD COLUMN kind text NOT NULL DEFAULT 'store_only'
  CONSTRAINT jobs_kind_word CHECK (kind IN ('store_only','extract_text','map_structured'));

ALTER TABLE jobs ALTER COLUMN kind DROP DEFAULT;

ALTER TABLE jobs DROP CONSTRAINT jobs_ended_was_claimed;
ALTER TABLE jobs ADD CONSTRAINT jobs_ended_was_claimed
  CHECK (status = 'queued' OR claimed_at IS NOT NULL OR kind = 'store_only');

UPDATE jobs
   SET status         = 'done',
       failure_kind   = NULL,
       failure_reason = NULL,
       finished_at    = coalesce(finished_at, now()),
       updated_at     = now();

ALTER TABLE jobs ADD CONSTRAINT jobs_store_only_is_done
  CHECK (kind <> 'store_only' OR status = 'done');

CREATE UNIQUE INDEX jobs_one_open_per_kind
  ON jobs (document_id, kind) WHERE status IN ('queued','running');

RESET ROLE;
