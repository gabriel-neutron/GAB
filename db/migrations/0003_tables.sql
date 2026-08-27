-- =============================================================================================
-- 0003 — the six tables                                                                ORDERED
--
-- The whole schema. Six tables, in dependency order: the sources, the two vocabularies, the
-- acts, then the graph.
--
-- TWO TABLES OF THE #97 PROPOSAL ARE DELIBERATELY ABSENT, and each is folded into something
-- smaller, on the operator's rule of 20 August 2026 — one shape, one table:
--   * the provenance mirror  -> the view api.value_support (db/apply/20_views.sql)
--   * the touched elements   -> the column proposals.names, with a GIN index
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- ============================================================================== documents ===
-- One row per source. The raw file stays in the object store and never changes (T3); this row
-- is the reference. `manual` is a real row (M8), so a hand-entered value can be scored and
-- queried like any other claim.
CREATE TABLE documents (
  id                doc_id PRIMARY KEY,
  kind              text NOT NULL
                    CHECK (kind IN ('file','url','api','report','manual')),
  title             text NOT NULL
                    CHECK (btrim(title, E' \t\n\r\f\v') <> ''),
  s3_key            text,          -- the immutable object. NULL when the source is purely external
  uri               text,          -- the original address
  archive_uri       text,          -- a web archive copy, recorded at ingest (#31)
  sha256            text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  mime              text,
  retrieved_at      date,          -- M6. A dead link proves nothing without it
  admiralty         char(2) CHECK (admiralty ~ '^[A-F][1-6]$'),
  admiralty_origin  text CHECK (admiralty_origin IN ('machine','arbitrated','human')),
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- A consultable source carries the date it was retrieved.
  CONSTRAINT doc_retrieved_required
    CHECK (kind = 'manual' OR retrieved_at IS NOT NULL),
  -- INVARIANT 6. This form never yields NULL, so it cannot pass by three-valued logic.
  -- NOTE: no role can write either column today. #19 owns the scoring write path.
  CONSTRAINT doc_admiralty_origin
    CHECK ((admiralty IS NULL) = (admiralty_origin IS NULL))
);


-- ============================================================================ entity_type ===
-- The closed list of entity types (#93). A new type is one line of db/apply/95_seed.sql and
-- never a migration. No role writes this table.
CREATE TABLE entity_type (
  key           text PRIMARY KEY
                CHECK (key = btrim(key) AND key ~ '^[a-z][a-z0-9_]*$'),
  label         text NOT NULL CHECK (btrim(label) <> ''),   -- what a screen prints
  -- TWO HUES AND NOT ONE. Measured in src/shared/entity-hues.ts: the dark set holds 7.9:1 to
  -- 8.9:1 on the dark page and 2.0:1 to 2.3:1 on the light one, so one hex value fails a page.
  -- Hex, because Sigma paints the whole graph black in silence for an hsl() colour.
  colour_light  text NOT NULL CHECK (colour_light ~ '^#[0-9a-f]{6}$'),
  colour_dark   text NOT NULL CHECK (colour_dark  ~ '^#[0-9a-f]{6}$'),
  ord           int NOT NULL DEFAULT 0,
  -- A word leaves service through this flag and is never deleted, because ON DELETE RESTRICT
  -- would otherwise make one typo permanent.
  retired       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ========================================================================== attribute_key ===
-- The closed list of attribute keys. This is the table that ends the drift M11 predicted, and
-- it is the only thing that makes a write-time format rule possible: a rule about dates cannot
-- exist while nothing says which key is a date.
CREATE TABLE attribute_key (
  key       text PRIMARY KEY
            CHECK (key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$' AND length(key) <= 63),
  -- THE CONCEPT, not the spelling. coal_stock_t and coal_stock_tonnes both declare the stem
  -- coal_stock, so the partial unique index below refuses the second declaration.
  stem      text NOT NULL
            CHECK (stem ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  kind      text NOT NULL
            CHECK (kind IN ('quantity','identifier','text','note','date','boolean','list')),
  label     text NOT NULL CHECK (btrim(label) <> ''),   -- #80 row B2: the data supplies the name
  unit      text CHECK (unit IS NULL OR btrim(unit) <> ''),  -- the printable symbol. M10 stands:
                                                             -- the KEY carries the unit of record
  pattern   text,                                        -- '^[0-9]{7}$' for an IMO number
  retired   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()

  -- THERE IS NO `group` COLUMN AND NO `ord` COLUMN, and no rule says there never will be.
  -- #80 row B1 removed the group headings; #46 leaves the order of a hundred claims unanswered.
  -- A nullable column added on the day the operator answers is one ALTER TABLE and no rewrite.
);

-- THE DRIFT RULE. One live spelling for one concept. Partial, so a retired key keeps its
-- history and releases its stem.
CREATE UNIQUE INDEX attribute_key_stem_uq ON attribute_key (stem) WHERE NOT retired;
-- And `coalstock` cannot stand beside `coal_stock`.
CREATE UNIQUE INDEX attribute_key_norm_uq
  ON attribute_key ((regexp_replace(key, '_', '', 'g')));


-- ============================================================================= proposals ====
-- THE CANDIDATE LAYER AND THE RECORD OF EVERY CHANGE, IN ONE TABLE. The status tells them
-- apart. P2 makes a proposal an operation and never a ghost entity.
--
-- There is no call_id: the agent chain is deferred. IT MUST LAND IN THE SAME CHANGE AS THE
-- FIRST AGENT, never after it — a rendered prompt cannot be re-derived, so a trail that was
-- never captured cannot be backfilled (#16).
CREATE TABLE proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op           text NOT NULL CHECK (op IN (
                 'create_entity','update_attrs','delete_entity',
                 'create_relation','update_relation','delete_relation',
                 'merge_entities')),
  target_kind  text CHECK (target_kind IS NULL OR target_kind IN ('entity','relation')),
  target_id    uuid,                       -- no foreign key: the target may since be deleted
  payload      jsonb NOT NULL,             -- the shape per op is #7, and #7 is open
  src          doc_id[] NOT NULL,          -- the documents THIS act cites
  -- The other elements this act names — the two ends of a relation, the absorbed entities of a
  -- merge. It replaces a table: one shape, one table. A GIN index makes it an index lookup.
  names        uuid[] NOT NULL DEFAULT '{}',
  -- WHAT THE ACT REPLACED, AND NOTHING ELSE. An update copies only the keys it named, because
  -- the live row still holds every other one. A delete copies the whole row it destroyed.
  prior_value  jsonb,
  confidence   numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  dissent      boolean NOT NULL DEFAULT false,
  -- A WITNESS AND NEVER AN INPUT. A trigger stamps it from session_user. Measured on #15: an
  -- agent that supplied 'gabriel_app' had 'gabriel_agent' stored instead.
  author_role  text NOT NULL CHECK (author_role IN ('gabriel_agent','gabriel_app')),
  -- Closes the measured forgery: propose and accept inside one transaction. This is NOT xmin,
  -- so it does not also refuse the legitimate shape, where an act is decided later.
  xact         xid8 NOT NULL DEFAULT pg_current_xact_id(),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   text,
  -- 'superseded' is not a status value: #17 (e) says nothing sets it, and a value nobody writes
  -- is a value a reader will one day believe. A deferral is not one either — #58 §5.4 keeps the
  -- transient values of a review pass out of the database, and #33 owns them.
  -- There is no reject_reason column: #77 owns the set of acts, and it is one ALTER TABLE.

  CONSTRAINT proposals_src_shape
    CHECK (array_ndims(src) = 1 AND cardinality(src) >= 1),
  CONSTRAINT proposals_payload_attrs
    CHECK (attrs_valid(coalesce(payload->'attrs', '{}'::jsonb))),
  -- INVARIANT 3, both halves: the documents the act cites, and the documents a VALUE cites.
  -- Local to this table and keyed on the stamped role, so INSERT INTO documents ('manual')
  -- still works and M8 stays representable.
  CONSTRAINT proposals_machine_not_manual
    CHECK (author_role <> 'gabriel_agent'
           OR array_position(src::text[], 'manual') IS NULL),
  CONSTRAINT proposals_value_not_manual
    CHECK (author_role <> 'gabriel_agent'
           OR NOT attrs_cites_manual(coalesce(payload->'attrs', '{}'::jsonb))),
  CONSTRAINT proposals_src_within
    CHECK (attrs_src_within(coalesce(payload->'attrs', '{}'::jsonb), src::text[])),
  -- One shape per kind of act: an update snapshot is an attribute object, a delete snapshot is
  -- a whole row, so it is not attrs_valid.
  CONSTRAINT proposals_prior_value_shape
    CHECK (prior_value IS NULL
           OR (op IN ('update_attrs','update_relation') AND attrs_valid(prior_value))
           OR (op IN ('delete_entity','delete_relation')
               AND coalesce(jsonb_typeof(prior_value),'absent') = 'object')),
  -- #58 §5.3: a deletion names what it destroys.
  CONSTRAINT proposals_delete_snapshot
    CHECK (status <> 'accepted'
           OR op NOT IN ('delete_entity','delete_relation')
           OR prior_value IS NOT NULL),
  -- #17 (d), both halves.
  CONSTRAINT proposals_target_pairs
    CHECK ((target_kind IS NULL) = (target_id IS NULL)),
  CONSTRAINT proposals_target_required
    CHECK (op IN ('create_entity','create_relation') OR target_id IS NOT NULL),
  CONSTRAINT proposals_decided_pairs
    CHECK ((status = 'pending') = (decided_at IS NULL)
           AND (decided_at IS NULL) = (decided_by IS NULL))
);

CREATE INDEX proposals_pending_idx
  ON proposals (created_at) WHERE status = 'pending';
CREATE INDEX proposals_target_pending_idx
  ON proposals (target_kind, target_id) WHERE status = 'pending';
-- The change log of one row, newest first.
CREATE INDEX proposals_change_idx
  ON proposals (target_kind, target_id, decided_at DESC) WHERE status = 'accepted';
-- "Which candidate claims cite this document" — PU1 publishes them with the document's score,
-- so a rating that moves reaches them too.
CREATE INDEX proposals_src_gin   ON proposals USING gin (src);
-- "Which pending act names this element", without a jsonb path that #7 has not decided.
CREATE INDEX proposals_names_gin ON proposals USING gin (names);


-- ============================================================================== entities ====
CREATE TABLE entities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL
                 CONSTRAINT entities_type_fkey REFERENCES entity_type(key)
                 -- ON UPDATE RESTRICT and not CASCADE: measured on #93, a cascading update
                 -- bypasses the privileges of the caller and rewrites a child row that the
                 -- caller may not touch. On this table that is a write with no proposal.
                 ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- #93: when the extracted word is not a live type the row lands as `unknown` and the word
  -- survives here, so WHERE type = 'unknown' is a sorted worklist and not a flat pile.
  proposed_type  text,
  label          text NOT NULL CHECK (btrim(label, E' \t\n\r\f\v') <> ''),
  geom           geometry(Geometry, 4326),   -- point, line and polygon share one column
  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- S2 at row level. #86 is open on what this list asserts against the src of a value, and
  -- this file asserts nothing about it.
  sources        doc_id[] NOT NULL,
  -- INVARIANT 5. One proposal makes one row, and no row exists without one.
  promoted_from  uuid NOT NULL
                 CONSTRAINT entities_promoted_from_key UNIQUE
                 CONSTRAINT entities_promoted_from_fkey REFERENCES proposals(id)
                 ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- INVARIANTS 1 AND 4, in the exact tier docs/spec.md §2 names: a check on the shape of the
  -- attribute object. No write path avoids it, because it sits on the column.
  CONSTRAINT entities_attrs_valid CHECK (attrs_valid(attrs)),
  CONSTRAINT entities_sources_shape
    CHECK (array_ndims(sources) = 1 AND cardinality(sources) >= 1)

  -- THERE IS NO POSITION COLUMN. #35 asks the operator to decide where a graph layout lives,
  -- and a position is not an attribute value, so attrs_valid must never see one.
);

-- A foreign key builds no index on the referencing side, and ON DELETE RESTRICT probes this
-- side on every delete of a type. So this index is a dependency of entities_type_fkey.
CREATE INDEX entities_type_idx    ON entities (type);
CREATE INDEX entities_geom_gix    ON entities USING gist (geom);
CREATE INDEX entities_attrs_gin   ON entities USING gin (attrs jsonb_path_ops);
CREATE INDEX entities_label_trgm  ON entities USING gin (label gin_trgm_ops);


-- ============================================================================= relations ====
CREATE TABLE relations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FREE TEXT FOR NOW. #96 wants the treatment entity_type got, and it is a seventh table on
  -- the day the operator wants it. berthed_at and contradicts already sit outside the M6 list.
  type           text NOT NULL CHECK (btrim(type) <> ''),
  -- M4. Two discriminants, so a relation may one day point at a relation. A polymorphic target
  -- cannot carry a foreign key, and the trigger check_relation_endpoints is the stated price.
  src_kind       text NOT NULL DEFAULT 'entity' CHECK (src_kind IN ('entity','relation')),
  src_id         uuid NOT NULL,
  dst_kind       text NOT NULL DEFAULT 'entity' CHECK (dst_kind IN ('entity','relation')),
  dst_id         uuid NOT NULL,
  valid_from     date,
  valid_to       date,
  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- #86 finding 2: six relations of the committed fixture carry an empty attrs, so their whole
  -- claim sits in the type and the two ends, and no attribute check reaches it. This list is
  -- then the only evidence such a claim can have.
  sources        doc_id[] NOT NULL,
  promoted_from  uuid NOT NULL
                 CONSTRAINT relations_promoted_from_key UNIQUE
                 CONSTRAINT relations_promoted_from_fkey REFERENCES proposals(id)
                 ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT relations_attrs_valid CHECK (attrs_valid(attrs)),
  CONSTRAINT relations_sources_shape
    CHECK (array_ndims(sources) = 1 AND cardinality(sources) >= 1),
  -- M6. An interval is reserved for identity and ownership relations.
  CONSTRAINT rel_dates_scope CHECK (
    (valid_from IS NULL AND valid_to IS NULL)
    OR type IN ('owns','operates','flags','insures','appoints')),
  CONSTRAINT rel_dates_order CHECK (
    valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX relations_src_idx  ON relations (src_kind, src_id);
CREATE INDEX relations_dst_idx  ON relations (dst_kind, dst_id);
CREATE INDEX relations_type_idx ON relations (type);

RESET ROLE;
