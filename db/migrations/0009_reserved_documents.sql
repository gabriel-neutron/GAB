-- =============================================================================================
-- 0009 — the reserved set, where two rules named one reserved word                     ORDERED
--
-- WHY A SECOND RESERVED WORD EXISTS. The v1 corpus carries 742 units with no source of their
-- own, and each one reaches a sourced ancestor one to four levels up the command tree. Copying
-- the ancestor's URLs would assert that those documents support the child, and for most of them
-- the document never names the child. Citing `manual` would assert that the operator vouched
-- for the row in person, which an unattended load cannot do. So a second reserved document says
-- the true thing — NO DOCUMENT SUPPORTS THIS VALUE — and db/apply/95_seed.sql writes it.
--
-- WHAT WAS OPEN. `manual` is refused to gabriel_agent by two rules, one on the documents the act
-- cites and one on the documents a value cites, and both named the literal word. A second
-- reserved word therefore stood outside both, and the machine layer could have signed with it.
-- The asymmetry of M8 is about the reserved kind of source, not about one spelling of it.
--
-- THE SET IS WRITTEN IN ONE PLACE. reserved_doc_ids() holds it and both rules read it, so a
-- third reserved word is one line and never two rules that drift apart.
--
-- NEITHER RULE CAN PASS BY THREE-VALUED LOGIC. `author_role` is NOT NULL; `src` is NOT NULL,
-- holds at least one element by proposals_src_shape, and its elements are a domain that refuses
-- NULL. `&&` over two non-null arrays is non-null, and coalesce holds the jsonb path.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0002 AND 0003. node-pg-migrate keeps a ledger in the
-- `migrations` schema, so an edit to a file already applied reaches no running database until
-- `pnpm db:reset`. A new file applies to the database the operator runs today, and 0002 and 0003
-- stay the record of what the first schema was.
--
-- BOTH CONSTRAINTS ARE RENAMED, because the old names say `manual` and the rules no longer do.
-- A name that states the wrong rule is the defect 0008 was written to end.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- The reserved documents. `manual` is the operator's own authority (M8). `inherited` is the
-- absence of one: the value stands on an ancestor, and no document supports it.
CREATE FUNCTION reserved_doc_ids() RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ARRAY['manual','inherited'];
$$;

-- Invariant 3, for the value. It replaces attrs_cites_manual, which read the one word.
CREATE FUNCTION attrs_cites_reserved(a jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_each(coalesce(a, '{}'::jsonb)) AS e(k, val)
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN coalesce(jsonb_typeof(val->'src'), 'absent') = 'array'
             THEN val->'src' ELSE '[]'::jsonb END) AS s(doc)
     WHERE s.doc = ANY (reserved_doc_ids()));
$$;

-- INVARIANT 3, both halves. Local to this table and keyed on the stamped role, so the seed still
-- writes both reserved rows into `documents` and M8 stays representable.
ALTER TABLE proposals DROP CONSTRAINT proposals_machine_not_manual;
ALTER TABLE proposals ADD CONSTRAINT proposals_machine_not_reserved
  CHECK (author_role <> 'gabriel_agent'
         OR NOT (src::text[] && reserved_doc_ids()));

ALTER TABLE proposals DROP CONSTRAINT proposals_value_not_manual;
ALTER TABLE proposals ADD CONSTRAINT proposals_value_not_reserved
  CHECK (author_role <> 'gabriel_agent'
         OR NOT attrs_cites_reserved(coalesce(payload->'attrs', '{}'::jsonb)));

-- Nothing reads it now, and a function no rule calls is a rule a later reader will believe.
DROP FUNCTION attrs_cites_manual(jsonb);

RESET ROLE;
