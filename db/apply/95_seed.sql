-- =============================================================================================
-- 95 — the vocabularies                                                           RE-RUNNABLE
--
-- IT RUNS AFTER THE GRANTS. 20_views.sql drops and recreates every view, and a grant follows a
-- CREATE VIEW, so a data file that raises before 90_grants.sql would leave gabriel_read with no
-- SELECT on the new views.
--
-- THIS FILE IS THE ONLY PLACE A TYPE OR A KEY IS DECLARED. No role holds a write on either
-- table, and there is no propose-a-key path at run time: a row inserted by a function exists in
-- no .sql file, and ADR 0003 §5 makes `pnpm db:reset` a routine step, so such a row dies by
-- ordinary work.
--
-- IT ADDS AND IT UPDATES. IT NEVER DELETES. A word leaves service through `retired`, so its
-- history stays readable and its stem is released.
--
-- ASK — ADR 0003 §3 lists tables, columns, indexes, roles, extensions and types as ordered, and
-- views, functions, triggers and grants as re-runnable. ROWS ARE IN NEITHER COLUMN. This file
-- needs a third row in that table: a re-runnable data file, running last. #40 owns it.
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
-- ITS KIND IS `manual`, so it carries no retrieval date and `put_document` queues no work for
-- it. Nothing is there to fetch. Migration 0009 refuses it to the machine role beside `manual`.
INSERT INTO documents (id, kind, title)
VALUES ('inherited', 'manual',
        'No document supports this value; it is inherited from an ancestor')
ON CONFLICT (id) DO NOTHING;


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
-- ITS TWO HUES HOLD THE BAND THE OTHER FOUR HOLD: 4.9:1 on the light page for colour_light, and
-- 8.5:1 on the dark page for colour_dark. The violet is free — the seeded hues are blue, cyan,
-- green, olive and grey.
INSERT INTO entity_type (key, label, colour_light, colour_dark, ord) VALUES
  ('vessel',        'Vessel',        '#2971c6', '#70adfb',  10),
  ('facility',      'Facility',      '#007989', '#00c2d2',  20),
  ('company',       'Company',       '#007d50', '#53c48e',  30),
  ('person',        'Person',        '#677000', '#a8b44b',  40),
  ('military_unit', 'Military unit', '#8254c4', '#b7a0e4',  50),
  ('unknown',       'Unknown',       '#6b7280', '#9ca3af', 900)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  colour_light = EXCLUDED.colour_light,
  colour_dark  = EXCLUDED.colour_dark,
  ord = EXCLUDED.ord;


-- ========================================================================== attribute_key ===
-- THE 24 KEYS OF THE COMMITTED FIXTURE, MEASURED AND NOT INVENTED. A shorter seed refuses part
-- of the only data that exists.
--
-- THE DATE FORMAT IS AN ASK. The operator asked for DD-MM-YYYY on the screen. Every dated value
-- of the fixture is ISO 8601, and a stored DD-MM-YYYY does not sort, does not range and does
-- not cast. So the STORED format is ISO, and DD-MM-YYYY is a rule of the screen. #46 owns the
-- choice, and only the literal below changes.
--
-- `stem` is the concept and never the spelling. coal_stock_t declares the stem coal_stock, so
-- coal_stock_tonnes can never be declared beside it.
--
-- A pattern is written only where the shape is a real rule. Where a pattern would be a guess —
-- registration_number, ice_class — it is NULL, because guessing is the defect this table exists
-- to end.
INSERT INTO attribute_key (key, stem, kind, label, unit, pattern) VALUES
  -- identifiers
  ('imo',                    'imo',                    'identifier', 'IMO number',           NULL,       '^[0-9]{7}$'),
  ('registration_number',    'registration_number',    'identifier', 'Registration number',  NULL,       NULL),
  ('ice_class',              'ice_class',              'identifier', 'Ice class',            NULL,       NULL),
  -- dates
  ('incorporated_on',        'incorporated_on',        'date',       'Incorporated on',      NULL,       '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  ('observed_on',            'observed_on',            'date',       'Observed on',          NULL,       '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  -- quantities
  ('beneficial_owner_count', 'beneficial_owner_count', 'quantity',   'Beneficial owners',    NULL,       NULL),
  ('berth_count',            'berth_count',            'quantity',   'Berths',               NULL,       NULL),
  ('coal_stock_t',           'coal_stock',             'quantity',   'Coal stock',           't',        NULL),
  ('conveyor_lines',         'conveyor_lines',         'quantity',   'Conveyor lines',       NULL,       NULL),
  ('dry_dock_count',         'dry_dock_count',         'quantity',   'Dry docks',            NULL,       NULL),
  ('mole_length_m',          'mole_length',            'quantity',   'Mole length',          'm',        NULL),
  ('share_pct',              'share',                  'quantity',   'Shareholding',         '%',        NULL),
  ('teu_capacity',           'teu_capacity',           'quantity',   'TEU capacity',         'TEU',      NULL),
  ('throughput_kt_month',    'throughput',             'quantity',   'Throughput',           'kt/month', NULL),
  ('trains_operating',       'trains_operating',       'quantity',   'Trains operating',     NULL,       NULL),
  -- booleans
  ('ice_class_required',     'ice_class_required',     'boolean',    'Ice class required',   NULL,       NULL),
  ('operator_confirmed',     'operator_confirmed',     'boolean',    'Operator confirmed',   NULL,       NULL),
  ('seasonal_closure',       'seasonal_closure',       'boolean',    'Seasonal closure',     NULL,       NULL),
  -- a flat list of scalars
  ('known_flags',            'known_flags',            'list',       'Known flags',          NULL,       '^[A-Z]{2}$'),
  -- short text
  ('last_port_call',         'last_port_call',         'text',       'Last port call',       NULL,       NULL),
  ('role_title',             'role_title',             'text',       'Role',                 NULL,       NULL),
  -- notes. THE KIND IS DECLARED AND NEVER GUESSED. A 48-character test called two of these
  -- three `text`; the screen now speaks the declared kind, which is what #80 row B4 asks.
  ('crane_note',             'crane_note',             'note',       'Crane note',           NULL,       NULL),
  ('hull_note',              'hull_note',              'note',       'Hull note',            NULL,       NULL),
  ('note',                   'note',                   'note',       'Note',                 NULL,       NULL)
ON CONFLICT (key) DO UPDATE SET
  stem    = EXCLUDED.stem,
  kind    = EXCLUDED.kind,
  label   = EXCLUDED.label,
  unit    = EXCLUDED.unit,
  pattern = EXCLUDED.pattern;

-- THE ELEVEN KEYS OF THE v1 CORPUS, and `note` above is the twelfth, reused as it stands. Each
-- one was measured against project.gpkg and none is anticipated: the counts are 985 unit_type,
-- 1002 echelon, 654 domain, 551 military_unit_id, 17 organisation_type, 411 position_precision,
-- 122 osm_relation_id, 742 src_inherit_depth and src_inherited_from, and all 1027 rows for
-- v1_id and src_scope.
--
-- THE STEM RULE MAKES THE FIRST SPELLING PERMANENT, so each key is its own stem and no key here
-- carries a unit. `src_inherit_depth` counts hops up the command tree, and a hop has no symbol.
--
-- TWO IDENTIFIERS CARRY NO PATTERN, AND THAT IS MEASURED AND NOT LAZY. 44 military unit numbers
-- hold a leading zero and one reads `57229-51` with a U+2011 non-breaking hyphen, so `quantity`
-- would destroy them and a guessed shape would refuse them. `osm_relation_id` is an INTEGER in
-- the source file and becomes a string here, because it names a place and is never counted.
--
-- ONE PATTERN IS WRITTEN, AND IT IS THE ONE WORD SET THIS PROJECT MINTS. `position_precision`
-- is derived from the v1 columns `position_mode` and `is_exact_position`: own and exact is
-- `exact`, own and not exact is `approximate`, and a position taken from the parent is
-- `inherited`. Those three words are ours, so the shape is a rule and not a guess.
-- `src_scope` takes none: it reads `entity` on every row today because v1 recorded no per-field
-- provenance, and a pattern of one word would refuse the day that loss is repaired.
INSERT INTO attribute_key (key, stem, kind, label, unit, pattern) VALUES
  -- the v1 words, imported unchanged. The corpus spells `unit_type` 25 ways and `domain` is
  -- wrong on at least two aviation units; the fault is reported and never repaired here.
  ('unit_type',          'unit_type',          'text',       'Unit type',            NULL, NULL),
  ('echelon',            'echelon',            'text',       'Echelon',              NULL, NULL),
  ('domain',             'domain',             'text',       'Domain',               NULL, NULL),
  ('organisation_type',  'organisation_type',  'text',       'Organisation type',    NULL, NULL),
  ('military_unit_id',   'military_unit_id',   'identifier', 'Military unit number', NULL, NULL),
  -- It sits on the facility and never on the unit: 15 of the 122 places are shared by up to six
  -- units, so on a unit the claim would be false.
  ('osm_relation_id',    'osm_relation_id',    'identifier', 'OSM relation',         NULL, NULL),
  -- what the load itself states, so that every loss is a query and not a line in a document
  ('v1_id',              'v1_id',              'identifier', 'v1 identifier',        NULL, NULL),
  ('src_scope',          'src_scope',          'text',       'Source scope',         NULL, NULL),
  ('src_inherit_depth',  'src_inherit_depth',  'quantity',   'Source inheritance depth',
                                                                                     NULL, NULL),
  ('src_inherited_from', 'src_inherited_from', 'identifier', 'Source inherited from', NULL, NULL),
  ('position_precision', 'position_precision', 'text',       'Position precision',   NULL,
                                                              '^(exact|approximate|inherited)$')
ON CONFLICT (key) DO UPDATE SET
  stem    = EXCLUDED.stem,
  kind    = EXCLUDED.kind,
  label   = EXCLUDED.label,
  unit    = EXCLUDED.unit,
  pattern = EXCLUDED.pattern;

-- ============================================================================== parameter ===
-- THE SEED WRITES A NUMBER AND NEVER REWRITES ONE. The whole point of the table is that the
-- operator changes a number in the live database, and an apply that restored the value below
-- would undo that change on the next routine run.
--
-- FIFTEEN MINUTES, AND IT IS A CHOICE AND NOT A MEASUREMENT. No real job has run, so no
-- duration of the work is known. It is long enough that a slow job is never released under the
-- worker that holds it, and short enough that a stopped worker frees its row within one break.
INSERT INTO parameter (key, value) VALUES
  ('job_claim_lease_seconds', 900)
ON CONFLICT (key) DO NOTHING;


RESET ROLE;
