-- =============================================================================================
-- 0031 — a proposal of a job carries an idempotency key                                ORDERED
--
-- A REQUEUED JOB WROTE ITS PROPOSALS A SECOND TIME. A claim whose lease ended returns to the
-- queue, the next claim reads the same chunk with the same reader, and nothing told the second
-- set of proposals from the first. The operator then decided each fact twice, and the second
-- decision of a fact looked like a second source.
--
-- THE KEY IS ONE COLUMN AND AN OPAQUE DIGEST. The worker hashes six parts into it: the document,
-- the hash of the chunk, the reader, the model that served the answer, the form of the input and
-- the hash of the prompt. The table does not know the parts and never reads them back. It knows
-- only that two writes with one digest are one act. A second reader of the same chunk has
-- another reader id, so its digest differs, and its proposal stays: two readers are two
-- witnesses, and the unique rule must not merge them.
--
-- THE RULE IS UNIQUE ON THE DIGEST AND HOLDS NO NULL. An act of the operator and an act of the
-- research role carry no key, and any number of them may stand together.
--
-- ONLY THE WORKER CARRIES A KEY. The same test that holds a model call to gabriel_agent holds
-- the key to it, so no other role can use the key to hide a second proposal behind a first.
--
-- THE DOOR THAT WRITES THE KEY IS propose_change, IN 40_functions.sql. This file adds the column,
-- the two checks and the index, and nothing else.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals
  ADD COLUMN idempotency_key text
      CONSTRAINT proposals_key_is_digest
      CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT proposals_key_is_machine
      CHECK (author_role = 'gabriel_agent' OR idempotency_key IS NULL);

CREATE UNIQUE INDEX proposals_idempotency_key_uidx
  ON proposals (idempotency_key) WHERE idempotency_key IS NOT NULL;

RESET ROLE;
