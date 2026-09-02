-- =============================================================================================
-- 0002 — the types, and the one function a CHECK depends on                            ORDERED
--
-- A domain is a type, so it is ordered (ADR 0003 §3). A function that a CHECK calls is ordered
-- too: db/migrations/ runs before db/apply/, and a CHECK cannot call a function created later.
-- Measured on #14 and #15.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- --------------------------------------------------------------------------------- doc_id ---
-- Format only. NO 'manual' CLAUSE: `manual` is a real row of documents (M8), and a shared ban
-- makes that row unrepresentable — measured on #14.
--
-- VALUE IS NOT NULL is load-bearing. Without it ARRAY['a', NULL] is accepted, because a domain
-- check that returns NULL counts as satisfied. It is the kind of clause a later tidy-up removes
-- with no test failure.
--
-- One-argument btrim strips spaces only, so the character class is explicit: a tab-only and a
-- newline-only identifier were both accepted without it.
CREATE DOMAIN doc_id AS text CHECK (
  VALUE IS NOT NULL
  AND VALUE = btrim(VALUE, E' \t\n\r\f\v')
  AND length(VALUE) > 0);


-- ---------------------------------------------------------------------------- attrs_valid ---
-- THE ATTRIBUTE ENVELOPE. It carries four rules at once:
--   invariant 1  every attribute cites at least one document
--   invariant 4  a value is never null; the unknown is the absence of a key
--   M7           an attribute is exactly {"v": …, "src": [...]}, with no third key
--   M9           a value is a scalar or a flat list, never an object and never nested
--
-- EVERY BRANCH IS WRAPPED IN coalesce. A CHECK passes when its expression is NULL, so an
-- unwrapped jsonb_typeof on a missing key would let the row through in silence.
CREATE FUNCTION attrs_valid(a jsonb) RETURNS boolean
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


-- ----------------------------------------------------------------------- attrs_cites_manual ---
-- Invariant 3, for the value. docs/spec.md §2 fixes the tier as "Database for the value", and a
-- check that reads only proposals.src leaves an agent free to write src: ["manual"] INSIDE its
-- own payload.
CREATE FUNCTION attrs_cites_manual(a jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_each(coalesce(a, '{}'::jsonb)) AS e(k, val)
     WHERE coalesce(jsonb_typeof(val->'src'), 'absent') = 'array'
       AND (val->'src') @> '"manual"'::jsonb);
$$;


-- ------------------------------------------------------------------------ attrs_src_within ---
-- The operator's rule, made mechanical: a source list on a value is exactly what the writing act
-- cited, and it is never extended by hand. It makes a fabricated citation impossible.
CREATE FUNCTION attrs_src_within(a jsonb, docs text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM jsonb_each(coalesce(a, '{}'::jsonb)) AS e(k, val)
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN coalesce(jsonb_typeof(val->'src'), 'absent') = 'array'
             THEN val->'src' ELSE '[]'::jsonb END) AS s(doc)
     WHERE NOT (coalesce(docs, ARRAY[]::text[]) @> ARRAY[s.doc]));
$$;

RESET ROLE;
