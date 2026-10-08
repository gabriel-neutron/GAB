-- =============================================================================================
-- 0057 — the letter of an author, and the check by a second model family              ORDERED
--
-- EACH AUTHOR OF A SOURCE HAS A LETTER, A TO F, THAT CODE STORES (decisions.md S1, ADR 0012). The
-- author is the person or the body that first gives the information, as the originator of an act
-- names it. A letter is an input of the rules and never a decision. NATO judges the author and
-- the fact apart, so the digit of a fact never reads a letter.
--
-- A NAME IS FREE TEXT, AND AN AUTHOR IS A ROW. `author_name` maps each name, in the form of
-- name_key(), to one author. A name with no row is resolved by no worker answer yet: it reads as
-- F and counts as no author. Two names of one author both point to one row.
--
-- A LETTER IS WRITTEN ONCE. The row keeps the model, the reason, the reference authors that the
-- model compared with, the controller and the date. A new letter needs a new design, because
-- nothing in the first build changes a letter.
--
-- ONLY THE REFERENCE SET HOLDS A AND B. The check `author_reference_set` makes it a rule of the
-- table. A party to the conflict must have a controller. The reference set is made once and the
-- operator approves it, so its rows may name no reference author.
--
-- A JOIN INTO AN AUTHOR A OR B IS A DOUBT. It would raise the letter of every act of that name,
-- so the name row keeps the flag for the operator.
--
-- THE CHECK BY A SECOND MODEL FAMILY IS A ROW. A fact with no passed check has no digit. The
-- check proves that the passage says the fact, and never that the fact is true. The row names
-- the family of the reader and the family of the checker: a check by the same family does not
-- pass.
--
-- NO ROLE READS OR WRITES THESE TABLES. The doors in the re-runnable files do.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE author (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key          text NOT NULL UNIQUE
                    CONSTRAINT author_name_key_form
                    CHECK (name_key <> '' AND name_key = name_key(name_key)),
  letter            char(1) NOT NULL
                    CONSTRAINT author_letter_word CHECK (letter IN ('A','B','C','D','E','F')),
  model             text NOT NULL
                    CONSTRAINT author_model CHECK (btrim(model, E' \t\n\r\f\v') <> ''),
  reason            text NOT NULL
                    CONSTRAINT author_reason CHECK (btrim(reason, E' \t\n\r\f\v') <> ''),
  reference_authors text[] NOT NULL DEFAULT '{}'
                    CONSTRAINT author_reference_names
                    CHECK (array_position(reference_authors, NULL) IS NULL
                           AND array_position(reference_authors, '') IS NULL),
  controller        text
                    CONSTRAINT author_controller_text
                    CHECK (controller IS NULL OR btrim(controller, E' \t\n\r\f\v') <> ''),
  party             boolean NOT NULL DEFAULT false,
  reference_set     boolean NOT NULL DEFAULT false,
  rated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT author_reference_set CHECK (letter NOT IN ('A','B') OR reference_set),
  CONSTRAINT author_names_a_reference CHECK (reference_set OR cardinality(reference_authors) >= 1),
  CONSTRAINT author_party_has_controller CHECK (NOT party OR controller IS NOT NULL)
);

CREATE TABLE author_name (
  name_key    text PRIMARY KEY
              CONSTRAINT author_name_form CHECK (name_key <> '' AND name_key = name_key(name_key)),
  author_id   uuid NOT NULL
              CONSTRAINT author_name_author_fkey REFERENCES author(id)
              ON UPDATE RESTRICT ON DELETE RESTRICT,
  doubt       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX author_name_author_idx ON author_name (author_id);

CREATE TABLE act_check (
  proposal_id     uuid PRIMARY KEY
                  CONSTRAINT act_check_proposal_fkey REFERENCES proposals(id)
                  ON UPDATE RESTRICT ON DELETE RESTRICT,
  checker_model   text NOT NULL
                  CONSTRAINT act_check_model CHECK (btrim(checker_model, E' \t\n\r\f\v') <> ''),
  checker_family  text NOT NULL
                  CONSTRAINT act_check_checker_family
                  CHECK (btrim(checker_family, E' \t\n\r\f\v') <> ''),
  reader_family   text NOT NULL
                  CONSTRAINT act_check_reader_family
                  CHECK (btrim(reader_family, E' \t\n\r\f\v') <> ''),
  verdict         text NOT NULL
                  CONSTRAINT act_check_verdict
                  CHECK (verdict IN ('supported','not_supported','unclear')),
  -- The check passes when the passage supports the act and the family of the checker is not the
  -- family of the reader. The test never yields NULL.
  passed          boolean GENERATED ALWAYS AS (
                    verdict = 'supported' AND lower(btrim(checker_family)) <> lower(btrim(reader_family))
                  ) STORED,
  checked_at      timestamptz NOT NULL DEFAULT now()
);

RESET ROLE;
