-- =============================================================================================
-- 0030 — the three roles that run a tool read the record through the api views          ORDERED
--
-- A TOOL READS THROUGH `api`, AND THREE ROLES HELD NO RIGHT TO ENTER IT. The operator, the worker
-- and the research role each read the base tables of `public`, and none held USAGE on `api`. A
-- tool that asks for the neighbourhood of an entity, or for one proposal, reads a view, so it
-- raised `permission denied for schema api` for each of the three.
--
-- THE GRANT NAMES FIVE VIEWS AND ONE FUNCTION, AND NO MORE. It does not use ALL TABLES: that form
-- is a snapshot, and it would open api.model_call, whose digests belong to the worker alone.
-- The REVOKE of write rights on api in 90_grants.sql stays, and it covers these views.
--
-- THE VIEWS DO NOT EXIST WHEN A NEW DATABASE RUNS THIS FILE. The views are made by the
-- re-runnable files, which run after the ordered files, and 90_grants.sql gives the same rights
-- again each time it runs. So each line here acts only on an object that exists. On a database
-- that already holds the views, the rights arrive with this file and not at the next apply.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DO $$
DECLARE
  v_view text;
BEGIN
  IF to_regnamespace('api') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA api TO gabriel_app, gabriel_agent, gabriel_research';

  FOREACH v_view IN ARRAY ARRAY['entity','relation','proposal','document','job'] LOOP
    IF to_regclass('api.' || v_view) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT ON api.%I TO gabriel_app, gabriel_agent, gabriel_research', v_view);
    END IF;
  END LOOP;

  IF to_regprocedure('api.neighbourhood(uuid,int)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION api.neighbourhood(uuid,int) '
            'TO gabriel_app, gabriel_agent, gabriel_research';
  END IF;
END
$$;

RESET ROLE;
