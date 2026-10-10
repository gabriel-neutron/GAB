-- =============================================================================================
-- 0070 — the IMO number of a vessel as the review compares it                            ORDERED
--
-- TWO VESSELS WITH ONE IMO NUMBER ARE ONE SHIP. The check of the faults finds a new vessel whose
-- IMO number a vessel of the record holds, and the review page lists the pairs of the record. An
-- IMO number is seven digits. A writer can give it as a number, or as a text with the prefix
-- "IMO", so the key keeps the seven digits only. A JSON number with a zero fraction is the whole
-- number, as JSON.parse reads it. A list, an object or any other value gives no key. The release
-- reads the number with the same rule.
--
-- The function is here and not in the re-runnable files, because the indexes of the record and of
-- the queue read it: a change of the function needs a new index.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION imo_key(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE jsonb_typeof(p_value)
           WHEN 'string'
             THEN substring(p_value #>> '{}' FROM '^\s*(?:[Ii][Mm][Oo]\s*)?([0-9]{7})\s*$')
           WHEN 'number'
             THEN CASE WHEN (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)
                       THEN substring(trunc((p_value #>> '{}')::numeric)::text FROM '^([0-9]{7})$')
                  END
         END
$$;

CREATE INDEX entities_imo_key_idx ON entities (imo_key(attrs->'imo'->'v')) WHERE type = 'vessel';
CREATE INDEX proposals_pending_imo_key_idx ON proposals (imo_key(payload #> '{attrs,imo,v}'))
  WHERE status = 'pending' AND op = 'create_entity' AND payload->>'type' = 'vessel';

RESET ROLE;
