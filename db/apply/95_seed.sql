-- =============================================================================================
-- 95 — the vocabularies                                                           RE-RUNNABLE
--
-- IT RUNS AFTER THE GRANTS. 20_views.sql drops and recreates every view, and a grant follows a
-- CREATE VIEW, so a data file that raises before 90_grants.sql would leave gabriel_read with no
-- SELECT on the new views.
--
-- THE MARKED REGION BELOW IS WRITTEN FROM src/shared/vocabulary/declarations.ts, WHICH IS THE
-- ONLY PLACE A TYPE IS DECLARED. `pnpm seed:vocabulary` emits it, an edit made by hand between
-- the markers is lost on the next emit, and a test compares the two with no database. Every
-- other line of this file is hand-written and the emitter never reads it. No role holds a write
-- on the table, and there is no propose-a-type path at run time: a row inserted by a function
-- exists in no .sql file, and ADR 0003 §5 makes `pnpm db:reset` a routine step, so such a row
-- dies by ordinary work.
--
-- THERE IS NO ATTRIBUTE VOCABULARY, AND THAT IS M11. Migration 0010 dropped the table. An
-- attribute key is whatever a person or an agent writes, and `api.key_usage` is the only place
-- the keys in use can be read.
--
-- IT ADDS AND IT UPDATES. IT NEVER DELETES. A word leaves service through `retired`, so its
-- history stays readable. The statement writes no such column, so a seeded word takes the
-- default of the table and is in service.
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
-- IT CARRIES NO RETRIEVAL DATE, AND THE ROW AND NOT THE KIND IS WHY. Since migration 0011
-- doc_retrieved_with_bytes demands a date of the BYTES, and this row holds no s3_key and no
-- sha256, so it needs none. Its kind is `manual`, which is a separate rule and it decides one
-- separate thing: `put_document` queues no work for it, because nothing is there to fetch.
-- Migration 0009 refuses it to the machine role beside `manual`.
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
-- >>> GENERATED entity_type
INSERT INTO entity_type (key, label, colour_light, colour_dark, ord) VALUES
  ('vessel',        'Vessel',        '#2971c6', '#70adfb',  10),
  ('facility',      'Facility',      '#007989', '#00c2d2',  20),
  ('company',       'Company',       '#007d50', '#53c48e',  30),
  ('person',        'Person',        '#677000', '#a8b44b',  40),
  ('military_unit', 'Military unit', '#8254c4', '#b7a0e4',  50),
  ('unknown',       'Unknown',       '#6b7280', '#9ca3af', 900)
ON CONFLICT (key) DO UPDATE SET
  label        = EXCLUDED.label,
  colour_light = EXCLUDED.colour_light,
  colour_dark  = EXCLUDED.colour_dark,
  ord          = EXCLUDED.ord;
-- <<< GENERATED entity_type


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
