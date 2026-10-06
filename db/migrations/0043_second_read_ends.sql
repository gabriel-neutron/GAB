-- =============================================================================================
-- 0043 — the blind second reader is gone, and its open jobs fail                         ORDERED
--
-- A CHECK BY A MODEL OF ANOTHER FAMILY REPLACES THE SECOND READING. The extractor now asks that
-- model about each item before it writes the item, and a result that is not "supported" sets the
-- dispute flag at insert. No door queues a second reading, and the claim door takes none.
--
-- A JOB OF THAT KIND THAT AN OLD DATABASE HOLDS WOULD WAIT FOR EVER. So each open one fails here,
-- with its reason, as a job of the runner fails. The kind stays in the check of the table: a
-- finished job of that kind is a record, and it stays.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- A job ends only after a claim, so this file takes each queued one first. A trigger stamps the
-- role of the connection as its taker.
UPDATE jobs
   SET status = 'running', claimed_at = now(), updated_at = now()
 WHERE kind = 'second_read' AND status = 'queued';

UPDATE jobs
   SET status = 'failed',
       failure_reason = 'the second reader is gone, and a check by another model replaces it',
       finished_at = now(),
       updated_at = now()
 WHERE kind = 'second_read' AND status = 'running';

RESET ROLE;
