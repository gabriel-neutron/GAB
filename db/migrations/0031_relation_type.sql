-- =============================================================================================
-- 0031 — a relation type is a row of a closed list                                     ORDERED
--
-- THE TYPE OF A RELATION WAS FREE TEXT, AND THE INTERVAL RULE WAS A LIST OF FIVE WORDS. 0003
-- wrote `relations.type` as free text "for now", and rel_dates_scope named owns, operates,
-- flags, insures and appoints. A designated_by relation with its entry into force was refused,
-- and a new dated type needed a migration. That comment in 0003 is now history: an applied file
-- is never edited, so this header is where the change is stated.
--
-- THE TABLE HAS THE FORM OF entity_type. A word leaves service through `retired` and is never
-- deleted, because ON DELETE RESTRICT would otherwise make one typo permanent. The seed in
-- db/apply/95_seed.sql writes the words. `unknown` is the fallback: a word that fits no live type
-- lands there, and the word stays in `relations.proposed_type`.
--
-- ONE DIRECTION ONLY. `inverse_label` is how a page reads a relation from its far end, so
-- `owned_by` never exists beside `owns`.
--
-- EVERY TYPE THE TABLE ALREADY HOLDS IS WRITTEN BEFORE THE FOREIGN KEY. A word that does not have
-- the form of a key cannot be a row, so its relations move to `unknown` and the word goes to
-- `proposed_type`: the claim moves, and no word is lost. A type that holds a dated relation takes
-- an interval. The seed then writes the final labels.
--
-- rel_dates_scope GOES, AND A TRIGGER TAKES ITS PLACE. A check reads one row, and the rule now
-- reads the type row. db/apply/60_triggers.sql holds the trigger, and its refusal carries the
-- same constraint name. The ordered files run before the re-runnable ones, so between this file
-- and the next apply no rule refuses an interval. `pnpm db:migrate` and the apply are one step of
-- the routine, and no writer runs between them.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE relation_type (
  key            text PRIMARY KEY
                 CHECK (key = btrim(key) AND key ~ '^[a-z][a-z0-9_]*$'),
  label          text NOT NULL CHECK (btrim(label) <> ''),          -- read from the source end
  inverse_label  text NOT NULL CHECK (btrim(inverse_label) <> ''),  -- read from the far end
  takes_interval boolean NOT NULL DEFAULT false,
  retired        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The extracted word, kept when it was not a live type. The row then stands as `unknown`.
ALTER TABLE relations ADD COLUMN proposed_type text;

INSERT INTO relation_type (key, label, inverse_label)
VALUES ('unknown', 'is linked to', 'is linked to');

UPDATE relations
   SET proposed_type = type, type = 'unknown'
 WHERE type !~ '^[a-z][a-z0-9_]*$';

INSERT INTO relation_type (key, label, inverse_label, takes_interval)
SELECT r.type, replace(r.type, '_', ' '), 'is linked to',
       bool_or(r.valid_from IS NOT NULL OR r.valid_to IS NOT NULL)
  FROM relations r
 GROUP BY r.type
ON CONFLICT (key) DO NOTHING;

-- ON UPDATE RESTRICT and not CASCADE, as for an entity: a cascading update bypasses the
-- privileges of the caller and rewrites a row with no proposal. relations_type_idx already
-- serves the probe that ON DELETE RESTRICT runs.
ALTER TABLE relations ADD CONSTRAINT relations_type_fkey
  FOREIGN KEY (type) REFERENCES relation_type (key) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE relations DROP CONSTRAINT rel_dates_scope;

RESET ROLE;
