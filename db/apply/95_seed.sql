-- =============================================================================================
-- 95 — the vocabularies                                                           RE-RUNNABLE
--
-- IT RUNS AFTER THE GRANTS. 20_views.sql drops and recreates every view, and a grant follows a
-- CREATE VIEW, so a data file that raises before 90_grants.sql would leave gabriel_read with no
-- SELECT on the new views.
--
-- THE TWO MARKED REGIONS BELOW ARE WRITTEN FROM THE MODULES THAT DECLARE THEM: an entity type
-- in src/shared/vocabulary/declarations.ts, and a relation type in
-- packages/proposal/src/relation-types.ts, because the door of the writer reads that list too,
-- and a package never imports from src/. `pnpm seed:vocabulary` emits both, an edit made by hand
-- between the markers is lost on the next emit, and a test compares the two with no database.
-- Every other line of this file is hand-written and the emitter never reads it. No role holds a
-- write on either table, and there is no propose-a-type path at run time: a row inserted by a
-- function exists in no .sql file, and ADR 0003 makes `pnpm db:reset` a routine step, so such
-- a row dies by ordinary work.
--
-- THERE IS NO ATTRIBUTE VOCABULARY, AND THAT IS M11. Migration 0010 dropped the table. An
-- attribute key is whatever a person or an agent writes.
--
-- IT ADDS AND IT UPDATES. IT NEVER DELETES. A word leaves service through `retired`, so its
-- history stays readable. The statement writes no such column, so a seeded word takes the
-- default of the table and is in service.
--
-- ADR 0003 NAMES THIS FILE. Rows are a third kind, beside tables and functions: a re-runnable
-- data file, running last, after the grants.
-- =============================================================================================

SET ROLE gabriel_owner;

-- M8. `manual` is a real document, so a hand-entered value can be scored and queried like any
-- other claim, and "everything that rests on the operator's authority alone" is one query.
INSERT INTO documents (id, kind, title)
VALUES ('manual', 'manual', 'Direct entry by the analyst')
ON CONFLICT (id) DO NOTHING;

-- THE SECOND RESERVED DOCUMENT, AND IT IS NOT A WEAKER `manual`. `manual` says the operator
-- vouches for the value in person. `inherited` says the opposite: nothing supports the value
-- here, and the claim stands on an ancestor which `src_inherited_from` names. The v1 corpus
-- needs it for 742 units, and inventing a citation for them would be a fabrication.
--
-- IT CARRIES NO RETRIEVAL DATE, AND THE ROW AND NOT THE KIND IS WHY. Since migration 0011
-- doc_retrieved_with_bytes demands a date of the BYTES, and this row holds no s3_key and no
-- sha256, so it needs none. Its kind is `manual`, which is a separate rule and it decides one
-- separate thing: `put_document` queues no work for it, because nothing is there to fetch.
-- Migration 0009 refuses it to the machine role beside `manual`.
INSERT INTO documents (id, kind, title)
VALUES ('inherited', 'manual',
        'No document supports this value; it is inherited from an ancestor')
ON CONFLICT (id) DO NOTHING;

-- ======================================================================= document_provider ===
-- HAND-WRITTEN, AND THIS FILE IS THE AUTHORITY FOR A LICENCE. One edited line moves every
-- document of that provider, so the statement updates the name and the licence of a row that
-- exists.
--
-- WHERE NO TEXT STATES A LICENCE, THE ROW TAKES AN INTERNAL ONE. CREA and EGRUL are `restricted`
-- until their terms are read. IMO GISIS and Equasis need a login, so they are
-- `registration-terms`. Each of these words is internal tier, so an error here can only hold a
-- document back, and it never publishes one.
--
-- `manual` AND `inherited` GET NO PROVIDER. A hand entry stays internal until a release decides
-- to publish the operator's own entries; `own` is the row it would take.
INSERT INTO document_provider (id, name, licence) VALUES
  ('eu_eurlex',           'EU EUR-Lex',                 'eu-reuse'),
  ('ofac_sdn',            'OFAC SDN',                   'public-domain'),
  ('uk_sanctions_list',   'UK sanctions list',          'ogl-v3'),
  ('eu_fsf',              'EU FSF',                     'eu-reuse'),
  ('gleif',               'GLEIF',                      'cc0'),
  ('crea',                'CREA',                       'restricted'),
  ('datalastic',          'Datalastic',                 'commercial-no-redistribution'),
  ('gfw',                 'GFW',                        'cc-by-nc-4.0'),
  ('imo_gisis',           'IMO GISIS',                  'registration-terms'),
  ('equasis',             'Equasis',                    'registration-terms'),
  ('opensanctions',       'OpenSanctions',              'cc-by-nc-4.0'),
  ('opencorporates',      'OpenCorporates',             'odbl'),
  ('mca21',               'MCA21',                      'paid-filing'),
  ('acra',                'ACRA',                       'paid-filing'),
  ('cyprus_registrar',    'Cyprus Registrar',           'paid-filing'),
  ('hk_icris',            'HK ICRIS',                   'paid-filing'),
  ('egrul',               'EGRUL',                      'restricted'),
  ('copernicus_sentinel', 'Sentinel-1/2 (Copernicus)',  'copernicus'),
  ('osm',                 'OSM',                        'odbl'),
  ('own',                 'own',                        'own')
ON CONFLICT (id) DO UPDATE SET
  name    = EXCLUDED.name,
  licence = EXCLUDED.licence;


-- ============================================================================ entity_type ===
-- The first four words are the entity types of the committed fixture, which is SYNTHETIC.
-- `unknown` is mandatory: it is what lets a promotion complete when the extracted word is not a
-- live type, so a missing word never fails the pivotal step.
--
-- `military_unit` IS THE FIRST WORD OF THE REAL CORPUS. The v1 file holds 1010 military units,
-- 17 defence-industry organisations that are `company`, and 122 garrison places that are
-- `facility`, so those two words are reused and one is added. The arm of service — motorized
-- rifle, aviation, artillery, and 22 more spellings — is NOT a type: it is the `unit_type`
-- attribute, because a type list of 25 arms of service is a vocabulary that the data writes.
--
-- ITS TWO HUES HOLD THE BAND THE OTHER TYPES HOLD: 4.9:1 on the light page for colour_light,
-- and 8.5:1 on the dark page for colour_dark. The seeded hues are now blue, cyan, green, olive,
-- violet, amber, magenta, rust, plum and grey. The next type must have a new measured pair in the
-- same band.
-- >>> GENERATED entity_type
INSERT INTO entity_type (key, label, colour_light, colour_dark, ord) VALUES
  ('vessel',        'Vessel',        '#2971c6', '#70adfb',  10),
  ('facility',      'Facility',      '#007989', '#00c2d2',  20),
  ('company',       'Company',       '#007d50', '#53c48e',  30),
  ('person',        'Person',        '#677000', '#a8b44b',  40),
  ('military_unit', 'Military unit', '#8254c4', '#b7a0e4',  50),
  ('port',          'Port',          '#a16100', '#df9b44',  60),
  ('bank',          'Bank',          '#b53c7f', '#e887b6',  70),
  ('state_body',    'State body',    '#bb4530', '#fa8c7a',  75),
  ('legal_act',     'Legal act',     '#8b598e', '#e889ed',  80),
  ('unknown',       'Unknown',       '#6b7280', '#9ca3af', 900)
ON CONFLICT (key) DO UPDATE SET
  label        = EXCLUDED.label,
  colour_light = EXCLUDED.colour_light,
  colour_dark  = EXCLUDED.colour_dark,
  ord          = EXCLUDED.ord;
-- <<< GENERATED entity_type


-- ========================================================================== relation_type ===
-- One direction only: `owns` exists, and `owned_by` never does. `inverse_label` is how a page
-- reads the relation from its far end. `unknown` is mandatory, as it is for an entity: a word
-- that fits no live type lands there, and the word stays in `relations.proposed_type`.
--
-- THE UPDATE NAMES NO `retired`. A re-apply must never bring a retired word back into service.
-- `takes_interval` is written, and the trigger on this table refuses true to false while a dated
-- relation of the type stands, so a seed that drops an interval stops the apply with a reason.
-- >>> GENERATED relation_type
INSERT INTO relation_type (key, label, inverse_label, takes_interval) VALUES
  ('owns',              'owns',              'is owned by',                  true),
  ('operates',          'operates',          'is operated by',               true),
  ('flags',             'flags',             'is flagged by',                true),
  ('insures',           'insures',           'is insured by',                true),
  ('appoints',          'appoints',          'is appointed by',              true),
  ('designated_by',     'designated by',     'designates',                   true),
  ('exempted_by',       'exempted by',       'exempts',                      true),
  ('charters',          'charters',          'is chartered by',              true),
  ('settles_through',   'settles through',   'is the settlement channel of', false),
  ('supplies_crude_to', 'supplies crude to', 'receives crude from',          false),
  ('sells_products_to', 'sells products to', 'buys products from',           false),
  ('berthed_at',        'berthed at',        'is the berth of',              false),
  ('loads_at',          'loads at',          'is the loading place of',      false),
  ('discharges_at',     'discharges at',     'is the discharge place of',    false),
  ('sts_with',          'sts with',          'sts with',                     false),
  ('inspected_at',      'inspected at',      'is the inspection place of',   false),
  ('flagged_falsely',   'flagged falsely',   'is flagged falsely by',        false),
  ('contradicts',       'contradicts',       'is contradicted by',           false),
  ('subordinate_to',    'subordinate to',    'is superior to',               false),
  ('unknown',           'is linked to',      'is linked to',                 false)
ON CONFLICT (key) DO UPDATE SET
  label          = EXCLUDED.label,
  inverse_label  = EXCLUDED.inverse_label,
  takes_interval = EXCLUDED.takes_interval;
-- <<< GENERATED relation_type


-- ============================================================================== parameter ===
-- THE SEED WRITES A NUMBER AND NEVER REWRITES ONE. The whole point of the table is that the
-- operator changes a number in the live database, and an apply that restored the value below
-- would undo that change on the next routine run.
--
-- THE WAIT OF THE RUNNER IS A CHOICE AND NOT A MEASUREMENT. An empty queue is looked at every
-- thirty seconds, which is the longest the operator waits after queuing a document with the
-- runner idle.
INSERT INTO parameter (key, value) VALUES
  ('runner_empty_wait_seconds', 30)
ON CONFLICT (key) DO NOTHING;

RESET ROLE;
