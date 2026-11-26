-- =============================================================================================
-- 0099 — a read-only role for the node audit through the tunnel to the VPS               ORDERED
--
-- THE VPS READS THE RECORD ONLY THROUGH A TUNNEL THAT THE PC OPENS, and only as this role. The
-- verdict of the panel of 2026-11-26 (software-architect, skeptic): the role reads two views of
-- the schema `audit` and nothing else. db/apply/20_views.sql makes the views, and 90_grants.sql
-- grants them.
--
-- THE ROLE CANNOT LOG IN BY DEFAULT. tools/record-tunnel.ts gives it LOGIN, a new password and an
-- end time when it opens the tunnel, and it takes LOGIN away when it closes the tunnel. So no
-- environment file holds a password of this role, and a password stops when the tunnel stops.
--
-- THE SETTINGS OF THE ROLE MAKE EACH SESSION READ ONLY, but a client can change a setting. The
-- grants are the guard: the role holds no write grant and no USAGE on `public`.
-- =============================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'gabriel_audit') THEN
    CREATE ROLE gabriel_audit;
  END IF;
END
$$;

-- A role belongs to the cluster, so the test database meets it already made, and each attribute
-- is stated either way.
ALTER ROLE gabriel_audit NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL;
ALTER ROLE gabriel_audit SET default_transaction_read_only = on;
ALTER ROLE gabriel_audit SET statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION gabriel_owner;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
