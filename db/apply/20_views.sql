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
DROP VIEW IF EXISTS api.relation;
DROP VIEW IF EXISTS api.entity;
DROP VIEW IF EXISTS api.proposal;
DROP VIEW IF EXISTS api.dataset;
DROP VIEW IF EXISTS api.relation_type;
DROP VIEW IF EXISTS api.entity_type;
DROP VIEW IF EXISTS api.document;
DROP VIEW IF EXISTS api.document_provider;
DROP VIEW IF EXISTS public.proposal_reading;
DROP VIEW IF EXISTS public.person_ref;
DROP VIEW IF EXISTS public.public_document;


-- ---------------------------------------------------------------------- PU1, a person fact ---
-- THE RULING OF 9 OCTOBER 2026. A fact about a person is public only when at least one of its
-- cited sources is a public document. A fact about a person is an attribute of a person, or a
-- relation that names a person. A person with no public source is not public at all.
--
-- THE PUBLIC READ ROLE HIDES THE FACT, AND THE RECORD KEEPS IT. The views below show every row
-- to the three roles that run a tool, and the review doors of the operator read the base tables.
-- Every other role sees the filtered read, so the rule fails closed. current_user in a view is
-- the role that reads it, and not the owner of the view.
--
-- THE HELPER VIEWS STAND IN public, AND NO ROLE HOLDS A GRANT ON THEM. An api view reads
-- them with the rights of its owner. A function cannot do it: a function that a view calls runs
-- with the rights of the caller, and gabriel_read holds nothing on public.

-- A PUBLIC DOCUMENT IS ONE THAT ANYONE CAN OPEN AT A PUBLIC ADDRESS: a web page (`url`), a
-- public registry or API (`api`), or a file that the operator uploaded (`file`), each with its
-- address. The ruling of 9 October 2026 after #403: a file that the operator uploads comes from
-- the Internet, and the upload refuses it with no address. An old upload with no address stays
-- not public, so the rule fails closed. A load report and a hand-entered value are not public. A
-- bought file is not public. A document is a bought file when it has a cost, or when its provider
-- sells its filings: a NULL cost means that the cost is unknown, and not that the file is free.
CREATE VIEW public.public_document AS
  SELECT d.id FROM public.documents d
   WHERE d.kind IN ('url','api','file')
     AND btrim(coalesce(d.uri, ''), E' \t\n\r\f\v') <> ''
     AND coalesce(d.cost_eur, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM public.document_provider v
                      WHERE v.id = d.provider_id AND v.licence = 'paid-filing');

-- EACH IDENTIFIER THAT NAMES A PERSON, AND WHETHER THAT PERSON IS PUBLIC (`open`). A person is:
-- a live entity of the type `person`; the entity that an act proposes as a person, before or
-- after its promotion (a batch gives the act the identifier of the entity it will make, so a
-- relation of the same batch names it); an entity that an accepted act retyped to or from
-- `person`; and a person that an accepted act deleted, because the older acts on that person
-- still name it. The accepted acts are the ones that the change log of a row holds, so this
-- test reads an index and not every act.
-- A retyped entity stays a person here, so an older act cannot show what the rule hid.
-- A person is public when one of the sources of its row is a public document: the live row, the
-- row that a delete destroyed, or else the row that the act will make (payload.sources when the
-- act gives it, or the sources of the act). An identifier can show more than one time, always
-- with the same answer, so a reader asks whether a row exists and never counts the rows.
CREATE VIEW public.person_ref AS
  WITH ref AS (
    SELECT e.id FROM public.entities e WHERE e.type = 'person'
    UNION ALL
    SELECT p.id FROM public.proposals p
     WHERE p.op = 'create_entity' AND p.payload->>'type' = 'person'
    UNION ALL
    SELECT p.target_id FROM public.proposals p
     WHERE p.status = 'accepted' AND p.target_kind = 'entity'
       AND p.op IN ('update_entity', 'delete_entity')
       AND (p.payload->>'type' = 'person' OR p.prior_value->>'type' = 'person'))
  SELECT ref.id,
         CASE WHEN e.id IS NOT NULL THEN
                EXISTS (SELECT 1 FROM public.public_document d WHERE d.id = ANY (e.sources))
              WHEN EXISTS (SELECT 1 FROM public.proposals x
                            WHERE x.op = 'delete_entity' AND x.status = 'accepted'
                              AND x.target_id = ref.id) THEN
                EXISTS (SELECT 1 FROM public.proposals x
                          CROSS JOIN LATERAL jsonb_array_elements_text(
                                       CASE jsonb_typeof(x.prior_value->'sources')
                                            WHEN 'array' THEN x.prior_value->'sources'
                                            ELSE '[]'::jsonb END) s(id)
                          JOIN public.public_document d ON d.id = s.id
                         WHERE x.op = 'delete_entity' AND x.status = 'accepted'
                           AND x.target_id = ref.id)
              ELSE
                EXISTS (SELECT 1 FROM public.proposals x
                          JOIN public.public_document d
                            ON d.id = ANY (
                                 CASE WHEN jsonb_typeof(x.payload->'sources') = 'array'
                                      THEN ARRAY(SELECT jsonb_array_elements_text(
                                                          x.payload->'sources'))::doc_id[]
                                      ELSE x.src END)
                         WHERE x.id = ref.id AND x.op = 'create_entity')
         END AS open
    FROM ref
    LEFT JOIN public.entities e ON e.id = ref.id;

-- HOW THE READER SEES EACH ACT: `whole` as the record holds it, `part` with only the values
-- that cite a public document, or `none`. A tool role reads every act whole, and so does every
-- reader for an act that names no person. An act that names a person is `part` when each person
-- that it names is public and its citation holds a public document, and else `none`. The
-- citation of an act that makes a row is the list of sources that it gives the row, when it
-- gives one, because the promotion copies that list to the row. The elements that an act names
-- are its own row when it makes an entity, its target, the other elements in `names`, the two
-- ends of a relation that it makes, changes or deleted, and the two ends of the live relation
-- that it targets. api.proposal reads this view by the identifier of the act, so that it stays
-- a view of one table, and a write through the read API stays a refusal.
CREATE VIEW public.proposal_reading AS
  SELECT p.id,
         CASE WHEN current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
                OR NOT k.person THEN 'whole'
              WHEN k.open
               AND EXISTS (
                     SELECT 1 FROM public.public_document d
                      WHERE d.id = ANY (
                              CASE WHEN p.op IN ('create_entity', 'create_relation')
                                        AND jsonb_typeof(p.payload->'sources') = 'array'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(
                                                       p.payload->'sources'))::doc_id[]
                                   ELSE p.src END)) THEN 'part'
              ELSE 'none'
         END AS reading
    FROM public.proposals p
   CROSS JOIN LATERAL (
     SELECT ARRAY(SELECT x::uuid
                    FROM unnest(ARRAY[p.payload->>'src_id', p.payload->>'dst_id',
                                      p.prior_value->>'src_id', p.prior_value->>'dst_id']) x
                   WHERE pg_input_is_valid(x, 'uuid'))
            || p.names
            || CASE WHEN p.op = 'create_entity' THEN ARRAY[p.id] ELSE '{}'::uuid[] END
            || CASE WHEN p.target_kind = 'entity' THEN ARRAY[p.target_id]
                    ELSE '{}'::uuid[] END
            || coalesce((SELECT ARRAY[l.src_id, l.dst_id] FROM public.relations l
                          WHERE p.target_kind = 'relation' AND l.id = p.target_id),
                        '{}'::uuid[]) AS named
   ) AS m
   CROSS JOIN LATERAL (
     SELECT count(*) > 0 AS person, coalesce(bool_and(r.open), true) AS open
       FROM public.person_ref r
      WHERE r.id = ANY (m.named)
   ) AS k;


CREATE VIEW api.document AS
  SELECT id, kind, title, uri, archive_uri, sha256, mime, retrieved_at, created_at, cost_eur
    FROM public.documents;
-- s3_key is not published. The bucket is private, and #31 owns how a reader reaches a file.
COMMENT ON VIEW api.document IS
  'One row per source. The raw file stays in the object store; this is the reference.';


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


CREATE VIEW api.proposal AS
  SELECT id, op, target_kind, target_id,
         -- PU1: in an act about a person, a value that cites no public document is not public.
         CASE WHEN NOT payload ? 'attrs'
                OR (SELECT r.reading FROM public.proposal_reading r WHERE r.id = p.id) = 'whole'
              THEN payload
              ELSE jsonb_set(payload, '{attrs}',
                (SELECT coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
                   FROM jsonb_each(payload->'attrs') AS a(key, value)
                  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.value->'src') s(id)
                                  JOIN public.public_document d ON d.id = s.id)))
         END AS payload,
         src, names,
         -- The same rule for what the act replaced. A deleted row is public only when one of its
         -- own sources is a public document.
         CASE WHEN prior_value IS NULL
                OR (SELECT r.reading FROM public.proposal_reading r WHERE r.id = p.id) = 'whole'
              THEN prior_value
              WHEN op IN ('update_attrs', 'update_relation') THEN
                (SELECT coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
                   FROM jsonb_each(prior_value) AS a(key, value)
                  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.value->'src') s(id)
                                  JOIN public.public_document d ON d.id = s.id))
              WHEN NOT EXISTS (
                     SELECT 1 FROM jsonb_array_elements_text(
                                     CASE jsonb_typeof(prior_value->'sources')
                                          WHEN 'array' THEN prior_value->'sources'
                                          ELSE '[]'::jsonb END) s(id)
                       JOIN public.public_document d ON d.id = s.id) THEN NULL
              WHEN NOT prior_value ? 'attrs' THEN prior_value
              ELSE jsonb_set(prior_value, '{attrs}',
                (SELECT coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
                   FROM jsonb_each(prior_value->'attrs') AS a(key, value)
                  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.value->'src') s(id)
                                  JOIN public.public_document d ON d.id = s.id)))
         END AS prior_value,
         dissent, author_role, model_call_id, status, created_at, decided_at,
         decided_by, decided_as, batch_id, proposer,
         -- S1: the origin of a rule carries the inputs of the rule, and they hold rating digits.
         -- A role outside the tool roles gets the name and the version of the rule only.
         CASE WHEN current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
              THEN decision_origin
              ELSE coalesce(substring(decision_origin FROM '^(rule [a-z_]+ v[0-9]+)'),
                            decision_origin)
         END AS decision_origin,
         -- PU1: the label of the claim, in fixed words that depend only on who decided it, and
         -- the day of the decision in UTC. The label of a rule keeps the name and the version
         -- only (S1). A decision older than the origin column is a decision of the operator, as
         -- the review reads it. An origin that this list does not know never reads as a person:
         -- it gets the cautious words of a candidate, with no day. A rejected act is not a
         -- public claim and has no label.
         CASE
           WHEN status = 'pending' THEN 'Proposed — not checked'
           WHEN status <> 'accepted' THEN NULL
           WHEN decision_origin ~ '^rule [a-z_]+ v[0-9]+( |$)' THEN
             'Accepted by rule ' || substring(decision_origin FROM '^rule ([a-z_]+ v[0-9]+)')
             || ' — no person read it, on '
             || to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
           WHEN decision_origin = 'decided by an AI reviewer' THEN
             'Accepted by an AI reviewer — no person read it, on '
             || to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
           WHEN decision_origin IS NULL
             OR decision_origin = 'validated manually by the operator' THEN
             'Validated manually by the operator, on '
             || to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
           ELSE 'Proposed — not checked'
         END AS origin_label
    FROM public.proposals p
   -- PU1: a rejected act is not public. The public read role and any role that this list does
   -- not name see no rejected row, so the rule fails closed. current_user in a view is the role
   -- that reads it, and not the owner of the view.
   WHERE (status <> 'rejected'
          OR current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research'))
     -- PU1: an act about a person is public only when each person that it names is public and
     -- its citation holds a public document.
     AND (SELECT r.reading FROM public.proposal_reading r WHERE r.id = p.id) <> 'none';
COMMENT ON VIEW api.proposal IS
  'The candidate layer AND the record of every change; `status` tells them apart. The public '
  'read shows no rejected act. It shows an act about a person only when its citation holds a '
  'public document and each person that it names is public, and in that act it shows only the '
  'values that cite a public document (PU1). '
  'prior_value HOLDS ONLY WHAT THE ACT REPLACED — the keys an update named, or the whole row a '
  'delete destroyed. An absent key does NOT mean the value was removed: the live row still '
  'holds it. `names` lists the other elements the act touches. author_role is the connection '
  'role and never a person. model_call_id names the call that made a machine act. It is NULL '
  'for an act of the operator and for a machine act older than the call record. batch_id joins '
  'the acts of a machine that name each other: it is a label and a filter, and the operator '
  'decides one entity with its relations. A single act has none. proposer names who proposed '
  'the act: extractor, research_ai, v1_import or operator. decided_as says how the operator '
  'decided the act: one unit, one relation, or a group action, or a named rule; an older '
  'decision and an act that the operator signed have none. decision_origin says who or what '
  'decided: the name and the version of a rule, "validated manually by the operator", or '
  '"decided by an AI reviewer"; an older decision has none. The public read gets the name and '
  'the version of a rule only, and not the inputs of the rule. origin_label is the label of the '
  'claim for a reader: fixed words that tell who decided it, and the day. It shows no rating. '
  'A copy of a row copies its label. The reason of a rejection is private. decided_by is '
  'NEVER proof of a human decision. Do not count '
  'acts beside a claim: six acts on one key are not six confirmations (S3).';


-- PU1: the disclaimer of the dataset. The read API gives it beside the data, so that a reader
-- of the API gets it, and an export file copies it. The text is the exact text of the operator.
-- The two links stay placeholders until the operator names them. The lines are long because
-- the text is one literal, word for word.
CREATE VIEW api.dataset AS
  SELECT $disclaimer$**About this data.** A machine reads public documents and proposes each claim. Each claim cites the documents that state it, and each claim carries a label that tells who decided it.

- **Proposed — not checked:** a candidate. No rule and no person checked it. It is not evidence.
- **Accepted by rule … — no person read it:** the claim passed a named rule on its cited sources. No person read it. Nobody has measured the accuracy of the rules yet.
- **Accepted by an AI reviewer — no person read it:** an AI checked the claim. No person read it.
- **Validated manually by the operator:** the operator read the sources and accepted the claim.

A claim tells what its sources say. A source can be wrong. GAB gives no personal data about a person beyond what a cited source already publishes. Each row carries its label: when you copy a row, copy its label with it.

Report an error: `<link>`. Right of reply: `<link>`.$disclaimer$::text AS disclaimer;
COMMENT ON VIEW api.dataset IS
  'One row: the disclaimer of the dataset, in Markdown. Each export file of the data carries it, '
  'and each row of the export carries its label.';


-- PU1: each claim carries its label. The row takes the label of the last accepted act that set
-- its name and type (update_entity), or else of the act that made it. Each value takes the label
-- of the last act that set it: a later act can change one value, and a different decider can
-- decide that act. A value that no act names (a merge) keeps the label of
-- the row. Scalar subqueries and not a join: a join makes the view not auto-updatable, and a
-- write through the read API then fails as a server fault (500) and not as a refusal (401).
CREATE VIEW api.entity AS
  SELECT e.id, e.type, e.proposed_type, e.label,
         -- GeoJSON, never raw. PostgREST serialises a PostGIS geometry as hex EWKB, and
         -- src/features/map/projection.ts narrows on `geom !== null`, which a hex string passes.
         public.ST_AsGeoJSON(e.geom)::jsonb AS geom,
         -- PU1: a value of a person that cites no public document is not public.
         CASE WHEN e.type <> 'person'
                OR current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
              THEN e.attrs
              ELSE (SELECT coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
                      FROM jsonb_each(e.attrs) AS a(key, value)
                     WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.value->'src') s(id)
                                     JOIN public.public_document d ON d.id = s.id))
         END AS attrs,
         e.sources, e.promoted_from, e.created_at, e.updated_at,
         coalesce((SELECT u.origin_label FROM api.proposal u
                    WHERE u.status = 'accepted' AND u.op = 'update_entity'
                      AND u.target_kind = 'entity' AND u.target_id = e.id
                    ORDER BY u.decided_at DESC, u.id DESC LIMIT 1),
                  (SELECT c.origin_label FROM api.proposal c WHERE c.id = e.promoted_from))
           AS origin_label,
         coalesce((SELECT jsonb_object_agg(k.key, coalesce(
                     (SELECT u.origin_label FROM api.proposal u
                       WHERE u.status = 'accepted' AND u.op = 'update_attrs'
                         AND u.target_kind = 'entity' AND u.target_id = e.id
                         AND u.payload->'attrs' ? k.key
                       ORDER BY u.decided_at DESC, u.id DESC LIMIT 1),
                     (SELECT c.origin_label FROM api.proposal c
                       WHERE c.id = e.promoted_from)))
                     FROM jsonb_each(e.attrs) AS k(key, value)
                    -- PU1: a value that the public read hides has no label either.
                    WHERE e.type <> 'person'
                       OR current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
                       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(k.value->'src') s(id)
                                    JOIN public.public_document d ON d.id = s.id)),
                  '{}'::jsonb) AS attr_labels
    FROM public.entities e
   -- PU1: a person with no public source is not public.
   WHERE e.type <> 'person'
      OR current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
      OR EXISTS (SELECT 1 FROM public.public_document d WHERE d.id = ANY (e.sources));
COMMENT ON VIEW api.entity IS
  'An entity. `attrs` holds every attribute as {"key": {"v": value, "src": [document ids]}} — '
  'the value and the documents that hold it up, in one row, with no join. `sources` is the list '
  'on the THING and not on a value: it backs the label, the type and the geom of the row, and no '
  'attribute''s value. '
  'proposed_type carries the extracted word when it was not a live type. origin_label is the '
  'label of the last accepted act that set the name and the type, or else of the act that made '
  'the row. attr_labels gives the label of each value. A copy of a row copies its labels. The '
  'public read shows a person only when one of its sources is a public document, and it shows '
  'a value of a person only when that value cites a public document (PU1).';


CREATE VIEW api.relation AS
  SELECT r.id, r.type, r.proposed_type, r.src_kind, r.src_id, r.dst_kind, r.dst_id,
         r.valid_from, r.valid_to,
         -- PU1: on a relation that names a person, a value that cites no public document is
         -- not public.
         CASE WHEN current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
                OR NOT EXISTS (SELECT 1 FROM public.person_ref p
                                WHERE p.id = ANY (ARRAY[CASE WHEN r.src_kind = 'entity' THEN r.src_id END,
                                   CASE WHEN r.dst_kind = 'entity' THEN r.dst_id END]))
              THEN r.attrs
              ELSE (SELECT coalesce(jsonb_object_agg(a.key, a.value), '{}'::jsonb)
                      FROM jsonb_each(r.attrs) AS a(key, value)
                     WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.value->'src') s(id)
                                     JOIN public.public_document d ON d.id = s.id))
         END AS attrs,
         r.sources, r.promoted_from, r.created_at, r.updated_at,
         (SELECT c.origin_label FROM api.proposal c WHERE c.id = r.promoted_from)
           AS origin_label,
         coalesce((SELECT jsonb_object_agg(k.key, coalesce(
                     (SELECT u.origin_label FROM api.proposal u
                       WHERE u.status = 'accepted' AND u.op = 'update_relation'
                         AND u.target_kind = 'relation' AND u.target_id = r.id
                         AND u.payload->'attrs' ? k.key
                       ORDER BY u.decided_at DESC, u.id DESC LIMIT 1),
                     (SELECT c.origin_label FROM api.proposal c
                       WHERE c.id = r.promoted_from)))
                     FROM jsonb_each(r.attrs) AS k(key, value)
                    -- PU1: a value that the public read hides has no label either.
                    WHERE current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
                       OR NOT EXISTS (SELECT 1 FROM public.person_ref p
                                       WHERE p.id = ANY (ARRAY[CASE WHEN r.src_kind = 'entity' THEN r.src_id END,
                                          CASE WHEN r.dst_kind = 'entity' THEN r.dst_id END]))
                       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(k.value->'src') s(id)
                                    JOIN public.public_document d ON d.id = s.id)),
                  '{}'::jsonb) AS attr_labels
    FROM public.relations r
   -- PU1: a relation that names a person is public only when one of its sources is a public
   -- document and each person that it names is public. Subqueries and not a join, as above.
   WHERE current_user IN ('gabriel_app', 'gabriel_agent', 'gabriel_research')
      OR NOT EXISTS (SELECT 1 FROM public.person_ref p
                      WHERE p.id = ANY (ARRAY[CASE WHEN r.src_kind = 'entity' THEN r.src_id END,
                         CASE WHEN r.dst_kind = 'entity' THEN r.dst_id END]))
      OR (NOT EXISTS (SELECT 1 FROM public.person_ref p
                       WHERE p.id = ANY (ARRAY[CASE WHEN r.src_kind = 'entity' THEN r.src_id END,
                          CASE WHEN r.dst_kind = 'entity' THEN r.dst_id END]) AND NOT p.open)
          AND EXISTS (SELECT 1 FROM public.public_document d WHERE d.id = ANY (r.sources)));
COMMENT ON VIEW api.relation IS
  'A relation. It states its claim in its own columns — the type and the two ends — and it may '
  'carry no attribute at all, so `sources` is often the only evidence it has. An interval is '
  'reserved for the types that take one in api.relation_type (M6). src_kind and dst_kind may say '
  'relation: nothing writes that today and nothing prevents it (M4). proposed_type carries the '
  'extracted word when it was not a live type. origin_label and attr_labels are the labels of '
  'the row and of each value, as on api.entity. The public read shows a relation that names a '
  'person only when one of its sources is a public document and each person it names is public, '
  'and it shows a value of such a relation only when that value cites a public document (PU1).';


-- ONE ROW PER ENTITY, AND NOT ONE ROW PER STORED POSITION. An entity the last layout run did not
-- place carries NULL here, which is not an error: the surface places it itself and the next run
-- gives it a stored position.
CREATE VIEW api.layout AS
  SELECT e.id AS entity_id, l.x, l.y
    -- api.entity and not the table, so a person that the public read hides has no position (PU1).
    FROM api.entity e
    LEFT JOIN public.entity_layout l ON l.entity_id = e.id;
COMMENT ON VIEW api.layout IS
  'Where the graph draws each entity. A position is presentation and never data: it is derived '
  'from the record, and no source holds it up. x and y '
  'are NULL for an entity the last run did not place, and the surface then places that entity '
  'itself. Every position of one run belongs beside the others of the same run.';


-- Departure: the queue is readable by the tool roles, or a row stuck in `running` is a state
-- nobody can find. The public read role does not read it (90_grants.sql). It shows no payload: a
-- job carries an identifier, a state, its claim, and the reason and the hour it ended. A lead and a
-- rating name no document, so this view leaves them out.
CREATE VIEW api.job AS
  SELECT id, document_id, status, claimed_by, claimed_at, failure_reason, finished_at
    FROM public.jobs
   WHERE kind NOT IN ('research_lead','rate_author');
COMMENT ON VIEW api.job IS
  'One unit of work behind the ingestion door, and one row per document that entered it. '
  'A hand-entered source queues nothing, so this is not the whole record of what passed the '
  'door. claimed_by is the CONNECTION ROLE that took the row and never a person or a process. '
  'A job fails at once, and a failed job always states its reason in failure_reason. The '
  'operator queues the document again for a new job. finished_at is the hour a job ended, and '
  'NULL while it can still run.';

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
-- an entity that carries an area takes the inherited point over its own area. A borrowed
-- position is a point, and a surface never draws it as an area.
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
         CASE WHEN e.geom->>'type' = 'Point' THEN NULL ELSE i.parent_id END AS parent_id,
         -- PU1: each public claim carries its label, also on the map read.
         e.origin_label,
         e.attr_labels->>'position_precision' AS position_precision_label
    FROM api.entity e
    LEFT JOIN inherited i ON i.entity_id = e.id;
COMMENT ON VIEW api.full_map IS
  'Every entity, with the point the map draws it at. `geom` is the own point of the entity, or '
  'the point of the nearest ancestor through subordinate_to when position_precision is '
  'inherited. parent_id names that ancestor, and it is null when the entity stands at its own '
  'point. A null geom is an entity the map cannot place. The word is a claim of the analyst. It '
  'may be absent, and a surface must then draw the cautious state and never a measured one. '
  'origin_label and position_precision_label are the labels of the row and of the word, as on '
  'api.entity.';

RESET ROLE;
