-- =============================================================================================
-- 0001 — extensions and roles                                                          ORDERED
--
-- Run by the bootstrap superuser of infra/docker-compose.yml. CREATE EXTENSION needs one, and
-- schema `public` is owned by pg_database_owner, so a GRANT on it run as gabriel_owner grants
-- nothing and passes with a warning.
--
-- ADR 0003 §7 fixes the four role names. This file creates them and nothing else.
-- =============================================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- gabriel_owner owns every table and every write function, and it never logs in.
-- NO ROLE IS EVER MADE A MEMBER OF IT. Measured on #15: a membership granted
-- WITH INHERIT FALSE reports no privilege and then writes after SET ROLE.
CREATE ROLE gabriel_owner NOLOGIN NOINHERIT;
CREATE ROLE gabriel_app   LOGIN   NOINHERIT;   -- calls the write functions, writes no table
CREATE ROLE gabriel_agent LOGIN   NOINHERIT;   -- proposes only
CREATE ROLE gabriel_read  LOGIN   NOINHERIT;   -- reads the api schema only

ALTER ROLE gabriel_read  SET statement_timeout = '5s';   -- docs/spec.md §4
ALTER ROLE gabriel_app   SET statement_timeout = '30s';
ALTER ROLE gabriel_agent SET statement_timeout = '30s';

ALTER SCHEMA public OWNER TO gabriel_owner;
GRANT USAGE, CREATE ON SCHEMA public TO gabriel_owner;   -- USAGE is not CREATE

CREATE SCHEMA IF NOT EXISTS api AUTHORIZATION gabriel_owner;

-- PostgreSQL grants EXECUTE on every NEW function to PUBLIC. A blanket revoke is refused here:
-- PostGIS installs into public, so run as the owner it protects nothing it does not own, and
-- run as the superuser it strips every PostGIS function from PUBLIC and kills the map read.
-- A default privilege covers every function gabriel_owner will create, including unwritten ones.
ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner IN SCHEMA api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
