-- =============================================================================================
-- 0048 — a job keeps the parts that it could not propose                               ORDERED
--
-- AN EXTRACTION READS A DOCUMENT IN PARTS. The propose door can refuse the batch of one part two
-- times, and the claims of that part are then lost. Before this file, the job ended `done` and
-- nothing said so.
--
-- NOW THE JOB KEEPS THE COUNT AND THE FIRST REASON. A job that proposed from at least one part
-- stays `done`, and the operator reads how many parts were refused and why. A job whose every
-- part was refused fails, with the same words as its reason.
--
-- AN OLD JOB REFUSED NO PART THAT ANYTHING RECORDED, so its count is zero and it has no reason.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The reason holds no length cap, as the failure reason holds none: the same words can end a job.
ALTER TABLE jobs
  ADD COLUMN refused_parts int NOT NULL DEFAULT 0
      CONSTRAINT jobs_refused_parts_count CHECK (refused_parts >= 0),
  ADD COLUMN refusal text
      CONSTRAINT jobs_refusal_text CHECK (refusal IS NULL
                                          OR btrim(refusal, E' \t\n\r\f\v') <> ''),
  ADD CONSTRAINT jobs_refusal_pairs CHECK ((refused_parts = 0) = (refusal IS NULL));

RESET ROLE;
