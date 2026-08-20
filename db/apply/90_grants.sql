-- =============================================================================================
-- 90 — the perimeter                                                              RE-RUNNABLE
--
-- INVARIANT 5 LIVES IN THIS FILE. Nothing enters entities or relations without the explicit
-- promotion of a proposal, and the tier is a privilege boundary the writing role cannot cross.
--
-- The whole perimeter is in one file so that #43 can enumerate it. A column grant does not
-- supersede a table grant, it ADDS to it, and information_schema.table_privileges cannot tell
-- the two apart — measured on #16.
-- =============================================================================================

SET ROLE gabriel_owner;

-- Schema `public` grants USAGE to PUBLIC by default, and a revoke against one role does not
-- remove a privilege held through PUBLIC.
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
REVOKE ALL   ON SCHEMA public FROM gabriel_read;
GRANT  USAGE ON SCHEMA public TO gabriel_app, gabriel_agent;

REVOKE ALL ON ALL TABLES    IN SCHEMA public
  FROM PUBLIC, gabriel_app, gabriel_agent, gabriel_read;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, gabriel_app, gabriel_agent, gabriel_read;

-- There is NO blanket REVOKE ALL ON ALL FUNCTIONS here. PostGIS installs into public: run as
-- the owner the statement protects nothing it does not own, and run as the superuser it strips
-- every PostGIS function from PUBLIC and kills the map read. The ALTER DEFAULT PRIVILEGES of
-- 0001 covers every function gabriel_owner creates, including the unwritten ones.

-- THE ENUMERATION, AND THE EXACT SCOPE OF THE CLAIM. `REVOKE ALL ON ALL TABLES` is a snapshot
-- and reaches no later table, so the sentence "no role writes a table" is an enumeration of the
-- six tables below and NOT a rule about a table nobody has written. Audit arm 4 is what proves
-- the enumeration is still complete after the next migration.
GRANT SELECT ON documents, entity_type, attribute_key, proposals, entities, relations
  TO gabriel_app;
GRANT SELECT ON documents, entity_type, attribute_key, proposals, entities, relations
  TO gabriel_agent;

-- The four doors, and nothing else.
REVOKE ALL ON FUNCTION put_document(text,text,text,text,text,text,text,text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_proposal(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_proposal(uuid,text)  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION put_document(text,text,text,text,text,text,text,text,date)
  TO gabriel_app;
GRANT EXECUTE ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)
  TO gabriel_agent, gabriel_app;
GRANT EXECUTE ON FUNCTION promote_proposal(uuid,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION reject_proposal(uuid,text)  TO gabriel_app;

-- THE RESIDUAL LIMIT, STATED SO IT IS NOT DISCOVERED. proposals.xact makes propose-and-accept
-- inside one transaction unrepresentable. A backend that holds the gabriel_app secret can still
-- author on one transaction and decide on a second, and only created_at and decided_at show it.
-- session_user cannot separate the operator from the backend, because ADR 0003 §7 gives both
-- the name gabriel_app. #42 owns whether a decision needs a second party.
-- NO SCREEN MAY PRESENT decided_by AS PROOF OF A HUMAN DECISION.

-- ------------------------------------------------------------------------------ the read ---
-- gabriel_read holds nothing on public, not even USAGE.
GRANT USAGE   ON SCHEMA api TO gabriel_read;
GRANT SELECT  ON ALL TABLES IN SCHEMA api TO gabriel_read;
GRANT EXECUTE ON FUNCTION api.neighbourhood(uuid,int) TO gabriel_read;

-- An api view is auto-updatable and runs with the rights of ITS OWNER. Measured: a role holding
-- nothing on public.entities inserted a row through an ordinary api view. A probe built on a
-- `serial` key passes for an unrelated reason, so that probe proves nothing. These two lines
-- are the guard, and they cover every view including the ones nobody has written yet.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA api
  FROM gabriel_read, gabriel_app, gabriel_agent, PUBLIC;

RESET ROLE;

-- =============================================================================================
-- THE AUDIT ARMS FOR #43. Each one must return no row.
--
--   1. a SECURITY DEFINER function with no search_path
--      SELECT proname FROM pg_proc WHERE prosecdef AND proconfig IS NULL;
--
--   2. a SECURITY DEFINER function owned by anything but gabriel_owner
--      SELECT proname FROM pg_proc
--       WHERE pronamespace IN ('public'::regnamespace,'api'::regnamespace)
--         AND prosecdef AND proowner <> 'gabriel_owner'::regrole;
--
--   3. any member of gabriel_owner
--      SELECT rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
--       WHERE m.roleid = 'gabriel_owner'::regrole;
--
--   4. a write grant on any table — this one catches a later migration that adds a table and
--      forgets that the GRANT list above is an enumeration and not a rule.
--      MEASURED, 20 August 2026: without the extension clause this arm returns twelve rows for
--      spatial_ref_sys, geometry_columns and geography_columns, which PostGIS owns and grants.
--      An arm that always returns rows is an arm nobody reads.
--      SELECT g.table_schema, g.table_name, g.grantee, g.privilege_type
--        FROM information_schema.role_table_grants g
--       WHERE g.table_schema IN ('public','api')
--         AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
--         AND g.grantee <> 'gabriel_owner'
--         AND NOT EXISTS (
--               SELECT 1 FROM pg_depend d
--                 JOIN pg_class c ON c.oid = d.objid
--                 JOIN pg_namespace n ON n.oid = c.relnamespace
--                WHERE d.deptype = 'e' AND n.nspname = g.table_schema
--                  AND c.relname = g.table_name);
-- =============================================================================================
