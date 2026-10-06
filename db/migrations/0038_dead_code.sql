-- =============================================================================================
-- 0038 — the originator, the chat store and four read views go                         ORDERED
--
-- NOTHING CALLED THEM. The originator and its trust lists had doors, a view and loaders, and no
-- feature of the app read a letter, a flag or a card. The operator removed that system on 6
-- October 2026: a later spec stores the originator of a claim again, in a simpler form. The chat
-- store had two doors and no caller, and the chat feature builds its own store again. Four read
-- views had no reader.
--
-- A DATABASE THAT RAN 0025 AND 0034 KEEPS EVERY OTHER ROW. Each statement below names one object
-- of these systems and nothing else, and no CASCADE runs, so an object that another part still
-- needs stops this file with an error and never goes in silence.
--
-- THE ORDER IS THE ORDER OF THE DEPENDENCIES. A view reads the tables, and one door returns the
-- row type of a table, so the views and the doors go first. A trigger function goes last, after
-- the table that held its trigger. The re-runnable files no longer
-- create any of them. On a database built from zero, the views and the doors do not exist yet,
-- and each IF EXISTS is a no-op.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP VIEW IF EXISTS api.originator_card;
DROP VIEW IF EXISTS api.full_graph;
DROP VIEW IF EXISTS api.value_support;
DROP VIEW IF EXISTS api.key_usage;
DROP VIEW IF EXISTS api.model_call;

DROP FUNCTION IF EXISTS append_chat_message(uuid,text,text,uuid,jsonb);
DROP FUNCTION IF EXISTS open_conversation(text,text,uuid);

DROP FUNCTION IF EXISTS load_trust_list(text,text,date,text,jsonb);
DROP FUNCTION IF EXISTS originator_exceptions();
DROP FUNCTION IF EXISTS ack_letter_change(uuid);
DROP FUNCTION IF EXISTS set_gold_set_letter(text,text,text);
DROP FUNCTION IF EXISTS review_originator_card(text,text);
DROP FUNCTION IF EXISTS set_party_false(text,text);
DROP FUNCTION IF EXISTS link_imprint(text,text,text);
DROP FUNCTION IF EXISTS merge_originator(text,text,text);
DROP FUNCTION IF EXISTS confirm_fabrication(uuid,text);
DROP FUNCTION IF EXISTS contest_letter(text,text);
DROP FUNCTION IF EXISTS remove_operator_letter(text,text);
DROP FUNCTION IF EXISTS set_operator_letter(text,text,text);
DROP FUNCTION IF EXISTS record_resolution(text,uuid,text,text,text,text,text,text,timestamptz,date);
DROP FUNCTION IF EXISTS decide_originator_fact(uuid);
DROP FUNCTION IF EXISTS propose_originator_fact(text,text,jsonb,text,integer,integer,integer);
DROP FUNCTION IF EXISTS ensure_originator_candidate(text,text,text);
DROP FUNCTION IF EXISTS ensure_originator(text,text,text,text,text);
DROP FUNCTION IF EXISTS refresh_originator(text,timestamptz);
DROP FUNCTION IF EXISTS issuer_card_for(text);
DROP FUNCTION IF EXISTS originator_letter_for(text,text);
DROP FUNCTION IF EXISTS compute_originator_letter(text,timestamptz);
DROP FUNCTION IF EXISTS originator_step_letter(text,text,timestamptz);
DROP FUNCTION IF EXISTS originator_track_is_e(text);
DROP FUNCTION IF EXISTS originator_track_counts(text);
DROP FUNCTION IF EXISTS wilson_upper(numeric,numeric,numeric);
DROP FUNCTION IF EXISTS wilson_lower(numeric,numeric,numeric);
DROP FUNCTION IF EXISTS originator_param(text);
DROP FUNCTION IF EXISTS trust_uri_host(text);

DROP TABLE chat_citation;
DROP TABLE chat_message;
DROP TABLE conversation;

DROP TABLE trust_list_load;
DROP TABLE originator_letter_history;
DROP TABLE originator_resolution;
DROP TABLE originator_sanction;
DROP TABLE originator_fact;
DROP TABLE sanctioned_hosts;
DROP TABLE belligerent;
DROP TABLE issuer_card;
DROP TABLE originator;
DROP TABLE originator_scheme;

-- A trigger goes with its table, so its function is free only now.
DROP FUNCTION IF EXISTS chat_message_append_only_fn();
DROP FUNCTION IF EXISTS originator_letter_history_guard_fn();

-- The provider kept a free-text slot for the originator of its lists. No row filled it.
ALTER TABLE document_provider DROP COLUMN originator_id;

-- The numbers of the letter. The runner numbers stay.
DELETE FROM parameter
 WHERE key IN ('letter_wilson_z', 'letter_a_min_resolved', 'letter_b_wilson_lower',
               'letter_c_wilson_lower', 'letter_d_wilson_lower', 'letter_d_min_resolved',
               'letter_e_wilson_upper', 'letter_e_min_resolved', 'letter_step_days',
               'letter_first_cap_c', 'staff_author_min_resolved', 'sanction_control_share');

RESET ROLE;
