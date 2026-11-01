-- =============================================================================================
-- 0090 — Cyprus in the list of jurisdiction codes                                       ORDERED
--
-- The record held Cyprus as "Cyprus" on some companies and as "CY" on others, so a join on the
-- value found only a part of them. This migration adds the code CY to the list of migration
-- 0079: it writes the function again with the new list, and writes each value again, as 0079
-- does. The spellings of the tool check (JURISDICTION_SPELLINGS) hold the same list.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE OR REPLACE FUNCTION jurisdiction_code(p_spelling text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp AS $$
  SELECT s.code
    FROM (VALUES ('RU', 'ru'), ('RU', 'russia'), ('RU', 'russian federation'),
                 ('RU', 'россия'), ('RU', 'российская федерация'), ('RU', 'рф'),
                 ('CY', 'cy'), ('CY', 'cyprus'), ('CY', 'republic of cyprus'),
                 ('CY', 'кипр'), ('CY', 'республика кипр')) AS s(code, spelling)
   WHERE s.spelling = lower(btrim(regexp_replace(normalize(p_spelling, NFKC), '\s+', ' ', 'g')))
$$;

UPDATE entities
   SET attrs = coded_jurisdiction(attrs)
 WHERE attrs ? 'registration_jurisdiction' AND attrs <> coded_jurisdiction(attrs);

RESET ROLE;
