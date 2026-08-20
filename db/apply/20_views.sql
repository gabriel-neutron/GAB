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
DROP VIEW IF EXISTS api.key_usage;
DROP VIEW IF EXISTS api.value_support;
DROP VIEW IF EXISTS api.proposal;
DROP VIEW IF EXISTS api.relation;
DROP VIEW IF EXISTS api.entity;
DROP VIEW IF EXISTS api.attribute_key;
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


CREATE VIEW api.attribute_key AS
  SELECT key, stem, kind, label, unit, pattern, retired FROM public.attribute_key;
COMMENT ON VIEW api.attribute_key IS
  'The closed list of attribute keys. READ THIS BEFORE READING ANY attrs: it declares what each '
  'key means, the kind of its value, its unit and its format. Never infer a type from the shape '
  'of a value — 9482137 is an IMO identifier and not a quantity. `stem` is the concept, so two '
  'keys can never name one concept.';


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
             s.doc AS doc_id, c.key AS attr_key, k.label AS key_label, k.kind, k.unit,
             c.val -> 'v' AS value
        FROM public.entities e
        CROSS JOIN LATERAL jsonb_each(e.attrs) AS c(key, val)
        CROSS JOIN LATERAL jsonb_array_elements_text(c.val -> 'src') AS s(doc)
        LEFT JOIN public.attribute_key k ON k.key = c.key
UNION ALL
      SELECT 'entity', e.id, e.label, d, NULL, NULL, NULL, NULL, NULL
        FROM public.entities e CROSS JOIN LATERAL unnest(e.sources) AS d
UNION ALL
      SELECT 'relation', r.id, r.type, s.doc, c.key, k.label, k.kind, k.unit, c.val -> 'v'
        FROM public.relations r
        CROSS JOIN LATERAL jsonb_each(r.attrs) AS c(key, val)
        CROSS JOIN LATERAL jsonb_array_elements_text(c.val -> 'src') AS s(doc)
        LEFT JOIN public.attribute_key k ON k.key = c.key
UNION ALL
      SELECT 'relation', r.id, r.type, d, NULL, NULL, NULL, NULL, NULL
        FROM public.relations r CROSS JOIN LATERAL unnest(r.sources) AS d;
COMMENT ON VIEW api.value_support IS
  'Which PUBLISHED values a document holds up. Filter on doc_id when an ADMIRALTY rating moves. '
  'It carries the value itself and not only the key, so the answer shows the figures. '
  'attr_key IS NULL marks the source list of the ROW, not of a value. For the CANDIDATE claims '
  'that cite the same document, read api.proposal with src=cs.{the id}.';


-- The monitoring view M11 asked for. It survives the vocabulary as a backstop, because the
-- database stops every program from drifting and cannot stop a person who declares two stems
-- for one concept.
CREATE VIEW api.key_usage AS
  SELECT k.key, k.stem, k.kind, k.unit, k.retired, e.type AS entity_type, count(*) AS claims
    FROM public.entities e
    CROSS JOIN LATERAL jsonb_object_keys(e.attrs) AS ok(key)
    JOIN public.attribute_key k ON k.key = ok.key
   GROUP BY k.key, k.stem, k.kind, k.unit, k.retired, e.type;
COMMENT ON VIEW api.key_usage IS
  'How often each declared key is used, by entity type. A low count is a typo or a semantic '
  'duplicate that survived the vocabulary. Read it periodically.';

RESET ROLE;
