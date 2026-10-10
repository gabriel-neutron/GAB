-- =============================================================================================
-- 0072 — the merge candidates across a Latin and a Cyrillic spelling                     ORDERED
--
-- A PAIR OF ENTITIES WITH ONE NAME IN TWO SCRIPTS WAITS FOR THE OPERATOR. A worker command finds
-- the pairs of one type whose Latin and Cyrillic names give one transliteration key, and stores
-- each new pair here. The operator confirms a pair (a merge) or refuses it. The row stays after
-- the decision, so a refused pair is never proposed again, and the release counts each state.
--
-- No foreign key on the two entities: a merge deletes the absorbed row, and the pair must still
-- hold the refusal or the confirmation. A read resolves each identifier through the alias table.
-- Only the doors of the operator role write or read the table.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE name_candidate (
  first_id    uuid NOT NULL,
  second_id   uuid NOT NULL,
  key         text NOT NULL CONSTRAINT name_candidate_key_form CHECK (btrim(key) <> ''),
  -- The name of each entity that matched: its label, or one of its other names.
  first_name  text NOT NULL,
  second_name text NOT NULL,
  state       text NOT NULL DEFAULT 'proposed'
              CONSTRAINT name_candidate_state_check
              CHECK (state IN ('proposed', 'confirmed', 'refused')),
  found_at    timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  decided_by  text,
  -- The merge that the confirmation wrote. An undo of the merge leaves the pair confirmed.
  merged_by   uuid CONSTRAINT name_candidate_merged_by_fkey REFERENCES proposals(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT name_candidate_pkey PRIMARY KEY (first_id, second_id),
  CONSTRAINT name_candidate_order CHECK (first_id < second_id),
  CONSTRAINT name_candidate_decided CHECK (
    (state = 'proposed') = (decided_at IS NULL)
    AND (decided_at IS NULL) = (decided_by IS NULL)
    AND (state = 'confirmed') = (merged_by IS NOT NULL))
);

RESET ROLE;
