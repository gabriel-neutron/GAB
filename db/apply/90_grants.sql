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
GRANT  USAGE ON SCHEMA public TO gabriel_app, gabriel_agent, gabriel_research;

REVOKE ALL ON ALL TABLES    IN SCHEMA public
  FROM PUBLIC, gabriel_app, gabriel_agent, gabriel_research, gabriel_read;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, gabriel_app, gabriel_agent, gabriel_research, gabriel_read;

-- External constraint: no blanket function revoke runs here. PostGIS is in public, and as the
-- superuser the revoke stops the map read. A default privilege of gabriel_owner, set for every
-- schema, takes EXECUTE from PUBLIC on each function that gabriel_owner creates.

-- External constraint: `REVOKE ALL ON ALL TABLES` is a snapshot and reaches no later table, so
-- "no role writes a table" holds for the tables granted below and NOT for a table nobody
-- has written.
-- Audit arm 4 proves that the list is still complete after the next migration.
GRANT SELECT ON documents, document_provider, entity_type, relation_type, proposals, entities,
  relations, jobs TO gabriel_app;
GRANT SELECT ON documents, document_provider, entity_type, relation_type, proposals, entities,
  relations, jobs TO gabriel_agent;

-- THE RESEARCH ROLE READS WHAT THE READ TOOLS NEED, and no more. It holds no grant on the table
-- `jobs`. The status of the jobs of one document reaches it through api.job, which hides every
-- column that a tool has no use for.
GRANT SELECT ON documents, document_provider, entity_type, relation_type, proposals, entities,
  relations TO gabriel_research;

-- THE CONVERSATIONS ARE PRIVATE. gabriel_app reads the three tables, and no other role holds a
-- grant on them: gabriel_read has no USAGE on public, and gabriel_agent has no use for them.
GRANT SELECT ON conversation, chat_message, chat_citation TO gabriel_app;

-- THE TEXT OF A DOCUMENT IS PRIVATE. Both roles that read a document read its text, and
-- gabriel_read holds no grant and no view of it, because the licence of a source may be unknown.
GRANT SELECT ON document_text TO gabriel_app, gabriel_agent, gabriel_research;

-- The doors, and nothing else.
REVOKE ALL ON FUNCTION put_document(text,text,text,text,text,text,text,text,date,text,numeric)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION record_model_call(text,text,text,text,text,int,text,uuid,text,int,int)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_proposal(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_proposal(uuid,text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_job()                 FROM PUBLIC;
REVOKE ALL ON FUNCTION requeue_running_jobs()      FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_job(uuid,text)         FROM PUBLIC;
REVOKE ALL ON FUNCTION enqueue_job(text,text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_job(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION runner_settings()           FROM PUBLIC;
REVOKE ALL ON FUNCTION set_entity_layout(jsonb)    FROM PUBLIC;
REVOKE ALL ON FUNCTION open_conversation(text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_chat_message(uuid,text,text,uuid,jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION put_document_text(text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION put_claim_reading(uuid,uuid,text,int,int,int,text,boolean,uuid,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION second_read_done(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION put_fetched_document(text,text,text,text,text,text,date,text,text)
  FROM PUBLIC;

-- THE TIER IS HELD BY NO ROLE. The owner of a view does not lend EXECUTE on a function that the
-- view calls, so the reader role of an export gets the grant together with that export.
REVOKE ALL ON FUNCTION document_tier(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION put_document_text(text,jsonb,text)
  TO gabriel_app, gabriel_agent, gabriel_research;

-- THE FETCHED-DOCUMENT DOOR IS HELD BY THE TWO MACHINE ROLES, AND NOT BY THE OPERATOR, who holds
-- the wider put_document. It writes `url` and `api` rows with their bytes and nothing else.
GRANT EXECUTE ON FUNCTION put_fetched_document(text,text,text,text,text,text,date,text,text)
  TO gabriel_agent, gabriel_research;
-- ------------------------------------------------------------------------- the originator ---
-- NO ROLE HOLDS A GRANT ON A TABLE OF THE ORIGINATOR, and the REVOKE above already took every one.
-- The doors below are the whole of the write path, and none of them writes through a model role
-- except the two of gabriel_agent: ensure_originator_candidate and propose_originator_fact.
-- ensure_originator_candidate creates an originator at letter F with no jurisdiction, no kind
-- state_body and no flag. propose_originator_fact stores a fact as a proposal with a stored span.
-- ensure_originator and decide_originator_fact belong to gabriel_app alone: an agent that could set
-- a jurisdiction, a kind state_body or a decision could make a flag. No door of gabriel_agent
-- writes a letter, a flag, a merge, an imprint or a resolution (L1).
--
-- THREE DOORS HAVE NO GRANT AT ALL. record_resolution, set_gold_set_letter and ack_letter_change
-- are called by the definer doors of other tickets, and the owner needs no grant to run them.
-- A grant here would let the operator backend write a track record by hand.
--
-- THE TWO READS BELONG TO gabriel_app ALONE. issuer_card_for and originator_letter_for answer the
-- gate, which runs under the operator backend. The worker holds neither, so a letter never enters
-- a prompt through a tool of the worker.
REVOKE ALL ON FUNCTION ensure_originator(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION propose_originator_fact(text,text,jsonb,text,integer,integer,integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_originator_fact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_originator_candidate(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_operator_letter(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_operator_letter(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION contest_letter(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_fabrication(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION merge_originator(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION link_imprint(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_party_false(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION review_originator_card(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION load_trust_list(text,text,date,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION originator_exceptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION refresh_originator(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION issuer_card_for(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION originator_letter_for(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_resolution(text,uuid,text,text,text,text,text,text,timestamptz,date)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION set_gold_set_letter(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ack_letter_change(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ensure_originator(text,text,text,text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION ensure_originator_candidate(text,text,text)
  TO gabriel_agent, gabriel_app;
GRANT EXECUTE ON FUNCTION propose_originator_fact(text,text,jsonb,text,integer,integer,integer)
  TO gabriel_agent, gabriel_app;
GRANT EXECUTE ON FUNCTION decide_originator_fact(uuid) TO gabriel_app;

GRANT EXECUTE ON FUNCTION set_operator_letter(text,text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION remove_operator_letter(text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION contest_letter(text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION confirm_fabrication(uuid,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION merge_originator(text,text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION link_imprint(text,text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION set_party_false(text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION review_originator_card(text,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION load_trust_list(text,text,date,text,jsonb) TO gabriel_app;
GRANT EXECUTE ON FUNCTION originator_exceptions() TO gabriel_app;
GRANT EXECUTE ON FUNCTION refresh_originator(text,timestamptz) TO gabriel_app;
GRANT EXECUTE ON FUNCTION issuer_card_for(text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION originator_letter_for(text,text) TO gabriel_app;

GRANT EXECUTE ON FUNCTION open_conversation(text,text,uuid) TO gabriel_app;
GRANT EXECUTE ON FUNCTION append_chat_message(uuid,text,text,uuid,jsonb) TO gabriel_app;

GRANT EXECUTE ON FUNCTION put_document(text,text,text,text,text,text,text,text,date,text,numeric)
  TO gabriel_app;
GRANT EXECUTE ON FUNCTION propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text)
  TO gabriel_agent, gabriel_app, gabriel_research;
GRANT EXECUTE ON FUNCTION promote_proposal(uuid,text) TO gabriel_app;
GRANT EXECUTE ON FUNCTION reject_proposal(uuid,text)  TO gabriel_app;

-- THE LAYOUT DOOR IS HELD BY THE WORKER, AND THE WORKER HOLDS THE NARROWER SECRET. The layout
-- run reads the graph and writes a drawing of it; it signs nothing and it proposes nothing. The
-- process that runs it is the worker, and the worker's secret is gabriel_agent: the one that
-- cannot sign as the operator. This door reaches entity_layout alone, which carries no evidence,
-- so it opens nothing of the evidentiary layer.
GRANT EXECUTE ON FUNCTION set_entity_layout(jsonb) TO gabriel_agent;

-- THE CALL RECORD IS gabriel_agent ALONE. Only the worker that asked the model knows what it
-- asked, and the door writes model_call and nothing else.
GRANT EXECUTE ON FUNCTION record_model_call(text,text,text,text,text,int,text,uuid,text,int,int)
  TO gabriel_agent;

GRANT EXECUTE ON FUNCTION claim_job()              TO gabriel_agent;
GRANT EXECUTE ON FUNCTION requeue_running_jobs()   TO gabriel_agent;
GRANT EXECUTE ON FUNCTION fail_job(uuid,text)      TO gabriel_agent;
GRANT EXECUTE ON FUNCTION enqueue_job(text,text)
  TO gabriel_app, gabriel_agent, gabriel_research;
GRANT EXECUTE ON FUNCTION complete_job(uuid)       TO gabriel_agent;

-- THE STATUS READ IS gabriel_app ALONE. The writer shows the operator the work on a document,
-- and the public read holds no door of the queue.
REVOKE ALL ON FUNCTION document_jobs(text)         FROM PUBLIC;
GRANT EXECUTE ON FUNCTION document_jobs(text)      TO gabriel_app;
GRANT EXECUTE ON FUNCTION runner_settings()        TO gabriel_agent;

-- THE READING DOOR IS gabriel_agent ALONE. Only the worker that ran the reader knows what it read,
-- and the door writes claim_reading and nothing else. No role holds a grant on claim_reading or on
-- citation: the revoke above covers both, because this file runs after the migrations.
GRANT EXECUTE ON FUNCTION put_claim_reading(uuid,uuid,text,int,int,int,text,boolean,uuid,text,text,text,text)
  TO gabriel_agent;

-- THE CHECK OF A CHUNK THAT IS READ IS gabriel_agent ALONE. It answers yes or no for the job that
-- the caller holds, and it returns no row of the readings.
GRANT EXECUTE ON FUNCTION second_read_done(uuid,text,text,text) TO gabriel_agent;

-- THE FOUR ENDS OF THE QUEUE, AND THEY ARE HELD BY DIFFERENT ROLES.
--
-- ENQUEUE IS gabriel_app, gabriel_agent AND gabriel_research, THROUGH enqueue_job. put_document writes a
-- `store_only` row that is born done and queues nothing, so asking for work is its own grant. The
-- operator asks for the one document that needs work, and a worker that finds a second step of
-- work for a document asks for it too. No role holds INSERT on jobs, so nothing queues work for
-- a document that did not enter through the door, and enqueue_job refuses a document with no
-- bytes.
--
-- ONE PROCESS HOLDS ONE SECRET, and that is what carries the claim. A worker that held the
-- gabriel_app secret to claim would also hold put_document, promote_proposal and reject_proposal,
-- which is the whole operator surface, inside the one process that runs a model over untrusted
-- text. So the claim goes to the narrower secret, which is the one that cannot sign as the
-- operator. The claim door itself signs nothing; a trigger stamps the taker from session_user.
--
-- THE REQUEUE IS gabriel_agent, BESIDE THE CLAIM. A claim has a way back: at its start the runner
-- returns each row that its role left `running`, and no superuser session is needed to free it.
-- No role holds UPDATE on jobs, so nothing moves a row into a state a door did not produce.
--
-- THE FAILURE IS gabriel_agent, BESIDE THE CLAIM. Only the worker that ran the job knows why it
-- failed, and the door ends a running row alone, so it opens nothing of the operator surface.
--
-- THE COMPLETION IS gabriel_agent FOR THE SAME REASON. Only the worker that ran the job knows that
-- it succeeded, and the door ends a running row alone.

-- THE SETTINGS READ IS gabriel_agent ALONE, FOR THE SAME REASON AS THE CLAIM. It returns the wait
-- of the runner and no other row of the parameter table, which no role can read.

-- THE RESIDUAL LIMIT, STATED SO IT IS NOT DISCOVERED. proposals.xact makes propose-and-accept
-- inside one transaction unrepresentable. A backend that holds the gabriel_app secret can still
-- author on one transaction and decide on a second, and only created_at and decided_at show it.
-- session_user cannot separate the operator from the backend, because ADR 0003 gives both
-- the name gabriel_app. #42 owns whether a decision needs a second party.
-- NO SCREEN MAY PRESENT decided_by AS PROOF OF A HUMAN DECISION.

-- ------------------------------------------------------------------------------ the read ---
-- gabriel_read holds nothing on public, not even USAGE.
GRANT USAGE   ON SCHEMA api TO gabriel_read;
GRANT SELECT  ON ALL TABLES IN SCHEMA api TO gabriel_read;
GRANT EXECUTE ON FUNCTION api.neighbourhood(uuid,int) TO gabriel_read;

-- THE THREE ROLES THAT RUN A TOOL READ THROUGH api TOO, AND THROUGH FIVE VIEWS ONLY. A tool asks for
-- an entity, a relation, a proposal, a document or a job, and for the neighbourhood of one entity.
-- The list is written by name and never as ALL TABLES, so api.model_call, which holds the digests
-- of the worker's prompts, stays closed to them. A view added later opens to nobody by default.
GRANT USAGE  ON SCHEMA api TO gabriel_app, gabriel_agent, gabriel_research;
GRANT SELECT ON api.entity, api.relation, api.proposal, api.document, api.job
  TO gabriel_app, gabriel_agent, gabriel_research;
GRANT EXECUTE ON FUNCTION api.neighbourhood(uuid,int)
  TO gabriel_app, gabriel_agent, gabriel_research;

-- An api view is auto-updatable and runs with the rights of ITS OWNER. Measured: a role holding
-- nothing on public.entities inserted a row through an ordinary api view. A probe built on a
-- `serial` key passes for an unrelated reason, so that probe proves nothing. These two lines
-- are the guard, and they cover every view including the ones nobody has written yet.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA api
  FROM gabriel_read, gabriel_app, gabriel_agent, gabriel_research, PUBLIC;

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
--   3. any member of gabriel_owner, any membership of a login role, and any elevated attribute of
--      one. A GRANT of a role gives the SET option by default, so a member can SET ROLE to it.
--      SELECT r.rolname, g.rolname FROM pg_auth_members m
--        JOIN pg_roles r ON r.oid = m.member JOIN pg_roles g ON g.oid = m.roleid
--       WHERE m.roleid = 'gabriel_owner'::regrole
--          OR r.rolname IN ('gabriel_app','gabriel_agent','gabriel_research','gabriel_read');
--      SELECT rolname FROM pg_roles
--       WHERE rolname IN ('gabriel_app','gabriel_agent','gabriel_research','gabriel_read')
--         AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication);
--
--   4. a write grant on any table — this one catches a later migration that adds a table and
--      forgets that the GRANT list above is an enumeration and not a rule.
--      MEASURED, 20 August 2026: without the extension clause this arm returns twelve rows for
--      spatial_ref_sys, geometry_columns and geography_columns, which PostGIS owns and grants.
--      An arm that always returns rows is an arm nobody reads. role_table_grants reads the table
--      ACL alone, so a grant on one column is read from column_privileges too.
--      SELECT g.table_schema, g.table_name, g.grantee, g.privilege_type
--        FROM (SELECT table_schema, table_name, grantee, privilege_type
--                FROM information_schema.role_table_grants
--              UNION
--              SELECT table_schema, table_name, grantee, privilege_type
--                FROM information_schema.column_privileges) AS g
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
