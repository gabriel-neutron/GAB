-- =============================================================================================
-- 0029 — a fifth role proposes and stores what it fetched                              ORDERED
--
-- A CALL FROM CLAUDE WOULD HAVE SIGNED AS THE OPERATOR. The writer doors sign as gabriel_app, and
-- put_document takes any kind and does not demand the bytes. A machine that fetches a source and
-- proposes from it needs a name of its own on the proposal, and a door that is as narrow as the
-- act: a fetched address, with its hash and its date.
--
-- THE ROLE LOGS IN, INHERITS NOTHING AND IS A MEMBER OF NOTHING. It holds no table grant that
-- writes. 90_grants.sql gives it the doors it may call. A role belongs to the cluster, so the
-- test database meets it already made, and the ALTER lines state each attribute either way.
--
-- THE AUTHOR WORD IS A CLOSED LIST OF THREE. The inline check of 0003 held two words, so a
-- proposal of the new role was refused before any rule read it. The stamp trigger still writes
-- the word, and a caller never supplies one.
--
-- THE ONE RESERVED-SOURCE RULE NOW BINDS EVERY AUTHOR BUT THE OPERATOR. Migration 0020 left one
-- constraint on the reserved documents, and it named gabriel_agent alone. A new author named by
-- neither side would have passed it, so the rule is reversed: only gabriel_app may cite `manual`
-- or `inherited`. A reserved word inside a value is refused through proposals_src_within, because
-- every source of a value must lie inside src. The name of the constraint is unchanged.
--
-- THE CALL RECORD IS NOT DEMANDED OF THE NEW ROLE. proposals_app_carries_no_call stays as it is,
-- so a proposal of gabriel_research names no model call: the call table is the worker's.
-- =============================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'gabriel_research') THEN
    CREATE ROLE gabriel_research;
  END IF;
END
$$;

ALTER ROLE gabriel_research LOGIN NOINHERIT;
ALTER ROLE gabriel_research SET statement_timeout = '30s';

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals DROP CONSTRAINT proposals_author_role_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_author_role_check
  CHECK (author_role IN ('gabriel_agent','gabriel_app','gabriel_research'));

ALTER TABLE proposals DROP CONSTRAINT proposals_machine_not_reserved;
ALTER TABLE proposals ADD CONSTRAINT proposals_machine_not_reserved
  CHECK (author_role = 'gabriel_app'
         OR NOT (src::text[] && reserved_doc_ids()));

RESET ROLE;
