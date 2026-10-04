-- =============================================================================================
-- 0024 — the outcome list of model_call gains the two failure kinds that packages/model gained
--                                                                                       ORDERED
--
-- THE OUTCOME LIST IS 'ok' AND THE ELEVEN FAILURE KINDS OF packages/model. 0023 held nine. The
-- client then gained 'quota' (a 429 that says the quota is spent) and 'served_other' (a model
-- other than the one asked for answered). A call that failed with either kind could not be
-- recorded. A test reads this constraint and the client list, and fails when either one holds
-- a word the other lacks.
--
-- 0023 is not edited: a migration that was applied stays as it was applied.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE public.model_call DROP CONSTRAINT model_call_outcome_check;
ALTER TABLE public.model_call ADD CONSTRAINT model_call_outcome_check
  CHECK (outcome IN ('ok','network','unreadable','rejected','refused','credits','too_long',
                     'truncated','over_cap','configuration','quota','served_other'));

RESET ROLE;
