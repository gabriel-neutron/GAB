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

-- External constraint: no blanket function revoke runs here. PostGIS is in public, and as the
-- superuser the revoke stops the map read. A default privilege of gabriel_owner, set for every
-- schema, takes EXECUTE from PUBLIC on each function that gabriel_owner creates.

-- THE ENUMERATION, AND THE EXACT SCOPE OF THE CLAIM. `REVOKE ALL ON ALL TABLES` is a snapshot
-- and reaches no later table, so the sentence "no role writes a table" is an enumeration of the
-- seven tables below and NOT a rule about a table nobody has written. Audit arm 4 is what proves
-- the enumeration is still complete after the next migration.
GRANT SELECT ON documents, entity_type, proposals, entities, relations, jobs
  TO gabriel_app;
GRANT SELECT ON documents, entity_type, proposals, entities, relations, jobs
  TO gabriel_agent;

-- The eight doors, and nothing else.
REVOKE ALL ON FUNCTION put_document(text,text,text,text,text,text,text,text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_proposal(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_proposal(uuid,text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_job()                 FROM PUBLIC;
REVOKE ALL ON FUNCTION release_expired_claims()    FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_job(uuid,text)         FROM PUBLIC;
REVOKE ALL ON FUNCTION set_entity_layout(jsonb)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION put_document(text,text,text,text,text,text,text,text,date)
  TO gabriel_app;
GRANT EXECUTE ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)
  TO gabriel_agent, gabriel_app;
GRANT EXECUTE ON FUNCTION promote_proposal(uuid,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION reject_proposal(uuid,text)  TO gabriel_app;

-- THE LAYOUT DOOR IS HELD BY THE WORKER, AND THE WORKER HOLDS THE NARROWER SECRET. The layout
-- run reads the graph and writes a drawing of it; it signs nothing and it proposes nothing. The
-- process that runs it is the worker, and the worker's secret is gabriel_agent: the one that
-- cannot sign as the operator. This door reaches entity_layout alone, which carries no evidence,
-- so it opens nothing of the evidentiary layer.
GRANT EXECUTE ON FUNCTION set_entity_layout(jsonb) TO gabriel_agent;

GRANT EXECUTE ON FUNCTION claim_job()              TO gabriel_agent;
GRANT EXECUTE ON FUNCTION release_expired_claims() TO gabriel_app;
GRANT EXECUTE ON FUNCTION fail_job(uuid,text)      TO gabriel_agent;

-- THE FOUR ENDS OF THE QUEUE, AND THEY ARE HELD BY DIFFERENT ROLES.
--
-- ENQUEUE IS gabriel_app, AND IT IS NOT A GRANT OF ITS OWN. The job row is written inside
-- put_document, so the role that may put a document is the role that may queue work, and there
-- is no second way in. No role holds INSERT on jobs, so nothing queues work for a document that
-- did not enter through the door.
--
-- ONE PROCESS HOLDS ONE SECRET, and that is what carries the claim. A worker that held the
-- gabriel_app secret to claim would also hold put_document, promote_proposal and reject_proposal,
-- which is the whole operator surface, inside the one process that runs a model over untrusted
-- text. So the claim goes to the narrower secret, which is the one that cannot sign as the
-- operator. The claim door itself signs nothing; a trigger stamps the taker from session_user.
--
-- THE RELEASE IS gabriel_app, AND IT IS THE ONE THAT MAKES THE CLAIM SAFE TO GRANT. A claim now
-- has a way back: a row whose lease expired returns to `queued`, and no superuser session is
-- needed to free it. The release is an act of the operator over the queue and not of the worker
-- that lost the row, so it is held by the role that owns the door of the queue.
--
-- A RELEASE SPENDS THE ATTEMPT, and the release door is the only way back: no role holds UPDATE
-- on jobs, and nothing moves a row into a state a door did not produce.
--
-- THE FAILURE IS gabriel_agent, BESIDE THE CLAIM. Only the worker that ran the job knows why it
-- failed, and the door ends a running row alone, so it opens nothing of the operator surface.

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
-- THE AUDIT ARMS. Each one must return no row.
--
--   1. a SECURITY DEFINER function with no search_path entry. proconfig holds every SET of a
--      function, so a test for NULL passes a definer that sets only another parameter.
--      SELECT p.proname FROM pg_proc p
--       WHERE p.prosecdef
--         AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS s(setting)
--                          WHERE s.setting LIKE 'search\_path=%');
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
--
--   5. an api function with invoker rights whose body names public, or names a relation of
--      public with no schema, which a search_path that holds public resolves there. Arms 1 and 2
--      both filter on prosecdef, so neither one looks at a function that is NOT a definer.
--      gabriel_read holds nothing on public, so each call of such a function raises, and its
--      GRANT reads as a working door. The api views are the way out, and they run as their owner.
--      The lookbehind passes a name after a dot, so api.entity_type is not the table entity_type.
--      SELECT p.proname FROM pg_proc p
--       WHERE p.pronamespace = 'api'::regnamespace
--         AND NOT p.prosecdef
--         AND (p.prosrc ~* '\mpublic\.'
--              OR EXISTS (SELECT 1 FROM pg_class c
--                          WHERE c.relnamespace = 'public'::regnamespace
--                            AND c.relkind IN ('r','p','v','m','f')
--                            AND p.prosrc ~* ('(?<![.\w"])"?' || c.relname || '\M')));
--
--   6. THE DOOR SET. Arms 1 to 5 read a table grant, and a SECURITY DEFINER door holds none: a
--      door writes as gabriel_owner, so EXECUTE on one is the right to write a table that every
--      other arm says the caller cannot touch. This arm returns the whole door set, and a test
--      holds the list by hand, so a door granted to a role later fails until a person writes it
--      in. THE CLAIM DOOR AND THE RELEASE DOOR ARE BOTH IN THE LIST, and they belong to
--      different roles: one takes a row from the queue, and the other gives it back.
--      SELECT n.nspname || '.' || p.proname || ' to '
--             || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
--                     ELSE pg_get_userbyid(a.grantee) END
--        FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--        CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
--       WHERE n.nspname IN ('public','api') AND p.prosecdef
--         AND a.privilege_type = 'EXECUTE'
--         AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> 'gabriel_owner');
-- =============================================================================================
