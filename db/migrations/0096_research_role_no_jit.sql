-- =============================================================================================
-- 0096 — the research role compiles no plan                                           ORDERED
--
-- THE API VIEWS HAVE A VERY HIGH ESTIMATED COST, AND THE COMPILE IS THE SLOW STEP. The person rule
-- puts many subplans in each plan of these views, so each plan of the research role starts a
-- compiled plan (jit). The research sessions then fill the processors.
--
-- Measured on 6 November 2026, on the record, as the research role, with the sessions running.
-- The read of the entities by identifier took 16.9 s with jit and 0.07 s without it. The relations
-- of one entity took 21.8 s with jit and 0.3 s without it.
--
-- THE RESEARCH ROLE TURNS JIT OFF, as migration 0065 does for the read role. A role belongs to the
-- cluster, so the test database meets the same setting. A session reads the setting of its role
-- when it connects, so a session that is open keeps the old value.
-- =============================================================================================

ALTER ROLE gabriel_research SET jit = off;
