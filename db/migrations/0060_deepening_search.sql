-- =============================================================================================
-- 0060 — the deepening search for a unit with weak sources                              ORDERED
--
-- A UNIT WITH WEAK SOURCES CAN START ONE LEAD, inside a budget that the operator sets
-- (`decisions.md` S3, P10). The lead is a job of the lead agent. The rule starts it, the lead
-- agent stores pages and queues their extraction, and the extraction proposes. The lead proposes
-- nothing, and the rules decide.
--
-- THE BUDGET IS A SETTING OF THE RULE. The row `weak_sources` of the configuration holds the
-- token budget of one search. It starts at zero, and at zero no search runs. The operator sets a
-- value with a new version of the row in the same statement, like any other threshold.
--
-- THE BUDGET TRAVELS WITH THE JOB. The job keeps the budget that stood when the rule started it,
-- so a later change of the setting never changes a search that waits in the queue. Only a lead
-- has a budget. A lead of the operator has none, and it uses the cap of the worker.
--
-- ONE SEARCH FOR EACH UNIT. A row links the unit to its search, and the key of the unit makes a
-- second search impossible. The row is also the sign that a search happened: the rule that rejects
-- a unit with only weak sources reads it. No role reads or writes the table: the functions in the
-- re-runnable files do.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE jobs
  ADD COLUMN token_budget integer
      CONSTRAINT jobs_token_budget CHECK (token_budget IS NULL OR token_budget > 0),
  ADD CONSTRAINT jobs_budget_of_lead CHECK (token_budget IS NULL OR kind = 'research_lead');

CREATE TABLE deepening (
  unit_id    uuid PRIMARY KEY,
  job_id     uuid NOT NULL UNIQUE
             CONSTRAINT deepening_job_fkey REFERENCES jobs(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

UPDATE rule_config
   SET version = version + 1, settings = '{"deepening_tokens": 0}'
 WHERE rule = 'weak_sources';

RESET ROLE;
