-- =============================================================================================
-- 0007 — an update names at least one attribute                                        ORDERED
--
-- #17: "Promotion is not idempotent and can commit while applying nothing." The two named holes
-- are shut, and this file shuts the one the read of promote_proposal found.
--
-- MEASURED, NOT REASONED. On the live stack, a proposal of op `update_attrs` with the payload
-- `{}` and one with `{"attrs":{}}` were both written with no refusal, and both were promoted:
-- status `accepted`, `decided_by` recorded, `prior_value` NULL, the target's attrs byte for byte
-- unchanged, and `updated_at` MOVED. `update_relation` behaved the same against a relation. The
-- record then holds an accepted act that applied nothing, and `updated_at` says a row changed
-- when it did not. `attrs_valid('{}')` is TRUE, because a NOT EXISTS over zero rows is TRUE, so
-- proposals_payload_attrs never reached this.
--
-- WHY THE DOOR AND NOT THE DECISION. The alternative was a raise inside promote_proposal, which
-- would leave the empty act in the queue for the operator to reject. There is nothing in it to
-- judge: an update that names no attribute carries no value, no source and no claim, so a review
-- pass over it can only ever end one way. A queue that cannot hold one costs the operator less
-- than a queue that holds one and asks.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0003. node-pg-migrate keeps a ledger in `migrations`, so an
-- edit to a file already applied reaches no database until `pnpm db:reset`. A new file applies
-- to the database the operator is running today, and it dates the decision: 0003 stays the
-- record of what the first schema was.
--
-- IT BINDS THE TWO UPDATE OPS ONLY. `create_entity` and `create_relation` may still carry an
-- empty attrs: six relations of the committed fixture hold one, and their whole claim sits in
-- the type and the two ends. This rule says nothing about them.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- `op` is NOT NULL, so the left arm is never NULL and the CHECK never passes by three-valued
-- logic. coalesce does the same for the jsonb path. #14 audited every other CHECK for that fault.
ALTER TABLE proposals ADD CONSTRAINT proposals_update_names_attrs
  CHECK (op NOT IN ('update_attrs','update_relation')
         OR (coalesce(jsonb_typeof(payload->'attrs'), 'absent') = 'object'
             AND payload->'attrs' <> '{}'::jsonb));

RESET ROLE;
