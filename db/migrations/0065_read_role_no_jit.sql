-- =============================================================================================
-- 0065 — the public read role compiles no plan                                        ORDERED
--
-- THE PERSON RULE AND THE LABEL OF PU1 MAKE THE PLAN OF THE PUBLIC READ LARGER. The views of the
-- read API now test, for each row, whether it names a person and whether that person is public,
-- and they find the label of each row. The estimated cost of the plan is then above the limit
-- that starts a compiled plan (jit), and the compile takes more time than the read. Measured on
-- 9 October 2026, on a test corpus of 7,050 acts, 2,029 entities and 2,018 relations, as the
-- read role: all the acts in 4.0 s with jit and 0.18 s without it, the full map in 11.2 s and
-- 0.09 s, all the relations in 7.4 s and 0.11 s. The read role has a limit of 5 s for each
-- statement.
--
-- THE READ ROLE TURNS JIT OFF. The read service applies the settings of the role that it reads
-- as, the same way it applies the statement limit. The functions of the review queue turn jit
-- off for the same reason. A role belongs to the cluster, so the test database meets the same
-- setting.
-- =============================================================================================

ALTER ROLE gabriel_read SET jit = off;
