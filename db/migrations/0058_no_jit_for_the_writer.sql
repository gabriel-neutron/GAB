-- =============================================================================================
-- 0058 — no compiled plan for the sessions of the writer                                  ORDERED
--
-- THE QUEUE OF THE REVIEW CHECKS THE FAULTS OF EACH UNIT when the operator filters by a fault. The
-- server compiles the plan of a costly query before it runs it, and on that check the compile
-- takes longer than the query. Measured on the record on 2026-10-07: a page filtered by a fault
-- took 1.2 to 1.8 seconds with the compile, and 0.35 to 0.5 seconds without it. The other doors of
-- the writer are short, so they lose nothing.
-- =============================================================================================

ALTER ROLE gabriel_app SET jit = off;
