-- =============================================================================================
-- 0056 — the claim of an act, to find a claim that the operator rejected before        ORDERED
--
-- A MACHINE CAN PROPOSE AGAIN A CLAIM THAT THE OPERATOR REJECTED, from a new run with new
-- identities. The digest of an act cannot find it, because the digest holds the minted
-- identities, the sources and the role. The claim key holds only what the act claims:
--
--   a new entity        its type and its name as the review compares it;
--   a new relation      its type and the key of each end;
--   any other act       its operation, the key of its target, and each key with its value (a
--                       source of a value is not part of the claim).
--
-- The key of an element is the claim key of the act that proposed it, in any state, and its
-- identity only when no act proposed it. So the key of a relation does not change when the
-- operator promotes one of its ends.
--
-- The stamp of the act writes the key at the insert, and the key is frozen with the act. The
-- function is here and not in the re-runnable files, because the key of an old act and the key
-- of a new act must come from one rule: a change of the rule needs a new migration that writes
-- each key again.
--
-- EACH ACT OF THE RECORD GETS ITS KEY, pending and decided, by the rule of the insert. An act
-- can name an act that is not keyed yet, so the fill repeats until each key is written.
--
-- THE FREEZE TRIGGER REFUSES EVERY UPDATE OF AN ACT, so it is off for the fill alone, as in 0052.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals ADD COLUMN claim_key text;

-- THE KEY OF AN ELEMENT THAT AN ACT NAMES: the claim key of the act that proposed it, in any
-- state, so the key does not change when the operator promotes that act. The identity of the
-- element only when no act proposed it. An end that is not an identifier stays as it is written:
-- the shape check of the act refuses it after the stamp, with its own words.
CREATE OR REPLACE FUNCTION claim_end_key(p_end text) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE
           WHEN p_end IS NULL OR NOT pg_input_is_valid(p_end, 'uuid') THEN p_end
           ELSE coalesce((SELECT p.claim_key FROM public.proposals p WHERE p.id = p_end::uuid),
                         p_end::uuid::text)
         END
$$;

CREATE OR REPLACE FUNCTION claim_key_of(p_op text, p_target_kind text, p_target_id uuid,
                                        p_payload jsonb)
RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT md5(CASE p_op
    WHEN 'create_entity' THEN
      jsonb_build_array(p_op, p_payload->>'type', public.name_key(p_payload->>'label'))
    WHEN 'create_relation' THEN
      jsonb_build_array(p_op, p_payload->>'type',
                        public.claim_end_key(p_payload->>'src_id'),
                        public.claim_end_key(p_payload->>'dst_id'))
    ELSE
      jsonb_build_array(p_op, p_target_kind, public.claim_end_key(p_target_id::text),
                        coalesce((SELECT jsonb_object_agg(a.key, a.value->'v')
                                    FROM jsonb_each(p_payload->'attrs') AS a),
                                 '{}'::jsonb),
                        p_payload - 'attrs' - 'sources')
  END::text)
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
              WHERE tgrelid = 'public.proposals'::regclass
                AND tgname = 'proposals_append_only') THEN
    ALTER TABLE proposals DISABLE TRIGGER proposals_append_only;
  END IF;
END $$;

-- An act waits until each act that it names has its key. An act never names itself, so each
-- pass writes at least one act, until none is left.
DO $$
DECLARE v_written int;
BEGIN
  LOOP
    UPDATE proposals r
       SET claim_key = claim_key_of(r.op, r.target_kind, r.target_id, r.payload)
     WHERE r.claim_key IS NULL
       AND NOT EXISTS (SELECT 1 FROM proposals e
                        WHERE e.id IN ((r.payload->>'src_id')::uuid,
                                       (r.payload->>'dst_id')::uuid, r.target_id)
                          AND e.id <> r.id AND e.claim_key IS NULL);
    GET DIAGNOSTICS v_written = ROW_COUNT;
    EXIT WHEN v_written = 0;
  END LOOP;
  UPDATE proposals r
     SET claim_key = claim_key_of(r.op, r.target_kind, r.target_id, r.payload)
   WHERE r.claim_key IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
              WHERE tgrelid = 'public.proposals'::regclass
                AND tgname = 'proposals_append_only') THEN
    ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_append_only;
  END IF;
END $$;

ALTER TABLE proposals ALTER COLUMN claim_key SET NOT NULL;

CREATE INDEX proposals_rejected_claim_idx ON proposals (claim_key) WHERE status = 'rejected';

RESET ROLE;
