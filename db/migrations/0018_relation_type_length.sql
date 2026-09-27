-- =============================================================================================
-- 0018 — a relation type is 200 characters at most                                    ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- External constraint: relations_type_idx is a btree, and a btree refuses a row of about 2,704
-- bytes. The act would commit and then fail at its promotion, so the proposal refuses it first.
ALTER TABLE proposals ADD CONSTRAINT proposals_create_relation_type_length
  CHECK (op <> 'create_relation' OR char_length(coalesce(payload->>'type', '')) <= 200);

ALTER TABLE relations ADD CONSTRAINT relations_type_length CHECK (char_length(type) <= 200);

RESET ROLE;
