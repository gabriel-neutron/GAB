-- =============================================================================================
-- 0021 — a bare string value of an attribute is never blank                            ORDERED
--
-- M9 speaks of null, not blank, and a blank string was never refused: {"v": ""} and {"v": "   "}
-- both passed attrs_valid. A list keeps no minimum: {"v": []} states a known "none", a real
-- fact, and it is left alone. Only the bare string case is a value nobody could have meant.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION attrs_valid(a jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(jsonb_typeof(a), 'absent') = 'object'
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_each(a) AS e(k, val)
        WHERE
          -- the key is lower snake case, and short enough to be an identifier
          e.k !~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'
          OR length(e.k) > 63
          -- the attribute is an object of exactly `v` and `src`
          OR coalesce(jsonb_typeof(val), 'absent') <> 'object'
          OR NOT (val ? 'v')
          OR NOT (val ? 'src')
          OR (SELECT count(*) FROM jsonb_object_keys(val) AS ok
               WHERE ok NOT IN ('v','src')) > 0
          -- the value is never null, never an object, never absent
          OR coalesce(jsonb_typeof(val->'v'), 'absent') IN ('null','object','absent')
          -- a bare string value is never blank
          OR (jsonb_typeof(val->'v') = 'string'
              AND length(btrim(val->>'v', E' \t\n\r\f\v')) = 0)
          -- a list holds scalars only
          OR (jsonb_typeof(val->'v') = 'array' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(val->'v') AS x
                 WHERE jsonb_typeof(x) IN ('object','array','null')))
          -- src is a non-empty array of non-blank strings
          OR coalesce(jsonb_typeof(val->'src'), 'absent') <> 'array'
          OR jsonb_array_length(val->'src') = 0
          OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(val->'src') AS s
                WHERE jsonb_typeof(s) <> 'string'
                   OR length(btrim(s #>> '{}', E' \t\n\r\f\v')) = 0));
$$;

RESET ROLE;
