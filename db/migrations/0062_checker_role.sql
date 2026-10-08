-- =============================================================================================
-- 0062 — a role of its own for the check of a research batch                          ORDERED
--
-- THE RESEARCH ROLE COULD WRITE A CHECK. The MCP server wrote the checks of a research batch as
-- gabriel_research, and the research AI holds the password of that role. So a session of the AI
-- could write a passed check on any act, and the first check of an act stays.
--
-- A SIXTH ROLE WRITES THE CHECKS OF THE RESEARCH ACTS. gabriel_checker logs in, inherits nothing
-- and is a member of nothing. 90_grants.sql gives it two doors: the record of a model call and
-- the check of an act that gabriel_research wrote. Its password is in the environment file of
-- the stack, and the research workspace does not hold it. A role belongs to the cluster, so the
-- test database meets it already made, and the ALTER lines state each attribute either way.
--
-- A CHECK KEEPS THE REASON OF THE CHECKER. An act that was written with no check, and that a
-- later call checks, has no dispute reason, so the reason of a verdict that is not `supported`
-- is kept with the check. It is null for a passed check and for a checker that gave none.
-- =============================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'gabriel_checker') THEN
    CREATE ROLE gabriel_checker;
  END IF;
END
$$;

ALTER ROLE gabriel_checker LOGIN NOINHERIT;
ALTER ROLE gabriel_checker SET statement_timeout = '30s';

SET LOCAL ROLE gabriel_owner;

ALTER TABLE act_check ADD COLUMN reason text
  CONSTRAINT act_check_reason CHECK (reason IS NULL OR length(reason) <= 1000);

RESET ROLE;
