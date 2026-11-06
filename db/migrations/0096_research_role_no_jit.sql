-- =============================================================================================
-- 0096 — the research role compiles no plan                                           ORDERED
--
-- THE VIEWS OF THE READ API HAVE A VERY HIGH ESTIMATED COST, AND THE COMPILE IS THE SLOW STEP. The
-- person rule puts many subplans in each plan, so each plan of the research role starts a compiled
-- plan (jit). A statement limit does not stop a compile, so a statement runs past its 30 s and
-- holds a processor. Twelve sessions then fill the processors, and the reads of the review queue
-- reach their limit. Measured on 6 November 2026 on the record, under the load of the sessions,
-- as the research role: the read of the entities by identifier in 16.9 s with jit and 0.07 s
-- without it. Migration 0065 gives the same measure and the same setting for the read role.
--
-- A role belongs to the cluster, so the test database meets the same setting. A session reads the
-- setting of its role when it connects, so a session that is open keeps the old value.
-- =============================================================================================

ALTER ROLE gabriel_research SET jit = off;
