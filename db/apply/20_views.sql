-- =============================================================================================
-- 20 — the read surface                                                            RE-RUNNABLE
--
-- ONE VIEW PER CONCEPT, NEVER PER SURFACE. docs/spec.md and ADR 0003. A surface-shaped
-- view multiplies with the user interface; a concept-shaped one does not.
--
-- DROP then CREATE, and never CREATE OR REPLACE. Measured: CREATE OR REPLACE VIEW appends only
-- and fails with `cannot drop columns from view` on every existing database. db/apply/ is not
-- versioned, so the only recovery would be a manual drop or a full reset.
--
-- NO VIEW CARRIES `security_invoker`. The option checks the base table with the rights of the
-- caller, and gabriel_read holds nothing on `public`, so it refuses the read as well as the
-- write. Measured on 19 August 2026: with the option, `permission denied for table`; without it,
-- the rows. A view runs with the rights of its owner, and 90_grants.sql's blanket REVOKE is the
-- only guard.
--
-- KNOWN LIMIT, AND IT IS NOT A TIER. PostgreSQL reports EVERY view column as nullable, so the
-- generated contract promises a value that can be absent. No line of SQL here repairs it.
-- =============================================================================================

SET ROLE gabriel_owner;

-- ------------------------------------------------------------------------------------------
DROP VIEW IF EXISTS api.full_map;
DROP VIEW IF EXISTS api.layout;
DROP VIEW IF EXISTS api.job;
DROP VIEW IF EXISTS api.proposal;
DROP VIEW IF EXISTS api.relation;
DROP VIEW IF EXISTS api.entity;
DROP VIEW IF EXISTS api.relation_type;
DROP VIEW IF EXISTS api.entity_type;
DROP VIEW IF EXISTS api.document;
DROP VIEW IF EXISTS api.document_provider;


CREATE VIEW api.document AS
  SELECT id, kind, title, uri, archive_uri, sha256, mime, retrieved_at,
         admiralty, admiralty_origin, created_at, cost_eur
    FROM public.documents;
-- s3_key is not published. The bucket is private, and #31 owns how a reader reaches a file.
COMMENT ON VIEW api.document IS
  'One row per source. The raw file stays in the object store; this is the reference. The '
  'ADMIRALTY rating is a score of the SOURCE and never of a claim (S1): one document holds a '
  'corroborated fact and a rumour at the same score.';


CREATE VIEW api.document_provider AS
  SELECT id, name, licence FROM public.document_provider;
COMMENT ON VIEW api.document_provider IS
  'The providers that distribute the bytes of a document, and the licence each one gives. The '
  'licence belongs to the provider and never to one fetch. A document with no provider is '
  'internal.';


CREATE VIEW api.entity_type AS
  SELECT key, label, colour_light, colour_dark, ord, retired FROM public.entity_type;
COMMENT ON VIEW api.entity_type IS
  'The closed list of entity types. Filter retired=is.false for the live vocabulary. Two hues '
  'and not one: a single hex value fails one of the two pages. A map takes colour_dark on both '
  'themes, because its ground is imagery.';


CREATE VIEW api.relation_type AS
  SELECT key, label, inverse_label, takes_interval, retired FROM public.relation_type;
COMMENT ON VIEW api.relation_type IS
  'The closed list of relation types. Filter retired=is.false for the live vocabulary. A relation '
  'is stored in one direction only: label reads it from its source, and inverse_label from its '
  'far end. takes_interval says whether valid_from and valid_to may be set (M6).';


CREATE VIEW api.entity AS
  SELECT id, type, proposed_type, label,
         -- GeoJSON, never raw. PostgREST serialises a PostGIS geometry as hex EWKB, and
         -- src/features/map/projection.ts narrows on `geom !== null`, which a hex string passes.
         public.ST_AsGeoJSON(geom)::jsonb AS geom,
         attrs, sources, promoted_from, created_at, updated_at
    FROM public.entities;
COMMENT ON VIEW api.entity IS
  'An entity. `attrs` holds every attribute as {"key": {"v": value, "src": [document ids]}} — '
  'the value and the documents that hold it up, in one row, with no join. `sources` is the list '
  'on the THING and not on a value: it backs the label, the type and the geom of the row, and no '
  'attribute''s value. '
  'proposed_type carries the extracted word when it was not a live type.';


CREATE VIEW api.relation AS
  SELECT id, type, proposed_type, src_kind, src_id, dst_kind, dst_id, valid_from, valid_to,
         attrs, sources, promoted_from, created_at, updated_at
    FROM public.relations;
COMMENT ON VIEW api.relation IS
  'A relation. It states its claim in its own columns — the type and the two ends — and it may '
  'carry no attribute at all, so `sources` is often the only evidence it has. An interval is '
  'reserved for the types that take one in api.relation_type (M6). src_kind and dst_kind may say '
  'relation: nothing writes that today and nothing prevents it (M4). proposed_type carries the '
  'extracted word when it was not a live type.';


CREATE VIEW api.proposal AS
  SELECT id, op, target_kind, target_id, payload, src, names, prior_value,
         confidence, dissent, author_role, model_call_id, status, created_at, decided_at,
         decided_by
    FROM public.proposals
   -- PU1: a rejected act is not public. The public read role and any role that this list does
   -- not name see no rejected row, so the rule fails closed. current_user in a view is the role
   -- that reads it, and not the owner of the view.
   WHERE status <> 'rejected'
      OR current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research');
COMMENT ON VIEW api.proposal IS
  'The candidate layer AND the record of every change; `status` tells them apart. The public '
  'read shows no rejected act. '
  'prior_value HOLDS ONLY WHAT THE ACT REPLACED — the keys an update named, or the whole row a '
  'delete destroyed. An absent key does NOT mean the value was removed: the live row still '
  'holds it. `names` lists the other elements the act touches. author_role is the connection '
  'role and never a person. model_call_id names the call that made a machine act. It is NULL '
  'for an act of the operator and for a machine act older than the call record. decided_by is '
  'NEVER proof of a human decision. Do not count '
  'acts beside a claim: six acts on one key are not six confirmations (S3).';


-- ONE ROW PER ENTITY, AND NOT ONE ROW PER STORED POSITION. An entity the last layout run did not
-- place carries NULL here, which is not an error: the surface places it itself and the next run
-- gives it a stored position.
CREATE VIEW api.layout AS
  SELECT e.id AS entity_id, l.x, l.y
    FROM public.entities e
    LEFT JOIN public.entity_layout l ON l.entity_id = e.id;
COMMENT ON VIEW api.layout IS
  'Where the graph draws each entity. A position is presentation and never data: it is derived '
  'from the record, no source holds it up, and a rating that moves does not touch it. x and y '
  'are NULL for an entity the last run did not place, and the surface then places that entity '
  'itself. Every position of one run belongs beside the others of the same run.';


-- Departure: the queue is readable by the tool roles, or a row stuck in `running` is a state
-- nobody can find. The public read role does not read it (90_grants.sql). It shows no payload: a job carries an identifier, a state, the history of its claims,
-- and the reason and the hour it ended.
CREATE VIEW api.job AS
  SELECT id, document_id, status, attempts, claimed_by, claimed_at, failure_reason, finished_at
    FROM public.jobs;
COMMENT ON VIEW api.job IS
  'One unit of work behind the ingestion door, and one row per document that entered it. '
  'A hand-entered source queues nothing, so this is not the whole record of what passed the '
  'door. claimed_by is the CONNECTION ROLE that took the row and never a person or a process. '
  '`attempts` counts every claim, including the ones a lease released, so it counts what was '
  'taken and never what was tried. A failed job always states its reason in '
  'failure_reason. finished_at is the hour a job ended, and NULL while it can still run.';

-- THE FILTER IS GONE, AND THE ROW COUNT IS NOW EVERY ENTITY. An entity that states
-- `position_precision` = `inherited` carries no geometry of its own. A filter on the geometry
-- hid the very rows this view exists to place.
--
-- THE COST WAS MEASURED, ON 9 SEPTEMBER 2026, IN A TRANSACTION THAT ROLLED BACK. 10,027
-- entities and 9,999 `subordinate_to` relations, of which 7,996 rows took an inherited point:
-- 145 to 155 ms. ADR 0008 measured the shape this one replaces, and the statement timeout of
-- five seconds is the only bound either one has.
--
-- THE WALK STANDS HERE AND NOT IN A FUNCTION, AND THAT WAS MEASURED. #126 asked for a function
-- of the shape of `api.neighbourhood`. A function that this view calls must exist before the
-- view, so it takes a file that runs before 20. It must then read `api.entity`, which 20
-- creates. The two files each need the other: `pnpm db:reset` stopped with `relation
-- "api.entity" does not exist`, and only a database built from zero showed it. ADR 0009 records
-- the whole of it.
--
-- IT KEYS ON THE WORD AND NEVER ON A NULL GEOMETRY, and the corpus that waits measured it.
-- Every unpositioned unit has a positioned ancestor. A rule of the shape "no geometry, plus a
-- parent with a point" draws 740 units where 142 make the claim. The word is a judgement of the
-- analyst, and the graph cannot reproduce it.
--
-- FOUR HOPS, BECAUSE THE UNIT TREE IS FOUR DEEP. The 142 need three at most, so the bound has
-- margin. It is not the whole cycle guard: it stops the recursion, and the guard against an
-- entity that becomes its own parent is the test on the two identifiers below. No CHECK refuses
-- a relation from a row to itself, and none refuses a ring of three.
--
-- ONLY A POINT IS TAKEN, AT BOTH ENDS. An ancestor that carries an area is walked through, and
-- an entity that carries an area takes the inherited point over its own area. A surface that
-- draws a dot reads any other geometry as no position at all.
--
-- DISTINCT ON, AND NOT min(hop) ALONE. Two ancestors may stand at one distance, and a bare
-- min(hop) would answer with two rows for one entity. The tie is broken on the identifier, so
-- the answer is the same on every run.
--
-- A ROW MAY STILL CARRY NO POSITION, and that is not a fault. `geom` is null for an entity
-- nobody located and for one whose ancestors carry no point. A surface draws what it can.
CREATE VIEW api.full_map AS
  WITH RECURSIVE claimed AS (
    SELECT e.id FROM api.entity e WHERE e.attrs #>> '{position_precision,v}' = 'inherited'
  ),
  walk(entity_id, ancestor_id, hop) AS (
    SELECT c.id, c.id, 0 FROM claimed c
    UNION
    SELECT w.entity_id, r.dst_id, w.hop + 1
      FROM walk w
      JOIN api.relation r
        ON r.type = 'subordinate_to'
       AND r.src_kind = 'entity' AND r.dst_kind = 'entity'
       AND r.src_id = w.ancestor_id
     WHERE w.hop < 4
  ),
  inherited AS (
    SELECT DISTINCT ON (w.entity_id)
           w.entity_id, w.ancestor_id AS parent_id, a.geom
      FROM walk w
      JOIN api.entity a ON a.id = w.ancestor_id
     WHERE w.hop > 0
       AND w.ancestor_id <> w.entity_id
       AND a.geom->>'type' = 'Point'
     ORDER BY w.entity_id, w.hop, w.ancestor_id
  )
  SELECT e.id, e.type, e.label,
         CASE WHEN e.geom->>'type' = 'Point' THEN e.geom
              ELSE coalesce(i.geom, e.geom) END AS geom,
         e.attrs #>> '{position_precision,v}' AS position_precision,
         CASE WHEN e.geom->>'type' = 'Point' THEN NULL ELSE i.parent_id END AS parent_id
    FROM api.entity e
    LEFT JOIN inherited i ON i.entity_id = e.id;
COMMENT ON VIEW api.full_map IS
  'Every entity, with the point the map draws it at. `geom` is the own point of the entity, or '
  'the point of the nearest ancestor through subordinate_to when position_precision is '
  'inherited. parent_id names that ancestor, and it is null when the entity stands at its own '
  'point. A null geom is an entity the map cannot place. The word is a claim of the analyst. It '
  'may be absent, and a surface must then draw the cautious state and never a measured one.';

RESET ROLE;
