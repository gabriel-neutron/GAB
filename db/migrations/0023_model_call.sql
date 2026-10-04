-- =============================================================================================
-- 0023 — a machine proposal names the model call that made it                          ORDERED
--
-- THE 0003 COMMENT "There is no call_id" IS NOW FALSE. This file is the fresh truth: the table
-- below is the record of one question to a model, and proposals.model_call_id points at it. A
-- rendered prompt cannot be re-derived, so the call lands before the first agent writes, and
-- never after it.
--
-- THE TABLE HOLDS A DIGEST OF THE PROMPT AND NEVER THE PROMPT. The prompt can quote an
-- untrusted document, and the read role publishes this table. The operator who disputes a claim
-- learns which agent version, which requested model and which served model answered, and when.
--
-- ONE ROW IS ONE CALL, AND IT IS NEVER UPDATED (M5): the history is the rows themselves. A
-- trigger holds it, because the owner and the superuser ignore a grant.
--
-- THE OUTCOME LIST IS 'ok' AND THE NINE FAILURE KINDS OF packages/model. A test reads this
-- constraint and the client list, and fails when either one holds a word the other lacks.
--
-- NO ROLE WRITES THIS TABLE. record_model_call is the one door, and gabriel_agent alone holds it.
--
-- THE AGENT-MUST-CARRY-A-CALL RULE IS NOT A CHECK. A CHECK would refuse the agent proposals that
-- were written before this file and would stop their decision. The rule is tested on the insert
-- by stamp_author_role, so an old row is counted below and never refused.
-- gabriel_research cannot author a proposal: author_role allows gabriel_agent and gabriel_app
-- alone, so "no call unless gabriel_agent" covers every other author.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE model_call (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A chat call has no job. A job that a call names is never deleted.
  job_id           uuid
                   CONSTRAINT model_call_job_fkey REFERENCES jobs(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  agent            text NOT NULL CHECK (btrim(agent, E' \t\n\r\f\v') <> ''),
  agent_version    text NOT NULL CHECK (btrim(agent_version, E' \t\n\r\f\v') <> ''),
  endpoint         text NOT NULL CHECK (btrim(endpoint, E' \t\n\r\f\v') <> ''),
  requested_model  text NOT NULL CHECK (btrim(requested_model, E' \t\n\r\f\v') <> ''),
  -- A call that failed may never have reached a model, so no model served it.
  served_model     text CHECK (served_model IS NULL
                               OR btrim(served_model, E' \t\n\r\f\v') <> ''),
  prompt_sha256    text NOT NULL CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  input_tokens     int CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens    int CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms       int NOT NULL CHECK (latency_ms >= 0),
  outcome          text NOT NULL
                   CONSTRAINT model_call_outcome_check
                   CHECK (outcome IN ('ok','network','unreadable','rejected','refused','credits',
                                      'too_long','truncated','over_cap','configuration')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- A foreign key builds no index on the referencing side. This one serves "the calls of one job".
CREATE INDEX model_call_job_idx ON model_call (job_id) WHERE job_id IS NOT NULL;

ALTER TABLE proposals
  ADD COLUMN model_call_id uuid
      CONSTRAINT proposals_model_call_fkey REFERENCES model_call(id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT proposals_app_carries_no_call
      CHECK (author_role = 'gabriel_agent' OR model_call_id IS NULL);

-- ON DELETE RESTRICT probes this side on each delete of a call, and "the call of one proposal"
-- reads it.
CREATE INDEX proposals_model_call_idx ON proposals (model_call_id) WHERE model_call_id IS NOT NULL;

DO $$
DECLARE v_legacy bigint;
BEGIN
  SELECT count(*) INTO v_legacy
    FROM public.proposals WHERE author_role = 'gabriel_agent' AND model_call_id IS NULL;
  RAISE NOTICE 'proposals of gabriel_agent with no model call: %. They stay, and they can be decided.',
    v_legacy;
END $$;

RESET ROLE;
