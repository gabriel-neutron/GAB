-- =============================================================================================
-- 0032 — the originator, its register card, its facts and its track record             ORDERED
--
-- A CLAIM HAD NO TABLE FOR THE ONE WHO FIRST PUT IT OUT. The gate could not read a letter, a
-- party relation or a sanctions status, and no canonical id existed to store on a citation. This
-- file adds the tables only. The doors, the letter and the read view are in db/apply/, and the
-- numbers of the letter are rows of `parameter`, written by 95_seed.sql.
--
-- NO ROLE WRITES ANY TABLE HERE. Each write goes through a SECURITY DEFINER door, and 90_grants.sql
-- grants a table to nobody. A letter, a flag and a merge are written by code or by the operator,
-- and never by a model role.
--
-- NO COLUMN OF `originator` OR `issuer_card` HOLDS A DIGIT, A SCORE OR AN EXPIRY DATE. A letter
-- has no expiry, and time alone never changes it. `checked_until` exists on the two sanction
-- tables, and it dates a flag check: it never reaches the letter.
--
-- THE ID IS A CANONICAL ID AND NEVER A NAME. A display name, a registrable domain and a URL path
-- are not keys, and a platform or a carrier is never an originator. The carrier list is the
-- list of the method, held in one CHECK and not in a table: a table would be one more thing that
-- a door must guard.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- ============================================================================ originator_scheme ===
-- The closed list of schemes. A new scheme is one line of 95_seed.sql.
CREATE TABLE originator_scheme (
  scheme text PRIMARY KEY CHECK (scheme ~ '^[a-z]+$')
);

-- ================================================================================== originator ===
CREATE TABLE originator (
  id text PRIMARY KEY
      CONSTRAINT originator_id_shape CHECK (id ~ '^[a-z]+:[^[:space:]]+$')
      CONSTRAINT originator_id_not_carrier CHECK (id <> ALL (ARRAY[
        'host:substack.com', 'host:t.me', 'host:vk.com', 'host:x.com',
        'host:archive.today', 'host:tgstat.ru', 'host:sanctions.lursoft.lv',
        'host:audit-it.ru'])),
  scheme text NOT NULL GENERATED ALWAYS AS (split_part(id, ':', 1)) STORED
      CONSTRAINT originator_scheme_fkey REFERENCES originator_scheme(scheme)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (btrim(display_name, E' \t\n\r\f\v') <> ''),
  kind text NOT NULL
       CHECK (kind IN ('state_body', 'organisation', 'person', 'account', 'own_algorithm')),
  role text CHECK (role IS NULL
                 OR role IN ('issuer', 'holder', 'relay', 'person', 'own_algorithm')),
  jurisdiction text CHECK (jurisdiction IS NULL OR jurisdiction ~ '^[A-Z]{2}$'),

  imprint_id text CONSTRAINT originator_imprint_fkey REFERENCES originator(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
  merged_into text CONSTRAINT originator_merged_fkey REFERENCES originator(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  name_collides_with text CONSTRAINT originator_collides_fkey REFERENCES originator(id)
                     ON UPDATE RESTRICT ON DELETE RESTRICT,

  letter text NOT NULL DEFAULT 'F' CHECK (letter IN ('A', 'B', 'C', 'D', 'E', 'F')),
  letter_origin text NOT NULL DEFAULT 'track_record'
                CHECK (letter_origin IN ('register', 'track_record', 'operator', 'gold_set')),
  operator_letter text CHECK (operator_letter IS NULL
                          OR operator_letter IN ('A', 'B', 'C', 'D', 'E', 'F')),
  operator_letter_reason text,
  gold_set_letter text CHECK (gold_set_letter IS NULL
                         OR gold_set_letter IN ('A', 'B', 'C', 'D', 'E', 'F')),
  gold_set_ref text,

  party text NOT NULL DEFAULT 'unknown' CHECK (party IN ('true', 'false', 'unknown')),
  party_reason text,
  party_false_reason text,
  sanctioned_controlled boolean NOT NULL DEFAULT false,
  contested boolean NOT NULL DEFAULT false,
  contested_reason text,

  -- A natural person is hidden from the card view until the operator reviews the card.
  card_reviewed_at timestamptz,
  -- The date of the last act of the operator on this originator. A contest by the track record
  -- counts only a resolution that is newer than this date, so the same counts do not contest the
  -- letter again after the operator has decided.
  last_operator_act_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT originator_id_host CHECK (
    scheme <> 'host'
    OR (substr(id, 6) ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
        AND substr(id, 6) !~ '^www\.')),
  CONSTRAINT originator_id_account CHECK (
    scheme NOT IN ('telegram', 'x', 'vk')
    OR substr(id, length(scheme) + 2) ~ '^[0-9]+$'),
  CONSTRAINT originator_id_author CHECK (
    scheme NOT IN ('substack', 'livejournal')
    OR substr(id, length(scheme) + 2) ~ '^[^/[:space:]]+$'),
  CONSTRAINT originator_id_algorithm CHECK (
    scheme <> 'gab' OR substr(id, 5) ~ '^[a-z0-9-]+:v[0-9]+$'),
  CONSTRAINT originator_own_algorithm_is_gab CHECK (
    (scheme = 'gab') = (kind = 'own_algorithm')
    AND (role IS NULL OR role <> 'own_algorithm' OR scheme = 'gab')),
  CONSTRAINT originator_operator_letter_reason CHECK (
    (operator_letter IS NULL) = (operator_letter_reason IS NULL)
    AND (operator_letter_reason IS NULL
         OR btrim(operator_letter_reason, E' \t\n\r\f\v') <> '')),
  CONSTRAINT originator_gold_set_ref CHECK ((gold_set_letter IS NULL) = (gold_set_ref IS NULL)),
  CONSTRAINT originator_no_self_reference CHECK (
    imprint_id IS DISTINCT FROM id AND merged_into IS DISTINCT FROM id
    AND name_collides_with IS DISTINCT FROM id)
);

CREATE INDEX originator_merged_into_idx ON originator (merged_into) WHERE merged_into IS NOT NULL;

-- ================================================================================ issuer_card ===
-- One row per issuer, approved once by the operator. A belligerent list gets no card.
CREATE TABLE issuer_card (
  issuer_id text PRIMARY KEY CONSTRAINT issuer_card_issuer_fkey REFERENCES originator(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
  hosts text[] NOT NULL CHECK (cardinality(hosts) > 0),
  tls_names text[] NOT NULL DEFAULT '{}',
  url_patterns text[] NOT NULL DEFAULT '{}',
  record_kinds text[] NOT NULL DEFAULT '{}',
  -- Each element is {name, declarant}, and the declarant is `issuer` or `holder`.
  fields jsonb NOT NULL DEFAULT '[]'
         CHECK (jsonb_typeof(fields) = 'array'),
  identifier_types text[] NOT NULL DEFAULT '{}',
  terms_of_use text,
  jurisdiction text CHECK (jurisdiction IS NULL OR jurisdiction ~ '^[A-Z]{2}$'),
  sanctions_regime text CHECK (sanctions_regime IS NULL OR sanctions_regime IN ('EU', 'US', 'UK')),
  approved_sha256 text NOT NULL CHECK (approved_sha256 ~ '^[0-9a-f]{64}$'),
  approved_on date NOT NULL,
  approval_reason text NOT NULL CHECK (btrim(approval_reason, E' \t\n\r\f\v') <> ''),
  -- The file that the loader read. A changed file replaces the card that it holds.
  source_file text NOT NULL CHECK (btrim(source_file, E' \t\n\r\f\v') <> '')
);

-- ================================================================================ belligerent ===
CREATE TABLE belligerent (
  code text NOT NULL CHECK (code ~ '^[A-Z]{2}$'),
  name text NOT NULL CHECK (btrim(name, E' \t\n\r\f\v') <> ''),
  conflict text NOT NULL CHECK (btrim(conflict, E' \t\n\r\f\v') <> ''),
  approved_sha256 text NOT NULL CHECK (approved_sha256 ~ '^[0-9a-f]{64}$'),
  approved_on date NOT NULL,
  PRIMARY KEY (code, conflict)
);

-- ============================================================================ sanctioned_hosts ===
-- THE REGIME IS EU OR US, AND A ROW NEEDS ITS LIST ENTRY. A UK-only listing gives no flag. A
-- name alone is no match: two outlets can share a name. The two registration numbers are the
-- non-name match, and a row where both are set and differ is refused.
CREATE TABLE sanctioned_hosts (
  outlet text NOT NULL CHECK (btrim(outlet, E' \t\n\r\f\v') <> ''),
  host_or_account text NOT NULL CHECK (btrim(host_or_account, E' \t\n\r\f\v') <> ''),
  regime text NOT NULL CHECK (regime IN ('EU', 'US')),
  list_entry_id text NOT NULL CHECK (btrim(list_entry_id, E' \t\n\r\f\v') <> ''),
  list_url text NOT NULL CHECK (btrim(list_url, E' \t\n\r\f\v') <> ''),
  outlet_registration text CHECK (outlet_registration IS NULL
                              OR btrim(outlet_registration, E' \t\n\r\f\v') <> ''),
  entry_registration text CHECK (entry_registration IS NULL
                             OR btrim(entry_registration, E' \t\n\r\f\v') <> ''),
  listed_on date,
  -- The day until which the flag was checked. It dates a check and never touches a letter.
  checked_until date,
  approved_sha256 text NOT NULL CHECK (approved_sha256 ~ '^[0-9a-f]{64}$'),
  approved_on date NOT NULL,
  PRIMARY KEY (host_or_account, regime, list_entry_id),
  CONSTRAINT sanctioned_hosts_registration_agrees CHECK (
    outlet_registration IS NULL OR entry_registration IS NULL
    OR outlet_registration = entry_registration)
);

-- ============================================================================== originator_fact ===
-- THE CANDIDATE LAYER. An agent proposes a fact with a stored span, and code decides it. The
-- value is jsonb, and its shape depends on the kind. decide_originator_fact checks the shape.
CREATE TABLE originator_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  originator_id text NOT NULL CONSTRAINT originator_fact_originator_fkey
                REFERENCES originator(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  kind text NOT NULL
       CHECK (kind IN ('controller', 'no_belligerent_control', 'sanction_entry', 'imprint')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  document_id doc_id NOT NULL CONSTRAINT originator_fact_document_fkey
              REFERENCES documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  page int NOT NULL CHECK (page >= 1),
  span_start int NOT NULL CHECK (span_start >= 0),
  span_end int NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'refused')),
  refused_reason text,
  proposed_by text NOT NULL DEFAULT session_user,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT originator_fact_span_order CHECK (span_end > span_start),
  CONSTRAINT originator_fact_refusal_has_reason CHECK (
    (status = 'refused') = (refused_reason IS NOT NULL)),
  CONSTRAINT originator_fact_decided CHECK ((status = 'proposed') = (decided_at IS NULL))
);

CREATE INDEX originator_fact_originator_idx ON originator_fact (originator_id, kind, status);

-- ========================================================================== originator_sanction ===
CREATE TABLE originator_sanction (
  originator_id text NOT NULL CONSTRAINT originator_sanction_originator_fkey
                REFERENCES originator(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  regime text NOT NULL CHECK (regime IN ('EU', 'US')),
  list_entry_id text NOT NULL CHECK (btrim(list_entry_id, E' \t\n\r\f\v') <> ''),
  listed_on date,
  source text NOT NULL CHECK (source IN ('host_table', 'list_document')),
  source_fact uuid CONSTRAINT originator_sanction_fact_fkey REFERENCES originator_fact(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  checked_until date,
  PRIMARY KEY (originator_id, regime, list_entry_id),
  CONSTRAINT originator_sanction_source_fact CHECK ((source = 'list_document') = (source_fact IS NOT NULL))
);

-- ======================================================================== originator_resolution ===
-- THE TRACK RECORD. One row per originator and claim. The cluster key is `claim_document`: the
-- many claims of one document are one cluster, and one document is one piece of evidence.
-- `claim_id` has no foreign key, because no claim table exists yet.
CREATE TABLE originator_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  originator_id text NOT NULL CONSTRAINT originator_resolution_originator_fkey
                REFERENCES originator(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  claim_id uuid NOT NULL,
  claim_document doc_id NOT NULL CONSTRAINT originator_resolution_claim_document_fkey
                 REFERENCES documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  position text NOT NULL CHECK (position IN ('first', 'first_hand')),
  outcome text NOT NULL CHECK (outcome IN ('true', 'false', 'fabricated')),
  settled_by text NOT NULL
             CHECK (settled_by IN ('issuer_record', 'verified_observation', 'operator_decision')),
  -- text and not doc_id: the domain refuses NULL, and an operator decision has no settling document.
  settling_document text CONSTRAINT originator_resolution_settling_fkey
                    REFERENCES documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  operator_note text,
  settling_captured_at timestamptz,
  claim_document_date date NOT NULL,
  fabrication_confirmed_at timestamptz,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (originator_id, claim_id),
  CONSTRAINT originator_resolution_not_circular CHECK (
    settling_document IS NULL OR settling_document <> claim_document),
  CONSTRAINT originator_resolution_ground_truth CHECK (
    CASE settled_by
      WHEN 'operator_decision'
        THEN operator_note IS NOT NULL AND btrim(operator_note, E' \t\n\r\f\v') <> ''
      ELSE settling_document IS NOT NULL AND settling_captured_at IS NOT NULL
    END),
  CONSTRAINT originator_resolution_not_a_restatement CHECK (
    settling_captured_at IS NULL
    OR (settling_captured_at AT TIME ZONE 'UTC')::date >= claim_document_date),
  CONSTRAINT originator_resolution_confirmation CHECK (
    fabrication_confirmed_at IS NULL OR outcome = 'fabricated')
);

CREATE INDEX originator_resolution_cluster_idx
  ON originator_resolution (originator_id, claim_document);

-- ====================================================================== originator_letter_history ===
-- ONE ROW FOR EACH CHANGE OF THE LETTER. The gate re-runs on the claims that cite the originator,
-- and `gate_rerun_at` is NULL until it has. The row is never rewritten, except that one column.
CREATE TABLE originator_letter_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  originator_id text NOT NULL CONSTRAINT originator_letter_history_fkey
                REFERENCES originator(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  letter text NOT NULL CHECK (letter IN ('A', 'B', 'C', 'D', 'E', 'F')),
  letter_origin text NOT NULL
                CHECK (letter_origin IN ('register', 'track_record', 'operator', 'gold_set')),
  reason jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  gate_rerun_at timestamptz
);

CREATE INDEX originator_letter_history_idx
  ON originator_letter_history (originator_id, changed_at DESC);
CREATE INDEX originator_letter_history_open_idx
  ON originator_letter_history (changed_at) WHERE gate_rerun_at IS NULL;

-- ================================================================================ trust_list_load ===
CREATE TABLE trust_list_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file text NOT NULL CHECK (btrim(file, E' \t\n\r\f\v') <> ''),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  approved_on date NOT NULL,
  reason text NOT NULL CHECK (btrim(reason, E' \t\n\r\f\v') <> ''),
  row_count int NOT NULL CHECK (row_count >= 0),
  loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trust_list_load_file_idx ON trust_list_load (file, loaded_at DESC);

RESET ROLE;
