-- =============================================================================================
-- 0015 — a new function of gabriel_owner gives EXECUTE to no other role               ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- External constraint: a default privilege set in one schema adds to the default of every schema
-- and cannot revoke it. Only this default, set for every schema, takes EXECUTE from PUBLIC.
ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

RESET ROLE;
