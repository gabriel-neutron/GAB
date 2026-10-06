-- =============================================================================================
-- 0041 — one propose path for every AI, and a citation for each item              ORDERED
--
-- TWO WRITES MADE ONE ACT, AND A CRASH BETWEEN THEM LEFT HALF OF IT. A machine proposed a claim,
-- and a second door stored where the page stated it. Now one door takes a batch of items, and
-- writes each proposal with its citations in one transaction. The reading table goes, and the
-- citation table holds the offsets that code calculated from a checked excerpt.
--
-- THE READINGS ARE KEPT AS CITATIONS. A first reading named its proposal, its page and its span,
-- and that is a citation. The second reader named no proposal, so its rows cite nothing and go.
--
-- THE KEY OF THE CALLER GOES, AND A DIGEST OF THE ACT REPLACES IT. The runner made a key from
-- the chunk, the model and the prompt, and a change of any part wrote the same act again. Now a
-- trigger stamps a digest of the operation, the target, the payload, the sources, the role and
-- the originator on each machine act. A unique index on the digest of a pending act makes a retry or a parallel call
-- return the act that waits. The operator gets no digest: an act of the operator is never
-- joined to an act of a machine.
--
-- AN ENTITY THAT A BATCH CREATES CAN BE NAMED IN THE SAME BATCH. Code mints the identifier of
-- each proposal, and the promotion of a creation gives the new row that identifier. So a
-- relation of the batch names the entity before it exists.
--
-- THE ORIGINATOR IS THE PARTY THAT FIRST STATED THE CLAIM, AS TEXT. A machine act names it, and
-- an act of the operator names none. No rating reads it yet.
--
-- THIS FILE STOPS BEFORE IT DROPS DATA THAT IT CANNOT KEEP. A citation keeps the claim, the page,
-- the span and the modality of a first reading, and nothing else. So a reading of the second
-- reader, a reading that names no proposal and an adverse reading cannot become a citation. A
-- key of a pending act still protects that act from a second write. If the database holds one
-- of these, the file stops with an error before its first change, and the operator decides what
-- to do with the data. A key of a decided act protects nothing, and it goes.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DO $$
DECLARE
  v_second   bigint;
  v_no_claim bigint;
  v_adverse  bigint;
  v_keys     bigint;
BEGIN
  SELECT count(*) FILTER (WHERE r.reader_no <> 1),
         count(*) FILTER (WHERE r.reader_no = 1 AND r.claim_id IS NULL),
         count(*) FILTER (WHERE r.reader_no = 1 AND r.claim_id IS NOT NULL AND r.adverse)
    INTO v_second, v_no_claim, v_adverse
    FROM claim_reading r;
  SELECT count(*) INTO v_keys
    FROM proposals p
   WHERE p.idempotency_key IS NOT NULL AND p.status = 'pending';
  IF v_second + v_no_claim + v_adverse + v_keys > 0 THEN
    RAISE EXCEPTION 'Migration 0041 stopped and changed nothing. The database holds data that '
                    'the new tables cannot keep: % readings of the second reader, % readings '
                    'that name no proposal, % adverse readings and % pending proposals with an '
                    'idempotency key. The operator must decide what to do with this data before '
                    'the migration can run.', v_second, v_no_claim, v_adverse, v_keys
      USING ERRCODE = 'object_not_in_prerequisite_state',
            HINT = 'Decide each pending machine proposal, and keep or remove the readings that '
                   'claim_reading holds. Then run the migration again.';
  END IF;
END $$;

ALTER TABLE citation
  ADD COLUMN text_extractor text CHECK (btrim(text_extractor, E' \t\n\r\f\v') <> '');

INSERT INTO citation (claim_id, doc_id, text_extractor, page, start, "end", modality, created_at)
SELECT r.claim_id, r.doc_id, r.text_extractor, r.page, r.start, r."end", r.modality, r.created_at
  FROM claim_reading r
 WHERE r.reader_no = 1 AND r.claim_id IS NOT NULL;

ALTER TABLE citation
  ALTER COLUMN text_extractor SET NOT NULL,
  ADD CONSTRAINT citation_page_fkey FOREIGN KEY (doc_id, text_extractor, page)
    REFERENCES document_text (document_id, extractor, page)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

DROP FUNCTION IF EXISTS put_claim_reading(uuid,uuid,text,int,int,int,text,boolean,uuid,text,text,text,text);
DROP FUNCTION IF EXISTS second_read_done(uuid,text,text,text);
DROP TABLE claim_reading;

DROP INDEX proposals_idempotency_key_uidx;
ALTER TABLE proposals
  DROP CONSTRAINT proposals_key_is_machine,
  DROP COLUMN idempotency_key;

ALTER TABLE proposals
  ADD COLUMN act_digest text
      CONSTRAINT proposals_act_digest_shape
      CHECK (act_digest IS NULL OR act_digest ~ '^[0-9a-f]{32}$'),
  ADD COLUMN originator text
      CONSTRAINT proposals_originator_text
      CHECK (originator IS NULL
             OR (btrim(originator, E' \t\n\r\f\v') <> '' AND char_length(originator) <= 300)),
  ADD CONSTRAINT proposals_originator_machine
      CHECK (author_role <> 'gabriel_app' OR originator IS NULL);

CREATE UNIQUE INDEX proposals_pending_act_uidx
  ON proposals (act_digest) WHERE status = 'pending';

RESET ROLE;
