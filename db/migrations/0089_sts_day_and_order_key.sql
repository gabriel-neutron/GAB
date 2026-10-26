-- =============================================================================================
-- 0089 — the day and the order of the ends enter the claim key of a ship-to-ship relation   ORDERED
--
-- TWO TRANSFERS OF ONE PAIR OF VESSELS, ON TWO DAYS, ARE TWO FACTS. The claim key of a sts_with
-- relation held its type and its two ends only, so both transfers had one key. A to B and
-- B to A are one fact, and had two keys.
--
-- THE RULE: the key of a new sts_with relation holds the two ends in a fixed order (the smaller
-- text first, byte order), then the day (attrs.observed_on.v) when the act gives one. The stored
-- src_id and dst_id do not change. The place (place_text) stays out of the key.
--
-- AN OLD KEY MAY MOVE ONLY FOR A sts_with RELATION: a pair stored in the high-to-low order moves,
-- and so does each dated transfer. The key of each other type stays byte for byte, as does the
-- key of a undated sts_with relation stored in the low-to-high order.
--
-- THIS MIGRATION REWRITES ONLY THE ACTS THAT THE RULE MOVES: each sts_with relation, and the
-- acts that name a moved act through src_id, dst_id or target_id, level after level, as in 0080.
-- If the new rule would move the key of any other relation, the migration stops with an
-- exception and nothing is written.
--
-- KNOWN LIMITS
--   1. Exact day only. There is no window of tolerance.
--   2. A day that a later update_attrs adds to a promoted undated transfer does not change the
--      key of that transfer: the key is frozen with the act.
--   3. A dated and an undated transfer of one pair are two facts.
-- A change of the list of types needs a new migration that writes each key again.
--
-- THE FREEZE TRIGGER REFUSES EVERY UPDATE OF AN ACT, so it is off for the rewrite alone, as in
-- 0056.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION claim_key_of(p_op text, p_target_kind text, p_target_id uuid,
                                        p_payload jsonb)
RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT md5(CASE p_op
    WHEN 'create_entity' THEN
      jsonb_build_array(p_op, p_payload->>'type', public.name_key(p_payload->>'label'))
    WHEN 'create_relation' THEN
      CASE WHEN p_payload->>'type' = 'sts_with' THEN
        jsonb_build_array(p_op, p_payload->>'type',
                          least(public.claim_end_key(p_payload->>'src_id'),
                                public.claim_end_key(p_payload->>'dst_id') COLLATE "C"),
                          greatest(public.claim_end_key(p_payload->>'src_id'),
                                   public.claim_end_key(p_payload->>'dst_id') COLLATE "C"))
      ELSE
        jsonb_build_array(p_op, p_payload->>'type',
                          public.claim_end_key(p_payload->>'src_id'),
                          public.claim_end_key(p_payload->>'dst_id'))
      END
      || CASE WHEN p_payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at', 'sts_with')
                   AND p_payload #> '{attrs,observed_on,v}' IS NOT NULL
              THEN jsonb_build_array(p_payload #> '{attrs,observed_on,v}')
              ELSE '[]'::jsonb
         END
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

CREATE TEMP TABLE rekeyed (id uuid PRIMARY KEY) ON COMMIT DROP;

-- One pass writes the acts whose key moved. An update reads the keys of the snapshot of its
-- statement, so each pass fixes one more level of the acts that name a moved act. The acts form
-- a graph with no cycle, so the loop ends.
DO $$
DECLARE v_moved int;
BEGIN
  RAISE NOTICE 'sts_with relations whose key moves: %',
    (SELECT count(*) FROM proposals r
      WHERE r.op = 'create_relation' AND r.payload->>'type' = 'sts_with'
        AND r.claim_key IS DISTINCT FROM
            claim_key_of(r.op, r.target_kind, r.target_id, r.payload));
  LOOP
    WITH moved AS (
      UPDATE proposals r
         SET claim_key = claim_key_of(r.op, r.target_kind, r.target_id, r.payload)
       WHERE (   (r.op = 'create_relation' AND r.payload->>'type' = 'sts_with')
              OR r.payload->>'src_id' IN (SELECT k.id::text FROM rekeyed k)
              OR r.payload->>'dst_id' IN (SELECT k.id::text FROM rekeyed k)
              OR r.target_id IN (SELECT k.id FROM rekeyed k))
         AND r.claim_key IS DISTINCT FROM
             claim_key_of(r.op, r.target_kind, r.target_id, r.payload)
      RETURNING r.id
    ), noted AS (
      INSERT INTO rekeyed SELECT m.id FROM moved m ON CONFLICT DO NOTHING
    )
    SELECT count(*) INTO v_moved FROM moved;
    EXIT WHEN v_moved = 0;
  END LOOP;

  IF EXISTS (SELECT 1 FROM proposals r
              WHERE r.op = 'create_relation'
                AND r.id NOT IN (SELECT k.id FROM rekeyed k)
                AND r.claim_key <> claim_key_of(r.op, r.target_kind, r.target_id, r.payload)) THEN
    RAISE EXCEPTION 'the new key rule moves the key of a relation that is not a sts_with relation';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
              WHERE tgrelid = 'public.proposals'::regclass
                AND tgname = 'proposals_append_only') THEN
    ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_append_only;
  END IF;
END $$;

RESET ROLE;
