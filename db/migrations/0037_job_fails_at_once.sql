-- =============================================================================================
-- 0037 — a job that fails, fails at once                                               ORDERED
--
-- ONE OPERATOR RUNS ONE WORKER, AND THE QUEUE WAS BUILT FOR MANY. A claim had a lease, a count of
-- attempts and a pause for a spent quota. A failure before the third claim left the row
-- `running` until its lease ended, and the open-job index then refused a new extraction of the
-- same document. The operator saw no reason.
--
-- NOW A JOB FAILS AT ONCE, WITH ITS REASON. At its start the runner puts back each job that a
-- crash left `running`, and the operator queues a failed document again by hand. So no count of
-- attempts, no lease and no quota wait is left to keep.
--
-- THE COLUMNS GO WITH THEIR CHECKS. The two failure counts and the failure kind were never
-- written by a door. The job view reads `attempts`, so the view goes first, and the re-runnable
-- files make it again. The doors of the lease and of the quota go, and the two numbers that only
-- they read go too.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP VIEW IF EXISTS api.job;

DROP FUNCTION IF EXISTS release_expired_claims();
DROP FUNCTION IF EXISTS release_job_for_quota(uuid);
DROP FUNCTION IF EXISTS runner_settings();
DROP FUNCTION IF EXISTS claim_job();

ALTER TABLE jobs
  DROP COLUMN attempts,
  DROP COLUMN network_failures,
  DROP COLUMN rejected_failures,
  DROP COLUMN failure_kind;

DELETE FROM parameter WHERE key IN ('job_claim_lease_seconds', 'runner_quota_wait_seconds');

RESET ROLE;
