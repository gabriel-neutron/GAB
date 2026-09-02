-- =============================================================================================
-- 00 — the api schema                                                              RE-RUNNABLE
--
-- SET ROLE and not SET LOCAL ROLE: an apply file is fed statement by statement, and SET LOCAL
-- outside a transaction block does nothing at all.
--
-- MEASURED TRAP, 20 August 2026, on gab-postgres:17-3.5-pgvector. `CREATE SCHEMA IF NOT EXISTS
-- api` run AFTER `SET ROLE gabriel_owner` fails with `permission denied for database gabriel`,
-- even though the schema already exists: PostgreSQL tests the CREATE privilege on the database
-- BEFORE it tests the IF NOT EXISTS. The statement therefore runs as the connecting identity,
-- and SET ROLE comes after it.
-- =============================================================================================

CREATE SCHEMA IF NOT EXISTS api AUTHORIZATION gabriel_owner;

SET ROLE gabriel_owner;
-- Nothing else belongs here. The views are 20, the functions are 40, the grants are 90.
RESET ROLE;
