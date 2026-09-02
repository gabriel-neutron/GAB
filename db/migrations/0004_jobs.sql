-- =============================================================================================
-- 0004 — the job queue                                                                 ORDERED
--
-- T5: a job table with locking replaces NATS. One row is one unit of work behind the ingestion
-- door, taken with SELECT ... FOR UPDATE SKIP LOCKED, so many workers share one queue and no
-- two of them hold the same row.
--
-- THE ROW CARRIES NO KIND COLUMN. P6 puts a text path and a structured path behind the door,
-- and no rule says which file takes which path. A kind written here would settle that in a
-- default value, and the worker that routes is the one that earns the column.
--
-- THE ROW HOLDS THE HISTORY OF A RETRY AND IT RUNS NONE. #25 proposes three retries on a
-- network failure, one retry on a rejected proposal with the validation error fed back, then
-- `failed` with the reason stored. THAT RULE IS NOT DECIDED, so no number is written here and
-- nothing counts down: the columns below can carry that history on the day the operator settles
-- it. The per-job token cap of the same ticket is proposed and not decided either, and it is
-- absent for the same reason.
--
-- THE ROW HOLDS THE COUNTS AND THE LAST FAILURE, AND NEVER THE WHOLE HISTORY. One reason column
-- is overwritten by the next failure, and no column holds the hour of a try, so the growing wait
-- that #25 proposes is not computable from this table. A row per attempt is the shape that holds
-- all of it, and it is the shape of the change that retries.
--
-- A CLAIM IS NEVER RELEASED, SO THE QUEUE IS AT MOST ONCE. claim_job moves a row to `running`,
-- and no door moves one back. A worker that stops between the claim and the work leaves the row
-- there for ever, so no role holds the claim door until the door that releases one exists.
--
-- A LOST CLAIM SPENDS ITS ATTEMPT. The claim counts the attempt at the hour it takes the row,
-- and nothing rewrites a count that is already written, so `attempts` counts what was taken and
-- never what was tried. Who releases a lost claim is on the tracker with #25.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- =================================================================================== jobs ====
CREATE TABLE jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The work belongs to the document that entered through the door. This row is what makes that
  -- document reachable by a worker, and a document with no row is invisible to every agent.
  document_id       doc_id NOT NULL
                    CONSTRAINT jobs_document_fkey REFERENCES documents(id)
                    ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- NO PATH WRITES 'done', 'failed', network_failures, rejected_failures, failure_kind,
  -- failure_reason OR finished_at TODAY. No role holds a write on this table, and the one door
  -- that writes it is claim_job, which sets status, attempts, claimed_by, claimed_at and
  -- updated_at. All of them stand here because a queue that has no end state and no failure
  -- record cannot keep one, and because the failure rule above names `failed` by that word. The
  -- door that writes them comes with the work behind the ingestion seam.
  status            text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','done','failed')),
  -- Every claim, whatever became of it.
  attempts          int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  -- TWO COUNTS AND NOT ONE TOTAL. The two limits of the proposed rule are different numbers on
  -- different failures, and a single total cannot say "three of one and one of the other".
  network_failures  int NOT NULL DEFAULT 0 CHECK (network_failures >= 0),
  rejected_failures int NOT NULL DEFAULT 0 CHECK (rejected_failures >= 0),
  -- The three failures the ticket separates. Credits carry no count: an exhausted account is
  -- not retried by waiting, and no rule proposes that it is.
  failure_kind      text CHECK (failure_kind IN ('network','rejected','credits')),
  -- The reason a job stopped, and the same text a retry feeds back to the model.
  failure_reason    text CHECK (failure_reason IS NULL
                                OR btrim(failure_reason, E' \t\n\r\f\v') <> ''),
  claimed_by        text CHECK (claimed_by IS NULL
                                OR btrim(claimed_by, E' \t\n\r\f\v') <> ''),
  claimed_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,

  -- ONE WAY AND NOT BOTH: a kind states a reason, and a reason states no kind. The three kinds
  -- are the taxonomy of the ticket and not a closed account of what can go wrong, so a failure
  -- that is none of them keeps its reason instead of being refused by the table.
  CONSTRAINT jobs_failure_pairs
    CHECK (failure_kind IS NULL OR failure_reason IS NOT NULL),
  -- A queue that cannot say why the work stopped leaves the operator with nothing to act on.
  CONSTRAINT jobs_failed_carries_reason
    CHECK (status <> 'failed' OR failure_reason IS NOT NULL),
  CONSTRAINT jobs_claim_pairs
    CHECK ((claimed_at IS NULL) = (claimed_by IS NULL)),
  CONSTRAINT jobs_running_is_claimed
    CHECK (status <> 'running' OR claimed_at IS NOT NULL),
  -- Work ends only after a worker took it, so no row reaches an end state unclaimed.
  CONSTRAINT jobs_ended_was_claimed
    CHECK (status = 'queued' OR claimed_at IS NOT NULL),
  CONSTRAINT jobs_finished_pairs
    CHECK ((finished_at IS NULL) = (status NOT IN ('done','failed'))),
  -- Two records of one fact drift apart. Every failure follows a claim, so the counts can never
  -- rise above the claims. It bounds them against each other and it fixes no limit.
  CONSTRAINT jobs_failures_within_attempts
    CHECK (network_failures + rejected_failures <= attempts)
);

-- The claim reads this index and nothing else: the oldest queued row first, and a worker steps
-- over what another worker holds. The identifier breaks a tie between two rows of one instant.
CREATE INDEX jobs_queued_idx ON jobs (created_at, id) WHERE status = 'queued';

-- A foreign key builds no index on the referencing side, and ON DELETE RESTRICT probes this
-- side on every delete of a document. So this index is a dependency of jobs_document_fkey.
CREATE INDEX jobs_document_idx ON jobs (document_id);

RESET ROLE;
