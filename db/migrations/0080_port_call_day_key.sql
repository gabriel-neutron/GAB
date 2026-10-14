-- =============================================================================================
-- 0080 — the day of a port call enters its claim key                                    ORDERED
--
-- TWO CALLS OF ONE VESSEL AT ONE PORT, ON TWO DAYS, ARE TWO FACTS. The claim key of a relation
-- held its type and its two ends only, so both calls had one key: the rejection, the denial and
-- the source count of one call also reached the other.
--
-- THE RULE: the key of a new relation of type berthed_at, loads_at or discharges_at holds the
-- day (attrs.observed_on.v) after the two ends, when the act gives one. The value enters as the
-- act writes it. Only these three types take the day: flagged_falsely holds an observed_on too,
-- and its key does not change.
--
-- AN OLD KEY DOES NOT MOVE. The array of a relation with no day is built as before, and an empty
-- array appended to it changes nothing, so the md5 of its text is the same. The key of an act
-- that gives no day, and of each other type, stays byte for byte.
--
-- THIS MIGRATION REWRITES ONLY THE ACTS THAT THE RULE MOVES: each dated port call, and the acts
-- that name a moved act through src_id, dst_id or target_id, level after level. It does not
-- write each key again, because the name of an entity could have changed its key since 0056.
-- If the new rule would move the key of any other relation, the migration stops with an
-- exception and nothing is written.
--
-- KNOWN LIMITS
--   1. Exact day only. Two sources that give two days for one call make two facts. There is no
--      window of tolerance. The propose tool keeps a day only when a cited passage states it.
--   2. A day that a later update_attrs adds to a promoted undated call does not change the key
--      of that call: the key is frozen with the act.
--   3. A port call as an event entity is a different claim and stays out of this rule.
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
      jsonb_build_array(p_op, p_payload->>'type',
                        public.claim_end_key(p_payload->>'src_id'),
                        public.claim_end_key(p_payload->>'dst_id'))
      || CASE WHEN p_payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at')
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
  RAISE NOTICE 'dated port calls: %',
    (SELECT count(*) FROM proposals
      WHERE op = 'create_relation'
        AND payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at')
        AND payload #> '{attrs,observed_on,v}' IS NOT NULL);
  LOOP
    WITH moved AS (
      UPDATE proposals r
         SET claim_key = claim_key_of(r.op, r.target_kind, r.target_id, r.payload)
       WHERE (   (r.op = 'create_relation'
                  AND r.payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at')
                  AND r.payload #> '{attrs,observed_on,v}' IS NOT NULL)
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
    RAISE EXCEPTION 'the new key rule moves the key of a relation with no day of a port call';
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
