-- =============================================================================================
-- 20 — the read surface                                                            RE-RUNNABLE
--
-- ONE VIEW PER CONCEPT, NEVER PER SURFACE. docs/spec.md §4 and ADR 0003 §6. A surface-shaped
-- view multiplies with the user interface; a concept-shaped one does not.
--
-- DROP then CREATE, and never CREATE OR REPLACE. Measured: CREATE OR REPLACE VIEW appends only
-- and fails with `cannot drop columns from view` on every existing database. db/apply/ is not
-- versioned, so the only recovery would be a manual drop or a full reset.
--
-- NO VIEW CARRIES `security_invoker`. ADR 0003 §6 asks for it and also gives gabriel_read
-- nothing on `public`. Measured on 19 August 2026: the two rules delete each other and the read
-- returns `permission denied for table`. #95 owns the amendment. Until it answers, these views
-- run with the rights of their owner, and 90_grants.sql is the guard that makes that safe.
--
-- KNOWN LIMIT, AND IT IS NOT A TIER. PostgreSQL reports EVERY view column as nullable, so the
-- generated contract promises a value that can be absent. Measured on #26 and again on #93. No
-- line of SQL here repairs it. #95 and #41 own it.
-- =============================================================================================

SET ROLE gabriel_owner;

-- ------------------------------------------------------------------------------------------
DROP VIEW IF EXISTS api.full_map;
DROP VIEW IF EXISTS api.full_graph;
DROP VIEW IF EXISTS api.layout;
DROP VIEW IF EXISTS api.job;
DROP VIEW IF EXISTS api.key_usage;
DROP VIEW IF EXISTS api.value_support;
DROP VIEW IF EXISTS api.proposal;
DROP VIEW IF EXISTS api.relation;
DROP VIEW IF EXISTS api.entity;
DROP VIEW IF EXISTS api.entity_type;
DROP VIEW IF EXISTS api.document;


CREATE VIEW api.document AS
  SELECT id, kind, title, uri, archive_uri, sha256, mime, retrieved_at,
         admiralty, admiralty_origin, created_at
    FROM public.documents;
-- s3_key is not published. The bucket is private, and #31 owns how a reader reaches a file.
COMMENT ON VIEW api.document IS
  'One row per source. The raw file stays in the object store; this is the reference. The '
  'ADMIRALTY rating is a score of the SOURCE and never of a claim (S1): one document holds a '
  'corroborated fact and a rumour at the same score.';


CREATE VIEW api.entity_type AS
  SELECT key, label, colour_light, colour_dark, ord, retired FROM public.entity_type;
COMMENT ON VIEW api.entity_type IS
  'The closed list of entity types. Filter retired=is.false for the live vocabulary. Two hues '
  'and not one: a single hex value fails one of the two pages. A map takes colour_dark on both '
  'themes, because its ground is imagery.';


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
  'on the THING and not on a value; what each of the two asserts is open on #86. '
  'proposed_type carries the extracted word when it was not a live type.';


CREATE VIEW api.relation AS
  SELECT id, type, src_kind, src_id, dst_kind, dst_id, valid_from, valid_to,
         attrs, sources, promoted_from, created_at, updated_at
    FROM public.relations;
COMMENT ON VIEW api.relation IS
  'A relation. It states its claim in its own columns — the type and the two ends — and it may '
  'carry no attribute at all, so `sources` is often the only evidence it has. An interval is '
  'reserved for identity and ownership types (M6). src_kind and dst_kind may say relation: '
  'nothing writes that today and nothing prevents it (M4).';


CREATE VIEW api.proposal AS
  SELECT id, op, target_kind, target_id, payload, src, names, prior_value,
         confidence, dissent, author_role, status, created_at, decided_at, decided_by
    FROM public.proposals;
COMMENT ON VIEW api.proposal IS
  'The candidate layer AND the record of every change; `status` tells them apart. '
  'prior_value HOLDS ONLY WHAT THE ACT REPLACED — the keys an update named, or the whole row a '
  'delete destroyed. An absent key does NOT mean the value was removed: the live row still '
  'holds it. `names` lists the other elements the act touches. author_role is the connection '
  'role and never a person, and decided_by is NEVER proof of a human decision. Do not count '
  'acts beside a claim: six acts on one key are not six confirmations (S3).';


-- READ 5, AND IT REPLACES A TABLE. "Which values does this document hold up" is the mechanism
-- S1 calls central when a rating moves. The #97 proposal made this a mirror table kept by four
-- triggers; it is a view, because a fact must not have a second home.
-- A row with attr_key IS NULL is the source list of the ROW ITSELF, not of a value.
CREATE VIEW api.value_support AS
      SELECT 'entity'::text AS owner_kind, e.id AS owner_id, e.label AS owner_label,
             s.doc AS doc_id, c.key AS attr_key, c.val -> 'v' AS value
        FROM public.entities e
        CROSS JOIN LATERAL jsonb_each(e.attrs) AS c(key, val)
        CROSS JOIN LATERAL jsonb_array_elements_text(c.val -> 'src') AS s(doc)
UNION ALL
      SELECT 'entity', e.id, e.label, d, NULL, NULL
        FROM public.entities e CROSS JOIN LATERAL unnest(e.sources) AS d
UNION ALL
      SELECT 'relation', r.id, r.type, s.doc, c.key, c.val -> 'v'
        FROM public.relations r
        CROSS JOIN LATERAL jsonb_each(r.attrs) AS c(key, val)
        CROSS JOIN LATERAL jsonb_array_elements_text(c.val -> 'src') AS s(doc)
UNION ALL
      SELECT 'relation', r.id, r.type, d, NULL, NULL
        FROM public.relations r CROSS JOIN LATERAL unnest(r.sources) AS d;
COMMENT ON VIEW api.value_support IS
  'Which PUBLISHED values a document holds up. Filter on doc_id when an ADMIRALTY rating moves. '
  'It carries the value itself and not only the key, so the answer shows the figures. '
  'attr_key IS NULL marks the source list of the ROW, not of a value. For the CANDIDATE claims '
  'that cite the same document, read api.proposal with src=cs.{the id}.';


-- THE MONITORING VIEW M11 ASKED FOR, AND NOW THE WHOLE OF WHAT M11 LEFT. There is no vocabulary
-- table and no rule on a key beyond its shape, so this view is the only thing that shows which
-- keys the record carries. Two spellings of one concept stand side by side here, and reading it
-- is the only way anybody finds them.
--
-- IT READS BOTH TABLES THAT CARRY ATTRIBUTES. A view over entities alone would leave a key
-- written on a relation invisible, and a worklist with a hole is not a worklist.
CREATE VIEW api.key_usage AS
  WITH used AS (
    SELECT 'entity' AS owner_kind, e.type AS owner_type, ok.key
      FROM public.entities e
      CROSS JOIN LATERAL jsonb_object_keys(e.attrs) AS ok(key)
    UNION ALL
    SELECT 'relation', r.type, ok.key
      FROM public.relations r
      CROSS JOIN LATERAL jsonb_object_keys(r.attrs) AS ok(key)
  )
  SELECT u.key, u.owner_kind, u.owner_type, count(*) AS claims
    FROM used u
   GROUP BY u.key, u.owner_kind, u.owner_type;
COMMENT ON VIEW api.key_usage IS
  'Every attribute key in use, on an entity or on a relation, with how often it is used and by '
  'which type. Nothing declares a key, so this is the one place a semantic duplicate — '
  'coal_stock beside coal_stock_tonnes — becomes visible. A low count is a typo. M11 accepted '
  'that this makes the drift visible and prevents none of it. Read it periodically.';

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


-- THE QUEUE IS READABLE, OR IT HOLDS A STATE NOBODY CAN SEE. A row stuck in `running` is the
-- one thing the operator must be able to find, and the release door acts on the same rows.
-- It publishes no payload: a job carries an identifier, a state and the history of its claims.
CREATE VIEW api.job AS
  SELECT id, document_id, status, attempts, claimed_by, claimed_at
    FROM public.jobs;
COMMENT ON VIEW api.job IS
  'One unit of work behind the ingestion door, and one row per document that entered it. '
  'A hand-entered source queues nothing, so this is not the whole record of what passed the '
  'door. claimed_by is the CONNECTION ROLE that took the row and never a person or a process. '
  '`attempts` counts every claim, including the ones a lease released, so it counts what was '
  'taken and never what was tried.';

-- THE TWO READS THAT RETURN EVERY ROW, AND HOW THEY ESCAPE THE ROW CEILING. PostgREST caps rows
-- per role and never per view, so the one read role carries no row cap at all, and there is no
-- second role. The guard is time alone: statement_timeout on that role stops a read that runs away.
CREATE VIEW api.full_graph AS
  SELECT e.id, e.type, e.label, l.x, l.y
    FROM api.entity e
    LEFT JOIN api.layout l ON l.entity_id = e.id;
COMMENT ON VIEW api.full_graph IS
  'Every entity of the graph with the position the graph draws it at, in one read. The edges '
  'come from api.relation, which returns every relation under the same rule. Read '
  'api.layout for the meaning of a null position.';


CREATE VIEW api.full_map AS
  SELECT id, type, label, geom FROM api.entity WHERE geom IS NOT NULL;
COMMENT ON VIEW api.full_map IS
  'Every entity that carries a geometry, which is every entity the map can draw. The type is '
  'here because the layer panel filters on it. A geometry that is not a point still arrives, '
  'and a surface that draws a dot reads it as no position at all.';

RESET ROLE;
