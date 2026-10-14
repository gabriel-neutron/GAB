-- =============================================================================================
-- 0079 — the registration jurisdiction as its ISO 3166-1 code                           ORDERED
--
-- ONE COUNTRY, ONE VALUE. The sources write the registration jurisdiction of a company in more
-- than one way ("Russia", "Russian Federation", "RU"), and the record held each spelling, so a
-- join on the value found only a part of the companies. The record now holds the code of
-- ISO 3166-1, the form of GLEIF. Only Russia is in the list now. A country is added by a line in
-- the list and in the spellings of the tool check, in a new migration that writes each value
-- again with the new list, as this one does.
--
-- THE CODE IS THE FORM OF THE VALUE, NOT A NEW CLAIM. The cited passage keeps the text of the
-- source. An act is frozen, so an act of the ledger keeps the value that its writer gave: the
-- propose tool gives the code, and an older act or a signed act can give a spelling. The fill
-- below writes no act: each value keeps its documents and the act that set it, so it keeps its
-- label and its passages, and the last day of a change of the row stays the day of its last
-- act. A trigger of the re-runnable files writes the code at each later write of an entity.
--
-- A spelling is compared in its NFKC form, in lower case, with no space at the ends and one
-- space between two words. A list of values is coded one by one, and keeps each value once, in
-- its first place. A value with no known spelling stays as it is.
--
-- The function is here and not in the re-runnable files, because the values of the record and the
-- values of a later write must come from one list: a change of the list needs a new migration.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION jurisdiction_code(p_spelling text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp AS $$
  SELECT s.code
    FROM (VALUES ('RU', 'ru'), ('RU', 'russia'), ('RU', 'russian federation'),
                 ('RU', 'россия'), ('RU', 'российская федерация'), ('RU', 'рф')) AS s(code, spelling)
   WHERE s.spelling = lower(btrim(regexp_replace(normalize(p_spelling, NFKC), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION coded_jurisdiction(p_attrs jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_attrs->'registration_jurisdiction') <> 'object' THEN p_attrs
    WHEN jsonb_typeof(p_attrs #> '{registration_jurisdiction,v}') = 'string' THEN
      jsonb_set(p_attrs, '{registration_jurisdiction,v}',
        to_jsonb(coalesce(public.jurisdiction_code(p_attrs #>> '{registration_jurisdiction,v}'),
                          p_attrs #>> '{registration_jurisdiction,v}')))
    WHEN jsonb_typeof(p_attrs #> '{registration_jurisdiction,v}') = 'array' THEN
      jsonb_set(p_attrs, '{registration_jurisdiction,v}',
        (SELECT coalesce(jsonb_agg(c.one ORDER BY c.n), '[]'::jsonb)
           FROM (SELECT y.one, min(y.n) AS n
                   FROM (SELECT CASE WHEN jsonb_typeof(x.one) = 'string'
                                     THEN coalesce(to_jsonb(public.jurisdiction_code(x.one #>> '{}')),
                                                   x.one)
                                     ELSE x.one END AS one, x.n
                           FROM jsonb_array_elements(p_attrs #> '{registration_jurisdiction,v}')
                                WITH ORDINALITY AS x(one, n)) AS y
                  GROUP BY y.one) AS c))
    ELSE p_attrs
  END
$$;

UPDATE entities
   SET attrs = coded_jurisdiction(attrs)
 WHERE attrs ? 'registration_jurisdiction' AND attrs <> coded_jurisdiction(attrs);

RESET ROLE;
