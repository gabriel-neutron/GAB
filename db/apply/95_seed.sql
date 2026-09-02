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


-- ============================================================================ entity_type ===
-- The four words are the entity types of the committed fixture, which is SYNTHETIC. The real
-- vocabulary is #8's work, on a sample of the v1 corpus.
-- `unknown` is mandatory: it is what lets a promotion complete when the extracted word is not a
-- live type, so a missing word never fails the pivotal step.
INSERT INTO entity_type (key, label, colour_light, colour_dark, ord) VALUES
  ('vessel',   'Vessel',   '#2971c6', '#70adfb',  10),
  ('facility', 'Facility', '#007989', '#00c2d2',  20),
  ('company',  'Company',  '#007d50', '#53c48e',  30),
  ('person',   'Person',   '#677000', '#a8b44b',  40),
  ('unknown',  'Unknown',  '#6b7280', '#9ca3af', 900)
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

RESET ROLE;
