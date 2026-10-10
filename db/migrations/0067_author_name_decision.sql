-- =============================================================================================
-- 0067 — the operator confirms or refuses a name that joined an author A or B            ORDERED
--
-- A JOIN INTO AN AUTHOR A OR B RAISES THE LETTER OF EVERY ACT OF THE NAME (ADR 0012, #434). Until
-- the operator confirms it, the name reads as F and its units are a doubt. A refused name reads
-- as F, and the rater rates it again.
--
-- A DECISION IS WRITTEN ONCE. `author_name_decision` holds one row for each joined name, with the
-- role and the date, and no row is ever changed or deleted.
--
-- A REFUSED NAME KEEPS ITS ROW, because `author_name` is append-only. So the name key alone is no
-- longer the key of that table: a refused name can get a second row, for a new author or for a
-- join into another author. The doors keep one live row for each name: the live row is the one
-- with no refusal.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE author_name DROP CONSTRAINT author_name_pkey;
ALTER TABLE author_name ADD CONSTRAINT author_name_pkey PRIMARY KEY (name_key, author_id);

CREATE TABLE author_name_decision (
  name_key    text NOT NULL,
  author_id   uuid NOT NULL,
  confirmed   boolean NOT NULL,
  decided_by  text NOT NULL DEFAULT session_user,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT author_name_decision_pkey PRIMARY KEY (name_key, author_id),
  CONSTRAINT author_name_decision_name_fkey FOREIGN KEY (name_key, author_id)
    REFERENCES author_name (name_key, author_id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

RESET ROLE;
