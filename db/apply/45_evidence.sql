-- =============================================================================================
-- 45 — the evidence checks                                                        RE-RUNNABLE
--
-- CODE CHECKS EACH SPAN AND EACH IDENTITY, AND NO MODEL DOES. A reader gives offsets and enums.
-- This file reads the stored readings, the stored text and the stored record, and it calculates
-- every result itself. The door that writes a result takes a job and a claim, and no result: a
-- caller that could pass a result could write any result it liked.
--
-- THE HELPERS HAVE NO GRANT. They run inside the doors, as the owner. A default privilege of the
-- owner takes EXECUTE from PUBLIC on each function it creates, so no role can call one directly.
--
-- THE WORD LISTS ARE SMALL, AND THEY FIT THE FIXTURES. A larger list is new seed rows with a higher
-- version. A word that is a common part of another word stays out: "may" is a month in English,
-- so the hedge list holds "may be" and not "may".
-- =============================================================================================

SET ROLE gabriel_owner;

-- ============================================================================ THE TEXT TOOLS ==

-- The letters of the three languages of the word lists, and the digits. A cue word or a name has a
-- boundary where one of these characters stops.
CREATE OR REPLACE FUNCTION ev_word_class() RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT 'A-Za-z0-9\u00C0-\u024F\u0400-\u04FF' $$;

CREATE OR REPLACE FUNCTION ev_re_escape(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(p, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
$$;

-- Lower case, and each run of white space becomes one space. The fuzzy match and the literal match
-- both compare this form.
CREATE OR REPLACE FUNCTION ev_fold(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(lower(regexp_replace(coalesce(p, ''), '[[:space:]\u00A0\u202F]+', ' ', 'g')))
$$;

-- True when the folded text holds the folded needle as whole words.
CREATE OR REPLACE FUNCTION ev_has_word(p_text text, p_needle text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT ev_fold(p_needle) <> ''
     AND ev_fold(p_text) ~ ('(^|[^' || ev_word_class() || '])' || ev_re_escape(ev_fold(p_needle))
                            || '($|[^' || ev_word_class() || '])')
$$;

-- The place of the folded needle as whole words in the folded text, counted from 1, or 0.
CREATE OR REPLACE FUNCTION ev_word_at(p_text text, p_needle text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN ev_fold(p_needle) = '' THEN 0 ELSE
    coalesce(regexp_instr(ev_fold(p_text),
      '(?<![' || ev_word_class() || '])' || ev_re_escape(ev_fold(p_needle))
      || '(?![' || ev_word_class() || '])'), 0) END
$$;

-- THE SPAN HOLDS LIVE TEXT IN LATIN OR CYRILLIC, DIGITS, SPACE AND PUNCTUATION. Each word list is in
-- one of these scripts, so a span in another script has no list, and the window check cannot run.
-- The hidden-text placeholder is allowed here, because the span check refuses it on its own.
CREATE OR REPLACE FUNCTION ev_script_ok(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p ~ ('^[A-Za-z\u00C0-\u024F\u0400-\u04FF0-9[:space:]!-/:-@\[-`{-~'
              || '\u00A0-\u00BF\u2010-\u2027\u2030-\u205E\u2116\u2212\uFFFC]*$')
$$;

-- THE CAPTCHA WORDS ARE THE WORDS OF THE FETCH TOOL. A test holds the two patterns equal.
CREATE OR REPLACE FUNCTION ev_captcha_pattern() RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT 'captcha|cf-turnstile|cf-challenge|challenge-platform' $$;

-- Levenshtein distance on code points. A name of a few words is short, so the square cost is small.
CREATE OR REPLACE FUNCTION ev_levenshtein(a text, b text) RETURNS int
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  x text[] := coalesce(string_to_array(a, NULL), '{}');
  y text[] := coalesce(string_to_array(b, NULL), '{}');
  n int := cardinality(x);
  m int := cardinality(y);
  prev int[];
  cur int[];
  i int;
  j int;
BEGIN
  IF n = 0 THEN RETURN m; END IF;
  IF m = 0 THEN RETURN n; END IF;
  prev := ARRAY(SELECT generate_series(0, m));
  FOR i IN 1..n LOOP
    cur := ARRAY[i];
    FOR j IN 1..m LOOP
      cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
                          prev[j] + CASE WHEN x[i] = y[j] THEN 0 ELSE 1 END);
    END LOOP;
    prev := cur;
  END LOOP;
  RETURN prev[m + 1];
END $$;

CREATE OR REPLACE FUNCTION ev_name_ratio(a text, b text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN greatest(char_length(ev_fold(a)), char_length(ev_fold(b))) = 0 THEN 0
    ELSE (greatest(char_length(ev_fold(a)), char_length(ev_fold(b)))
          - ev_levenshtein(ev_fold(a), ev_fold(b)))::numeric
         / greatest(char_length(ev_fold(a)), char_length(ev_fold(b))) END
$$;

-- A NAME IS FOUND BY AN EXACT MATCH OF WHOLE WORDS, OR BY THE FUZZY MATCH ABOVE THE PARAMETER ROW.
-- With no row, no fuzzy match passes. The fuzzy match compares the name with each run of words of
-- the text that has one word fewer, the same count or one word more.
CREATE OR REPLACE FUNCTION ev_name_found(p_name text, p_text text) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_min numeric;
  v_words text[];
  v_count int;
  v_size int;
  v_at int;
BEGIN
  IF ev_fold(p_name) = '' THEN RETURN false; END IF;
  IF ev_has_word(p_text, p_name) THEN RETURN true; END IF;
  SELECT p.value INTO v_min FROM public.parameter p WHERE p.key = 'name_match.min_ratio';
  IF v_min IS NULL THEN RETURN false; END IF;
  v_words := ARRAY(SELECT w FROM regexp_split_to_table(
                     regexp_replace(ev_fold(p_text), '[^' || ev_word_class() || ' ]', ' ', 'g'),
                     ' +') AS w WHERE w <> '');
  v_count := cardinality(regexp_split_to_array(ev_fold(p_name), ' '));
  FOR v_size IN greatest(1, v_count - 1)..v_count + 1 LOOP
    FOR v_at IN 1..cardinality(v_words) - v_size + 1 LOOP
      IF ev_name_ratio(p_name, array_to_string(v_words[v_at:v_at + v_size - 1], ' ')) >= v_min THEN
        RETURN true;
      END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END $$;

-- ============================================================================ THE IDENTIFIERS ==

-- AN IDENTIFIER IS ASCII LETTERS AND DIGITS, AFTER CODE REMOVES SPACES AND SEPARATORS. A value with
-- any other character, a look-alike letter of another script or a full-width digit included, has
-- no normal form, and it matches nothing. Code never folds a look-alike character.
CREATE OR REPLACE FUNCTION ev_ident_norm(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n ~ '^[A-Za-z0-9]+$' THEN n END
    FROM (SELECT regexp_replace(coalesce(p, ''), '[[:space:]./-]', '', 'g') AS n) AS x
$$;

-- An identifier is found when its characters stand in the text in order, with at most one space or
-- separator between two of them, and with no digit next to its two ends. The match is exact: no
-- edit distance applies to an identifier.
CREATE OR REPLACE FUNCTION ev_ident_found(p_value text, p_text text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := ev_ident_norm(p_value);
  v_edge text;
  v_body text;
BEGIN
  IF v IS NULL THEN RETURN false; END IF;
  v_edge := CASE WHEN v ~ '^[0-9]+$' THEN '0-9' ELSE '0-9A-Za-z' END;
  v_body := array_to_string(ARRAY(SELECT ev_re_escape(c) FROM unnest(string_to_array(v, NULL)) AS c),
                            '[ ./-]?');
  RETURN coalesce(p_text, '') ~ ('(?<![' || v_edge || '])' || v_body || '(?![' || v_edge || '])');
END $$;

-- IMO: seven digits, and the seventh is the sum of the first six weighted seven down to two,
-- modulo ten.
CREATE OR REPLACE FUNCTION ev_imo_valid(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p ~ '^[0-9]{7}$'
    AND (SELECT sum(substr(p, i, 1)::int * (8 - i)) FROM generate_series(1, 6) AS i) % 10
        = substr(p, 7, 1)::int, false)
$$;

-- OGRN: thirteen digits with the first twelve modulo 11, then modulo 10; or fifteen digits (OGRNIP)
-- with the first fourteen modulo 13, then modulo 10.
CREATE OR REPLACE FUNCTION ev_ogrn_valid(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p ~ '^[0-9]{13}$' THEN (left(p, 12)::numeric % 11) % 10 = right(p, 1)::numeric
    WHEN p ~ '^[0-9]{15}$' THEN (left(p, 14)::numeric % 13) % 10 = right(p, 1)::numeric
    ELSE false END
$$;

-- LEI: twenty upper-case letters and digits. ISO 7064 mod 97-10: each letter becomes two digits,
-- A as 10 to Z as 35, and the whole number modulo 97 is 1.
CREATE OR REPLACE FUNCTION ev_lei_valid(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p ~ '^[0-9A-Z]{18}[0-9]{2}$'
    AND (SELECT string_agg(CASE WHEN c ~ '[A-Z]' THEN (ascii(c) - 55)::text ELSE c END, ''
                           ORDER BY i)
           FROM unnest(string_to_array(p, NULL)) WITH ORDINALITY AS t(c, i))::numeric % 97 = 1,
    false)
$$;

-- MMSI and CIN take a format check only.
CREATE OR REPLACE FUNCTION ev_mmsi_format(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(p ~ '^[0-9]{9}$', false) $$;

CREATE OR REPLACE FUNCTION ev_cin_format(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p ~ '^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$', false)
$$;

-- ================================================================================ THE DATES ==

CREATE OR REPLACE FUNCTION ev_month(p text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(p)
    WHEN 'january' THEN 1 WHEN 'february' THEN 2 WHEN 'march' THEN 3 WHEN 'april' THEN 4
    WHEN 'may' THEN 5 WHEN 'june' THEN 6 WHEN 'july' THEN 7 WHEN 'august' THEN 8
    WHEN 'september' THEN 9 WHEN 'october' THEN 10 WHEN 'november' THEN 11
    WHEN 'december' THEN 12
    WHEN 'января' THEN 1 WHEN 'февраля' THEN 2 WHEN 'марта' THEN 3 WHEN 'апреля' THEN 4
    WHEN 'мая' THEN 5 WHEN 'июня' THEN 6 WHEN 'июля' THEN 7 WHEN 'августа' THEN 8
    WHEN 'сентября' THEN 9 WHEN 'октября' THEN 10 WHEN 'ноября' THEN 11 WHEN 'декабря' THEN 12
    WHEN 'січня' THEN 1 WHEN 'лютого' THEN 2 WHEN 'березня' THEN 3 WHEN 'квітня' THEN 4
    WHEN 'травня' THEN 5 WHEN 'червня' THEN 6 WHEN 'липня' THEN 7 WHEN 'серпня' THEN 8
    WHEN 'вересня' THEN 9 WHEN 'жовтня' THEN 10 WHEN 'листопада' THEN 11 WHEN 'грудня' THEN 12
  END
$$;

CREATE OR REPLACE FUNCTION ev_make_date(y int, m int, d int) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN make_date(y, m, d);
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- EACH DATE OF A TEXT, AS THE LITERAL AND A TYPED PARSE. An ISO date and a date with a month name
-- have one parse. A date of digits and separators needs the locale of its issuer: with no locale,
-- or with two valid parses that differ, the parse is NULL and the date is ambiguous.
CREATE OR REPLACE FUNCTION ev_dates(p_text text, p_locale text)
RETURNS TABLE (literal text, parsed date, ambiguous boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  m text[];
  v_a date;
  v_b date;
BEGIN
  FOR m IN SELECT regexp_matches(coalesce(p_text, ''), '(\d{4})-(\d{2})-(\d{2})', 'g') LOOP
    literal := m[1] || '-' || m[2] || '-' || m[3];
    parsed := ev_make_date(m[1]::int, m[2]::int, m[3]::int);
    ambiguous := false;
    RETURN NEXT;
  END LOOP;
  FOR m IN SELECT regexp_matches(coalesce(p_text, ''),
             '(?<![0-9])(\d{1,2})\s+([A-Za-z\u0400-\u04FF]+)\s+(\d{4})(?![0-9])', 'g') LOOP
    IF ev_month(m[2]) IS NOT NULL THEN
      literal := m[1] || ' ' || m[2] || ' ' || m[3];
      parsed := ev_make_date(m[3]::int, ev_month(m[2]), m[1]::int);
      ambiguous := false;
      RETURN NEXT;
    END IF;
  END LOOP;
  FOR m IN SELECT regexp_matches(coalesce(p_text, ''),
             '(?<![0-9])(\d{1,2})[./](\d{1,2})[./](\d{4})(?![0-9])', 'g') LOOP
    literal := m[1] || '/' || m[2] || '/' || m[3];
    v_a := ev_make_date(m[3]::int, m[2]::int, m[1]::int);
    v_b := ev_make_date(m[3]::int, m[1]::int, m[2]::int);
    IF p_locale IS NULL OR p_locale NOT IN ('dmy','mdy')
       OR (v_a IS NOT NULL AND v_b IS NOT NULL AND v_a <> v_b) THEN
      parsed := NULL;
      ambiguous := true;
    ELSE
      parsed := CASE p_locale WHEN 'dmy' THEN v_a ELSE v_b END;
      ambiguous := parsed IS NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;

-- ======================================================================== THE CLAIM AND ITS FIELDS ==

-- The kind of record that an entity type is, for the identity check and the adverse predicate.
CREATE OR REPLACE FUNCTION ev_subject_kind(p_type text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'vessel' THEN 'vessel' WHEN 'company' THEN 'company' WHEN 'bank' THEN 'company'
    WHEN 'person' THEN 'person' WHEN 'military_unit' THEN 'unit' END
$$;

-- THE KIND OF A FIELD DECIDES ITS MATCH. An identifier matches exactly, a name may match fuzzily, a
-- date and a number are parsed, and every other text is literal: a place is literal text alone. A
-- boolean is a flag of the claim, and no span holds it as text.
CREATE OR REPLACE FUNCTION ev_field_kind(p_key text, p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_value) = 'boolean' THEN 'flag'
    WHEN p_key IN ('imo','mmsi','lei','ogrn','cin','vch_number','registration_number','tax_id',
                   'inn','call_sign','passport_number','snils','national_id') THEN 'identifier'
    WHEN p_key IN ('label','name','former_names','aliases','label_cyrillic','related') THEN 'name'
    WHEN jsonb_typeof(p_value) = 'number' THEN 'number'
    WHEN jsonb_typeof(p_value) = 'string' AND p_value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}$' THEN 'date'
    ELSE 'literal' END
$$;

-- The subject of a claim, its kind, and the fields that the span must hold. A list value gives one
-- field for each element. The label of a new entity is the subject and no value field.
CREATE OR REPLACE FUNCTION ev_claim_fields(p_claim uuid)
RETURNS TABLE (field text, kind text, value text, is_subject boolean)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  p public.proposals%ROWTYPE;
  v_subject text;
  v_key text;
  v_attr jsonb;
  v_value jsonb;
BEGIN
  SELECT * INTO p FROM public.proposals x WHERE x.id = p_claim;
  IF p.op = 'create_entity' THEN
    v_subject := p.payload ->> 'label';
  ELSIF p.op = 'create_relation' THEN
    SELECT e.label INTO v_subject FROM public.entities e
     WHERE e.id = (p.payload ->> 'src_id')::uuid AND coalesce(p.payload ->> 'src_kind', 'entity') = 'entity';
    field := 'related'; kind := 'name'; is_subject := false;
    SELECT e.label INTO value FROM public.entities e
     WHERE e.id = (p.payload ->> 'dst_id')::uuid AND coalesce(p.payload ->> 'dst_kind', 'entity') = 'entity';
    IF value IS NOT NULL THEN RETURN NEXT; END IF;
    FOREACH v_key IN ARRAY ARRAY['valid_from','valid_to'] LOOP
      IF p.payload ? v_key THEN
        field := v_key; kind := 'date'; value := p.payload ->> v_key; is_subject := false;
        RETURN NEXT;
      END IF;
    END LOOP;
  ELSIF p.op = 'update_attrs' AND p.target_kind = 'entity' THEN
    SELECT e.label INTO v_subject FROM public.entities e WHERE e.id = p.target_id;
  END IF;

  IF v_subject IS NOT NULL THEN
    field := 'label'; kind := 'name'; value := v_subject; is_subject := true;
    RETURN NEXT;
  END IF;

  FOR v_key, v_attr IN SELECT a.key, a.value FROM jsonb_each(coalesce(p.payload -> 'attrs', '{}')) AS a
  LOOP
    FOR v_value IN SELECT CASE WHEN jsonb_typeof(v_attr -> 'v') = 'array'
                               THEN x ELSE v_attr -> 'v' END
                     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_attr -> 'v') = 'array'
                                                    THEN v_attr -> 'v'
                                                    ELSE jsonb_build_array(v_attr -> 'v') END) AS x
    LOOP
      field := v_key; kind := ev_field_kind(v_key, v_value); value := v_value #>> '{}';
      is_subject := false;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END $$;

-- ONE FIELD AGAINST ONE TEXT: `found`, `held` when the text holds a date or a number that code
-- cannot parse without doubt, or `absent`.
CREATE OR REPLACE FUNCTION ev_field_in(p_kind text, p_value text, p_text text, p_locale text)
RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
  d record;
  v_held boolean := false;
BEGIN
  IF p_kind = 'identifier' THEN
    RETURN CASE WHEN ev_ident_found(p_value, p_text) THEN 'found' ELSE 'absent' END;
  ELSIF p_kind = 'name' THEN
    RETURN CASE WHEN ev_name_found(p_value, p_text) THEN 'found' ELSE 'absent' END;
  ELSIF p_kind = 'date' THEN
    FOR d IN SELECT * FROM ev_dates(p_text, p_locale) LOOP
      IF d.parsed IS NOT NULL AND d.parsed::text = p_value THEN RETURN 'found'; END IF;
      IF d.ambiguous THEN v_held := true; END IF;
    END LOOP;
    RETURN CASE WHEN v_held THEN 'held' ELSE 'absent' END;
  ELSIF p_kind = 'number' THEN
    IF coalesce(p_text, '') ~ ('(?<![0-9.,])' || ev_re_escape(p_value) || '(?![0-9]|[.,][0-9])') THEN
      RETURN 'found';
    END IF;
    -- A group of three digits after one comma or one point is a thousands group in one locale and
    -- a decimal part in another.
    IF coalesce(p_text, '') ~ '(?<![0-9.,])[0-9]{1,3}[.,][0-9]{3}(?![0-9.,])' THEN RETURN 'held'; END IF;
    RETURN 'absent';
  ELSIF p_kind = 'flag' THEN
    RETURN 'found';
  END IF;
  RETURN CASE WHEN ev_has_word(p_text, p_value) THEN 'found' ELSE 'absent' END;
END $$;

-- A parser row holds its fields as code read them. The label of a claim is the field `name`.
CREATE OR REPLACE FUNCTION ev_parsed_agrees(p_kind text, p_value text, p_parsed text) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE v_min numeric;
BEGIN
  IF p_kind = 'identifier' THEN
    RETURN ev_ident_norm(p_value) IS NOT NULL AND ev_ident_norm(p_value) = ev_ident_norm(p_parsed);
  ELSIF p_kind = 'name' THEN
    IF ev_fold(p_value) = ev_fold(p_parsed) THEN RETURN true; END IF;
    SELECT p.value INTO v_min FROM public.parameter p WHERE p.key = 'name_match.min_ratio';
    RETURN v_min IS NOT NULL AND ev_name_ratio(p_value, p_parsed) >= v_min;
  END IF;
  RETURN ev_fold(p_value) = ev_fold(p_parsed);
END $$;

-- ============================================================================ THE WINDOW ==

-- The sentences of a page, as offsets in code points [s, e). A sentence ends after a run of
-- terminal marks and white space, and at each line end, so one table row is one sentence.
CREATE OR REPLACE FUNCTION ev_sentences(p_page text)
RETURNS TABLE (n int, s int, e int)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_from int := 1;
  v_to int;
  v_len int := char_length(coalesce(p_page, ''));
BEGIN
  n := 0;
  WHILE v_from <= v_len LOOP
    v_to := regexp_instr(p_page, '[.!?\u2026]+[[:space:]]+|\n', v_from, 1, 1);
    IF v_to = 0 THEN v_to := v_len + 1; END IF;
    n := n + 1; s := v_from - 1; e := v_to - 1;
    RETURN NEXT;
    v_from := v_to;
  END LOOP;
END $$;

-- The highest version of a list. A list with no row has version 0, and it matches nothing.
CREATE OR REPLACE FUNCTION ev_word_version() RETURNS int
LANGUAGE sql STABLE AS $$ SELECT coalesce(max(version), 0) FROM public.evidence_word $$;

-- True when the text holds a cue of this kind from the newest list, in any of its languages. No
-- claim language is stored yet, so each language is read: a cue of another language can only
-- raise a flag, and a flag can only hold a claim back.
CREATE OR REPLACE FUNCTION ev_cue(p_text text, p_kind text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.evidence_word w
                  WHERE w.version = ev_word_version() AND w.cue_kind = p_kind
                    AND ev_has_word(p_text, w.word))
$$;

CREATE OR REPLACE FUNCTION ev_court_act(p_text text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.court_act_cue c
                  WHERE c.version = (SELECT max(version) FROM public.court_act_cue)
                    AND ev_has_word(p_text, c.cue))
$$;

CREATE OR REPLACE FUNCTION ev_modality_rank(p text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p WHEN 'enacts' THEN 5 WHEN 'asserts' THEN 4 WHEN 'attributes' THEN 3
                WHEN 'alleges' THEN 2 WHEN 'denies' THEN 1 END
$$;

-- ============================================================================ THE IDENTITY ==

CREATE OR REPLACE FUNCTION ev_attr_values(p_attrs jsonb, p_key text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(ARRAY(
    SELECT x #>> '{}'
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_attrs -> p_key -> 'v') = 'array'
                                     THEN p_attrs -> p_key -> 'v'
                                     WHEN p_attrs -> p_key -> 'v' IS NULL THEN '[]'::jsonb
                                     ELSE jsonb_build_array(p_attrs -> p_key -> 'v') END) AS x),
    '{}')
$$;

-- True when a date stored as ISO text stands in the page as a date that code parses without doubt.
CREATE OR REPLACE FUNCTION ev_date_in_page(p_iso text, p_page text, p_locale text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_iso IS NOT NULL
     AND EXISTS (SELECT 1 FROM ev_dates(p_page, p_locale) AS d WHERE d.parsed::text = p_iso)
$$;

-- THE IDENTITY OF ONE ENTITY OF THE RECORD AGAINST ONE PAGE: pass, fail, lead, pending, or
-- vch_conflict. The keys come from the stored attributes of the entity and its stored relations.
-- A name alone is a lead. A record that the check needs and that is not stored is pending.
CREATE OR REPLACE FUNCTION ev_identity_of(p_entity uuid, p_page text, p_doc_date date,
                                          p_locale text)
RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
  e public.entities%ROWTYPE;
  v_kind text;
  v_value text;
  v_values text[];
  v_found boolean := false;
  v_bad boolean := false;
  v_held boolean := false;
  v_mark record;
  v_dob text;
  v_parent text;
BEGIN
  SELECT * INTO e FROM public.entities x WHERE x.id = p_entity;
  IF NOT FOUND THEN RETURN 'pending'; END IF;
  v_kind := ev_subject_kind(e.type);

  IF v_kind = 'vessel' THEN
    v_value := (ev_attr_values(e.attrs, 'imo'))[1];
    IF v_value IS NULL THEN RETURN 'pending'; END IF;
    IF NOT ev_imo_valid(v_value) THEN RETURN 'fail'; END IF;
    IF NOT ev_ident_found(v_value, p_page) THEN RETURN 'lead'; END IF;
    -- A mark of an issuer fails the identity. A mark from another source is a lead that the
    -- check cannot settle, so it waits.
    FOR v_mark IN
      SELECT m.mark, d.uri
        FROM unnest(ev_attr_values(e.attrs, 'imo_mark')) AS m(mark)
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(e.attrs -> 'imo_mark' -> 'src', '[]'))
             AS s(doc)
        LEFT JOIN public.documents d ON d.id = s.doc
       WHERE m.mark IN ('scrapped','cloned','duplicate')
    LOOP
      IF v_mark.uri IS NOT NULL AND public.issuer_card_for(v_mark.uri) IS NOT NULL THEN
        RETURN 'fail';
      END IF;
      v_held := true;
    END LOOP;
    IF v_held THEN RETURN 'pending'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.relations r
                    WHERE r.type = 'flags' AND p_entity IN (r.src_id, r.dst_id)
                      AND r.attrs ? 'mmsi' AND r.attrs ? 'name') THEN
      RETURN 'pending';
    END IF;
    IF EXISTS (SELECT 1 FROM public.relations r
                WHERE r.type = 'flags' AND p_entity IN (r.src_id, r.dst_id)
                  AND r.attrs ? 'mmsi' AND r.attrs ? 'name'
                  AND ev_mmsi_format(r.attrs -> 'mmsi' ->> 'v')
                  AND p_doc_date IS NOT NULL
                  AND (r.valid_from IS NULL OR r.valid_from <= p_doc_date)
                  AND (r.valid_to IS NULL OR r.valid_to >= p_doc_date)) THEN
      RETURN 'pass';
    END IF;
    RETURN 'fail';

  ELSIF v_kind = 'company' THEN
    FOR v_value, v_dob IN
      SELECT x.v, k.k
        FROM (VALUES ('ogrn'), ('lei'), ('cin'), ('registration_number'), ('tax_id')) AS k(k)
        CROSS JOIN LATERAL unnest(ev_attr_values(e.attrs, k.k)) AS x(v)
    LOOP
      IF NOT ev_ident_found(v_value, p_page) THEN CONTINUE; END IF;
      IF (v_dob = 'ogrn' AND NOT ev_ogrn_valid(v_value))
         OR (v_dob = 'lei' AND NOT ev_lei_valid(v_value))
         OR (v_dob = 'cin' AND NOT ev_cin_format(v_value))
         OR (v_dob = 'registration_number' AND v_value ~ '^[0-9]{13}$|^[0-9]{15}$'
             AND NOT ev_ogrn_valid(v_value)) THEN
        v_bad := true;
      ELSE
        v_found := true;
      END IF;
    END LOOP;
    IF v_bad THEN RETURN 'fail'; END IF;
    IF v_found THEN RETURN 'pass'; END IF;
    IF NOT (e.attrs ?| ARRAY['ogrn','lei','cin','registration_number','tax_id']) THEN
      RETURN 'pending';
    END IF;
    RETURN 'lead';

  ELSIF v_kind = 'person' THEN
    -- One strong identifier, or two identifiers: the date of birth and a registry id. The date of
    -- birth is compared here and stored nowhere.
    IF EXISTS (SELECT 1 FROM public.strong_id_kind k
                CROSS JOIN LATERAL unnest(ev_attr_values(e.attrs, k.kind)) AS x(v)
               WHERE k.version = (SELECT max(version) FROM public.strong_id_kind)
                 AND ev_ident_found(x.v, p_page)) THEN
      RETURN 'pass';
    END IF;
    v_dob := (ev_attr_values(e.attrs, 'date_of_birth'))[1];
    IF ev_date_in_page(v_dob, p_page, p_locale)
       AND EXISTS (SELECT 1 FROM unnest(ev_attr_values(e.attrs, 'tax_id')
                                        || ev_attr_values(e.attrs, 'registration_number')) AS x(v)
                    WHERE ev_ident_found(x.v, p_page)) THEN
      RETURN 'pass';
    END IF;
    IF v_dob IS NULL AND NOT (e.attrs ?| ARRAY['tax_id','registration_number'])
       AND NOT EXISTS (SELECT 1 FROM public.strong_id_kind k WHERE e.attrs ? k.kind) THEN
      RETURN 'pending';
    END IF;
    RETURN 'lead';

  ELSIF v_kind = 'unit' THEN
    v_values := ARRAY(SELECT DISTINCT v FROM unnest(ev_attr_values(e.attrs, 'vch_number')) AS v);
    IF cardinality(v_values) > 1 THEN RETURN 'vch_conflict'; END IF;
    IF cardinality(v_values) = 0 THEN RETURN 'pending'; END IF;
    SELECT p.label INTO v_parent FROM public.relations r
      JOIN public.entities p ON p.id = r.dst_id
     WHERE r.type = 'subordinate_to' AND r.src_id = p_entity
     ORDER BY r.created_at DESC LIMIT 1;
    IF v_parent IS NULL THEN RETURN 'pending'; END IF;
    IF (e.attrs ? 'active_from' AND p_doc_date < (e.attrs -> 'active_from' ->> 'v')::date)
       OR (e.attrs ? 'active_to' AND p_doc_date > (e.attrs -> 'active_to' ->> 'v')::date) THEN
      RETURN 'fail';
    END IF;
    IF ev_ident_found(v_values[1], p_page) AND ev_name_found(e.label, p_page)
       AND ev_name_found(v_parent, p_page) THEN
      RETURN 'pass';
    END IF;
    RETURN 'lead';
  END IF;
  RETURN 'pass';
END $$;

-- ===================================================================== THE ADVERSE PREDICATE ==

-- The parties of a claim: each person and each company that the claim names in the record, the
-- party that the claim itself creates, and each person or company of the record whose name stands
-- in the text as whole words.
CREATE OR REPLACE FUNCTION ev_parties(p_claim uuid, p_text text)
RETURNS TABLE (entity_id uuid, label text, party_kind text)
LANGUAGE sql STABLE AS $$
  WITH p AS (SELECT * FROM public.proposals WHERE id = p_claim),
  named AS (
    SELECT (p.payload ->> 'src_id')::uuid AS id FROM p WHERE p.op = 'create_relation'
    UNION SELECT (p.payload ->> 'dst_id')::uuid FROM p WHERE p.op = 'create_relation'
    UNION SELECT p.target_id FROM p WHERE p.op = 'update_attrs' AND p.target_kind = 'entity'
    UNION SELECT unnest(p.names) FROM p)
  SELECT e.id, e.label, ev_subject_kind(e.type)
    FROM public.entities e
   WHERE ev_subject_kind(e.type) IN ('person','company')
     AND (e.id IN (SELECT id FROM named) OR ev_has_word(p_text, e.label))
  UNION
  SELECT NULL::uuid, p.payload ->> 'label', ev_subject_kind(p.payload ->> 'type')
    FROM p
   WHERE p.op = 'create_entity' AND ev_subject_kind(p.payload ->> 'type') IN ('person','company')
$$;

-- THE PREDICATE OF A CLAIM, FROM THE LAST LOAD OF THE APPROVED LIST. A rule of kind `key` matches an
-- attribute key or the relation type of the claim. A rule of kind `keyword` matches the claim text
-- as whole words. A reader that sets adverse adds the marker of a reader for each party. A row
-- stays for ever: nothing here deletes or updates one.
CREATE OR REPLACE FUNCTION ev_set_adverse(p_claim uuid, p_span text, p_reader_adverse boolean)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p public.proposals%ROWTYPE;
  v_kind text;
  v_text text;
  v_load uuid;
  r record;
  q record;
BEGIN
  SELECT * INTO p FROM public.proposals x WHERE x.id = p_claim;
  IF p.op = 'create_entity' THEN
    v_kind := ev_subject_kind(p.payload ->> 'type');
  ELSIF p.op = 'create_relation' THEN
    SELECT ev_subject_kind(e.type) INTO v_kind FROM public.entities e
     WHERE e.id = (p.payload ->> 'src_id')::uuid;
  ELSIF p.op = 'update_attrs' THEN
    SELECT ev_subject_kind(e.type) INTO v_kind FROM public.entities e WHERE e.id = p.target_id;
  END IF;

  SELECT string_agg(t, ' ') INTO v_text FROM (
    SELECT coalesce(p_span, '') AS t
    UNION ALL SELECT coalesce(p.payload ->> 'label', '')
    UNION ALL SELECT a.value -> 'v' #>> '{}'
      FROM jsonb_each(coalesce(p.payload -> 'attrs', '{}')) AS a
     WHERE jsonb_typeof(a.value -> 'v') = 'string') AS x;

  SELECT l.load_id INTO v_load FROM public.adverse_predicate_rule l
   ORDER BY l.loaded_at DESC, l.load_id DESC LIMIT 1;

  FOR r IN
    SELECT * FROM public.adverse_predicate_rule u
     WHERE u.load_id = v_load AND u.subject_kind = v_kind
       AND ((u.row_kind = 'key' AND (p.payload -> 'attrs' ? u.key
                                     OR (p.op = 'create_relation' AND p.payload ->> 'type' = u.key)))
            OR (u.row_kind = 'keyword' AND ev_has_word(v_text, u.keyword)))
  LOOP
    FOR q IN SELECT * FROM ev_parties(p_claim, v_text) LOOP
      INSERT INTO public.adverse_predicate
        (claim_id, party_entity_id, party_label, party_kind, predicate, class, set_by, rule_id)
      VALUES (p_claim, q.entity_id, q.label, q.party_kind, r.predicate, r.class, 'code', r.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  IF p_reader_adverse THEN
    FOR q IN SELECT * FROM ev_parties(p_claim, coalesce(p_span, '')) LOOP
      INSERT INTO public.adverse_predicate
        (claim_id, party_entity_id, party_label, party_kind, predicate, class, set_by)
      VALUES (p_claim, q.entity_id, q.label, q.party_kind, 'reader_adverse', 'adverse_allegation',
              'reader')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ================================================================================ THE DOORS ==

-- THE DOOR OF A CITATION FOR A LATER STEP. The search loop adds the citations that hold against a
-- claim or deny it. The job is a check job that the caller holds, the claim cites the document of
-- the job, and the span lies in the named page. A second call for the same span returns the row
-- that stands.
CREATE OR REPLACE FUNCTION add_citation(
  p_job            uuid,
  p_claim          uuid,
  p_text_extractor text,
  p_page           int,
  p_start          int,
  p_end            int,
  p_modality       text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_doc text;
  v_text text;
  v_id uuid;
BEGIN
  SELECT j.document_id INTO v_doc FROM public.jobs j
   WHERE j.id = p_job AND j.status = 'running' AND j.claimed_by = session_user
     AND j.kind = 'evidence_check'
     FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not a running evidence_check job under this role', p_job
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = p_claim AND v_doc::doc_id = ANY (p.src)) THEN
    RAISE EXCEPTION 'proposal % does not exist or does not cite document %', p_claim, v_doc
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT t.text INTO v_text FROM public.document_text t
   WHERE t.document_id = v_doc AND t.extractor = p_text_extractor AND t.page = p_page;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'page % of the text set % of document % does not exist',
      p_page, p_text_extractor, v_doc
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start < 0 OR p_start >= p_end
     OR p_end > char_length(v_text) THEN
    RAISE EXCEPTION 'the span % to % lies outside page %', p_start, p_end, p_page
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF ev_modality_rank(p_modality) IS NULL THEN
    RAISE EXCEPTION 'the modality % is not one of enacts, asserts, attributes, alleges, denies',
      coalesce(p_modality, 'nothing')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.citation (claim_id, doc_id, text_extractor, page, start, "end", modality)
  VALUES (p_claim, v_doc, p_text_extractor, p_page, p_start, p_end, p_modality)
  ON CONFLICT (claim_id, doc_id, text_extractor, page, start, "end", modality) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT c.id INTO STRICT v_id FROM public.citation c
     WHERE c.claim_id = p_claim AND c.doc_id = v_doc AND c.text_extractor = p_text_extractor
       AND c.page = p_page AND c.start = p_start AND c."end" = p_end AND c.modality = p_modality;
  END IF;
  RETURN v_id;
END $$;

-- THE CHECK DOOR. It reads the first reading of the claim on the document of the job, the second
-- reading, the stored text, the stored record and the lists, and it appends one check row. It
-- takes no result argument.
--
-- NO FIRST READING, NO ROW. A claim can cite a document that no first reader read: a research
-- proposal, or an extraction that failed. No role but the owner reads the readings, so the door
-- returns no row, writes no citation and writes no check, and the claim has no current row.
--
-- THE SECOND READING DEPENDS ON THE DOCUMENT. A parser row of the claim is the second reading of a
-- structured issuer entry. The OCR row of the claim is the second reading of an image: a model
-- reading of an image is never paired, so two model readings count as one. Else the second reading
-- is the blind model reading whose span overlaps the first on the same page. With a second job that
-- failed or is absent, or a call of it that failed or that another model served, there is no second
-- reading, and the claim is held with no_second_reading.
--
-- THE SAME INPUTS GIVE THE SAME ROW. The key holds the claim, the readings, the list versions, the
-- reader fingerprints, the last probe, the parameter values and the result itself. A second call
-- with the same key returns the first row, and a new fact gives a new key and a new row.
CREATE OR REPLACE FUNCTION run_evidence_checks(p_job uuid, p_claim uuid)
RETURNS TABLE (check_id uuid, citation_id uuid, counts boolean, held jsonb, span_result text,
               support text, identity text, same_family text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_doc text;
  d public.documents%ROWTYPE;
  p public.proposals%ROWTYPE;
  r1 public.claim_reading%ROWTYPE;
  r2 public.claim_reading%ROWTYPE;
  v_has_r2 boolean := false;
  v_page text;
  v_span text;
  v_span2 text;
  v_locale text;
  v_image boolean;
  v_held jsonb := '{}';
  v_span_ok boolean := true;
  v_hidden boolean;
  v_window text := '';
  v_window_run boolean;
  v_flags jsonb := '{}';
  v_court boolean := false;
  v_support text;
  v_subject_found boolean := true;
  v_value_count int := 0;
  v_value_ok int := 0;
  v_name_only boolean;
  v_identity text := 'not_needed';
  v_one text;
  v_ocr boolean := false;
  v_same text := 'unknown';
  v_counts boolean;
  v_job2 text;
  v_cap int := 5;
  v_absence boolean;
  f record;
  v_in text;
  v_in2 text;
  v_pos_subject int;
  v_pos_value int;
  v_between text;
  v_sentence record;
  v_index int;
  v_entity uuid;
  v_unreadable boolean := false;
  v_doc_id text;
  v_citation uuid;
  v_ids uuid[];
  v_probe uuid;
  v_key text;
  v_result jsonb;
  v_row public.citation_check%ROWTYPE;
  v_kind text;
  v_word_version int := ev_word_version();
BEGIN
  SELECT j.document_id INTO v_doc FROM public.jobs j
   WHERE j.id = p_job AND j.status = 'running' AND j.claimed_by = session_user
     AND j.kind = 'evidence_check'
     FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not a running evidence_check job under this role', p_job
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO p FROM public.proposals x WHERE x.id = p_claim;
  IF NOT FOUND OR NOT (v_doc::doc_id = ANY (p.src)) THEN
    RAISE EXCEPTION 'proposal % does not exist or does not cite document %', p_claim, v_doc
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO d FROM public.documents x WHERE x.id = v_doc;

  SELECT * INTO r1 FROM public.claim_reading r
   WHERE r.claim_id = p_claim AND r.doc_id = v_doc AND r.reader_no = 1 AND r.reader_kind = 'llm'
   ORDER BY r.created_at DESC, r.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT t.text INTO v_page FROM public.document_text t
   WHERE t.document_id = v_doc AND t.extractor = r1.text_extractor AND t.page = r1.page;
  v_span := substr(v_page, r1.start + 1, r1."end" - r1.start);
  v_locale := to_jsonb(public.issuer_card_for(d.uri)) ->> 'date_locale';
  v_image := lower(coalesce(d.mime, '')) LIKE 'image/%' OR r1.text_extractor LIKE 'tesseract:%';

  -- ----------------------------------------------------------- the second reading
  SELECT * INTO r2 FROM public.claim_reading r
   WHERE r.claim_id = p_claim AND r.doc_id = v_doc AND r.reader_kind = 'parser'
   ORDER BY r.created_at DESC, r.id DESC LIMIT 1;
  v_has_r2 := FOUND;
  IF NOT v_has_r2 AND v_image THEN
    SELECT * INTO r2 FROM public.claim_reading r
     WHERE r.claim_id = p_claim AND r.doc_id = v_doc AND r.reader_kind = 'ocr'
     ORDER BY r.created_at DESC, r.id DESC LIMIT 1;
    v_has_r2 := FOUND;
    v_ocr := v_has_r2;
  ELSIF NOT v_has_r2 THEN
    SELECT * INTO r2 FROM public.claim_reading r
     WHERE r.reader_no = 2 AND r.reader_kind = 'llm' AND r.doc_id = v_doc
       AND r.text_extractor = r1.text_extractor AND r.page = r1.page
       AND r.start < r1."end" AND r."end" > r1.start
     ORDER BY least(r."end", r1."end") - greatest(r.start, r1.start) DESC, r.created_at DESC, r.id
     LIMIT 1;
    v_has_r2 := FOUND;
    SELECT j.status INTO v_job2 FROM public.jobs j
     WHERE j.document_id = v_doc AND j.kind = 'second_read'
     ORDER BY j.created_at DESC, j.id DESC LIMIT 1;
    IF v_job2 IS NULL OR v_job2 IN ('failed','queued','running') THEN
      v_held := v_held || '{"reading":"no_second_reading"}';
      v_has_r2 := false;
    ELSIF v_has_r2 THEN
      IF EXISTS (SELECT 1 FROM public.model_call m WHERE m.id = r2.model_call_id
                    AND (m.outcome <> 'ok' OR m.served_model IS DISTINCT FROM m.requested_model)) THEN
        v_held := v_held || '{"reading":"no_second_reading"}';
        v_has_r2 := false;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.model_call m
                   JOIN public.jobs j ON j.id = m.job_id
                  WHERE j.document_id = v_doc AND j.kind = 'second_read'
                    AND j.id = (SELECT x.id FROM public.jobs x
                                 WHERE x.document_id = v_doc AND x.kind = 'second_read'
                                 ORDER BY x.created_at DESC, x.id DESC LIMIT 1)
                    AND (m.outcome <> 'ok' OR m.served_model IS DISTINCT FROM m.requested_model)) THEN
        v_held := v_held || '{"reading":"no_second_reading"}';
      ELSE
        v_held := v_held || '{"reading":"reader_disagreement"}';
      END IF;
    END IF;
  END IF;
  IF v_has_r2 AND r2.reader_kind <> 'parser' THEN
    v_span2 := substr((SELECT t.text FROM public.document_text t
                        WHERE t.document_id = v_doc AND t.extractor = r2.text_extractor
                          AND t.page = r2.page),
                      r2.start + 1, r2."end" - r2.start);
  END IF;

  -- -------------------------------------------------------------- the span check
  -- Hidden text is a run of U+FFFC in the stored page: the walker writes one for each hidden code
  -- point. A span on it, or a span with no live character, fails.
  v_hidden := position(U&'\FFFC' IN v_span) > 0;
  IF v_hidden OR btrim(replace(v_span, U&'\FFFC', ''), E' \t\n\r\f\v') = '' THEN
    v_span_ok := false;
  END IF;
  -- One sentence or one table row.
  IF v_span ~ '\n' OR v_span ~ '[.!?\u2026]+[[:space:]]+[^[:space:]]' THEN
    v_span_ok := false;
  END IF;
  -- The text set of the old extractor kept no hidden range, so the hidden-text part cannot run.
  IF r1.text_extractor = 'text-1' AND lower(coalesce(d.mime, '')) LIKE 'text/html%' THEN
    v_held := v_held || '{"hidden_text":"check_not_run"}';
  END IF;

  -- ------------------------------------------------------------------ the window
  v_window_run := ev_script_ok(v_span);
  IF v_window_run THEN
    SELECT s.n INTO v_index FROM ev_sentences(v_page) AS s
     WHERE s.s <= r1.start AND r1.start < s.e;
    SELECT string_agg(substr(v_page, s.s + 1, s.e - s.s), '' ORDER BY s.n) INTO v_window
      FROM ev_sentences(v_page) AS s
     WHERE s.n BETWEEN coalesce(v_index, 1) - 2 AND coalesce(v_index, 1) + 2
        OR (s.s < r1."end" AND s.e > r1.start);
    v_window := coalesce(v_window, v_span);
    v_flags := jsonb_build_object(
      'negation', ev_cue(v_window, 'negation'),
      'attribution', ev_cue(v_window, 'attribution'),
      'allegation', ev_cue(v_window, 'allegation'),
      'denial', ev_cue(v_window, 'denial'),
      'hedge', ev_cue(v_window, 'hedge'),
      'future', ev_cue(v_window, 'future'),
      'conditional', ev_cue(v_window, 'conditional'),
      'question', ev_cue(v_window, 'question') OR position('?' IN v_window) > 0);
    IF (v_flags ->> 'attribution')::boolean THEN v_cap := least(v_cap, 3); END IF;
    IF (v_flags ->> 'hedge')::boolean OR (v_flags ->> 'future')::boolean
       OR (v_flags ->> 'conditional')::boolean OR (v_flags ->> 'question')::boolean THEN
      v_cap := least(v_cap, 3);
    END IF;
    IF (v_flags ->> 'allegation')::boolean THEN v_cap := least(v_cap, 2); END IF;
    IF (v_flags ->> 'denial')::boolean OR (v_flags ->> 'negation')::boolean THEN
      v_cap := least(v_cap, 1);
    END IF;
  ELSE
    v_flags := '{"negation":false,"attribution":false,"allegation":false,"denial":false,
                 "hedge":false,"future":false,"conditional":false,"question":false}';
    v_held := v_held || '{"modality":"check_not_run"}';
  END IF;
  v_court := ev_court_act(v_span);
  v_absence := ev_cue(v_span, 'absence');

  -- ----------------------------------------------------- the fields and the value rule
  SELECT count(*) FILTER (WHERE NOT x.is_subject AND x.kind <> 'flag') = 0 INTO v_name_only
    FROM ev_claim_fields(p_claim) AS x;
  FOR f IN SELECT * FROM ev_claim_fields(p_claim) LOOP
    v_in := ev_field_in(f.kind, f.value, v_span, v_locale);
    IF f.is_subject THEN
      v_subject_found := v_in = 'found';
    ELSIF f.kind <> 'flag' THEN
      v_value_count := v_value_count + 1;
      IF v_in IN ('found','held') THEN v_value_ok := v_value_ok + 1; END IF;
      IF v_in = 'held' AND NOT v_held ? f.field THEN
        v_held := v_held || jsonb_build_object(f.field, 'check_not_run');
      END IF;
      IF v_absence AND NOT v_held ? f.field THEN
        v_held := v_held || jsonb_build_object(f.field, 'absence_unproven');
      END IF;
      -- No negation, hedge or denial cue between the subject and the value.
      v_pos_subject := ev_word_at(v_span, (SELECT x.value FROM ev_claim_fields(p_claim) AS x
                                             WHERE x.is_subject LIMIT 1));
      v_pos_value := ev_word_at(v_span, f.value);
      IF v_window_run AND v_pos_subject > 0 AND v_pos_value > 0 THEN
        v_between := substr(ev_fold(v_span), least(v_pos_subject, v_pos_value),
                            abs(v_pos_value - v_pos_subject));
        IF ev_cue(v_between, 'negation') OR ev_cue(v_between, 'denial')
           OR ev_cue(v_between, 'hedge') THEN
          v_span_ok := false;
        END IF;
      END IF;
    END IF;

    -- The second reading, field by field.
    IF v_has_r2 AND f.kind <> 'flag' AND NOT v_held ? f.field THEN
      IF r2.reader_kind = 'parser' THEN
        v_one := CASE WHEN f.is_subject OR f.field = 'label' THEN r2.parsed ->> 'name'
                      ELSE r2.parsed ->> f.field END;
        IF v_one IS NULL THEN
          v_held := v_held || jsonb_build_object(f.field, 'check_not_run');
        ELSIF NOT ev_parsed_agrees(f.kind, f.value, v_one) THEN
          v_held := v_held || jsonb_build_object(f.field, 'reader_disagreement');
        END IF;
      ELSE
        v_in2 := ev_field_in(f.kind, f.value, v_span2, v_locale);
        IF v_in = 'found' AND v_in2 = 'absent' THEN
          v_held := v_held || jsonb_build_object(f.field, 'reader_disagreement');
        END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_absence AND v_value_count = 0 AND NOT v_held ? 'claim' THEN
    v_held := v_held || '{"claim":"absence_unproven"}';
  END IF;

  v_support := CASE
    WHEN NOT v_subject_found THEN 'none'
    WHEN v_value_count > 0 AND v_value_ok = v_value_count THEN 'value'
    ELSE 'name_only' END;
  -- A relation on a chart image needs a layout check, and none exists, so it gives a name only.
  IF v_image AND p.op = 'create_relation' AND v_support = 'value' THEN
    v_support := 'name_only';
    v_name_only := false;
  END IF;

  -- ------------------------------------------------------- modality and adverse
  IF v_has_r2 AND r2.reader_kind = 'llm' THEN
    IF r2.modality <> r1.modality THEN
      v_held := v_held || '{"modality":"reader_disagreement"}';
    END IF;
    IF r2.adverse <> r1.adverse THEN
      v_held := v_held || '{"adverse":"reader_disagreement"}';
    END IF;
  END IF;
  IF v_window_run AND NOT v_held ? 'modality'
     AND (ev_modality_rank(r1.modality) > v_cap
          OR (v_has_r2 AND r2.reader_kind = 'llm' AND ev_modality_rank(r2.modality) > v_cap)) THEN
    v_held := v_held || '{"modality":"modality_exceeds_window"}';
  END IF;

  -- --------------------------------------------------------------- the identity
  FOR v_entity IN
    SELECT (p.payload ->> 'src_id')::uuid WHERE p.op = 'create_relation'
           AND coalesce(p.payload ->> 'src_kind', 'entity') = 'entity'
    UNION SELECT (p.payload ->> 'dst_id')::uuid WHERE p.op = 'create_relation'
           AND coalesce(p.payload ->> 'dst_kind', 'entity') = 'entity'
    UNION SELECT p.target_id WHERE p.op = 'update_attrs' AND p.target_kind = 'entity'
  LOOP
    SELECT ev_subject_kind(e.type) INTO v_kind FROM public.entities e WHERE e.id = v_entity;
    IF v_kind IS NULL THEN CONTINUE; END IF;
    v_one := ev_identity_of(v_entity, v_page, d.retrieved_at, v_locale);
    IF v_one = 'vch_conflict' THEN
      v_held := v_held || '{"identity":"vch_conflict"}';
      v_one := 'fail';
    END IF;
    v_identity := CASE
      WHEN v_identity = 'fail' OR v_one = 'fail' THEN 'fail'
      WHEN v_identity = 'lead' OR v_one = 'lead' THEN 'lead'
      WHEN v_identity = 'pending' OR v_one = 'pending' THEN 'pending'
      ELSE 'pass' END;
  END LOOP;
  IF v_identity = 'pending' AND NOT v_held ? 'identity' THEN
    v_held := v_held || '{"identity":"identity_pending"}';
  END IF;

  -- ------------------------------------------------------------- the unreadable
  FOR v_doc_id IN SELECT DISTINCT unnest(p.src)::text LOOP
    IF EXISTS (SELECT 1 FROM public.documents x WHERE x.id = v_doc_id
                  AND (x.s3_key IS NULL
                       OR NOT EXISTS (SELECT 1 FROM public.document_text t
                                       WHERE t.document_id = x.id))) THEN
      v_held := v_held || jsonb_build_object('document:' || v_doc_id, 'unreadable');
    END IF;
  END LOOP;
  IF v_page ~* ev_captcha_pattern()
     OR coalesce(d.uri, '') ~* '^https?://(www\.)?(t\.me|telegram\.me)/(s/)?[A-Za-z0-9_]+/?$' THEN
    v_held := v_held || jsonb_build_object('document:' || v_doc, 'unreadable');
    v_unreadable := true;
  END IF;

  -- ------------------------------------------------------------------- the family
  IF v_has_r2 AND r2.reader_kind = 'llm' THEN
    IF r1.model_family IS NOT NULL AND r2.model_family IS NOT NULL
       AND lower(btrim(r1.model_family)) = lower(btrim(r2.model_family)) THEN
      v_same := 'true';
    ELSIF EXISTS (SELECT 1 FROM public.model_call a, public.model_call b
                   WHERE a.id = r1.model_call_id AND b.id = r2.model_call_id
                     AND a.served_model = b.served_model) THEN
      v_same := 'true';
    ELSIF r1.model_family IS NULL OR r2.model_family IS NULL THEN
      v_same := 'unknown';
    ELSE
      v_same := 'false';
    END IF;
  ELSIF v_has_r2 THEN
    v_same := 'false';
  END IF;

  -- ------------------------------------------------------------- the image path
  IF v_image AND NOT v_ocr AND NOT (v_has_r2 AND r2.reader_kind = 'parser') THEN
    span_result := 'not_in_ocr';
  ELSE
    span_result := CASE WHEN v_span_ok THEN 'pass' ELSE 'fail' END;
  END IF;

  v_counts := span_result = 'pass' AND NOT v_unreadable
              AND (v_support = 'value' OR (v_name_only AND v_support = 'name_only'))
              AND v_identity NOT IN ('fail','lead');

  -- ------------------------------------------------------------------ the write
  INSERT INTO public.citation (claim_id, doc_id, text_extractor, page, start, "end", modality)
  VALUES (p_claim, v_doc, r1.text_extractor, r1.page, r1.start, r1."end", r1.modality)
  ON CONFLICT (claim_id, doc_id, text_extractor, page, start, "end", modality) DO NOTHING
  RETURNING id INTO v_citation;
  IF v_citation IS NULL THEN
    SELECT c.id INTO STRICT v_citation FROM public.citation c
     WHERE c.claim_id = p_claim AND c.doc_id = v_doc AND c.text_extractor = r1.text_extractor
       AND c.page = r1.page AND c.start = r1.start AND c."end" = r1."end"
       AND c.modality = r1.modality;
  END IF;

  v_ids := ARRAY(SELECT x FROM unnest(ARRAY[r1.id, CASE WHEN v_has_r2 THEN r2.id END]) AS x
                  WHERE x IS NOT NULL ORDER BY x);
  SELECT f2.id INTO v_probe FROM public.family_probe_run f2 ORDER BY f2.run_at DESC, f2.id DESC LIMIT 1;

  v_result := jsonb_build_object(
    'span_result', span_result, 'support', v_support, 'counts', v_counts,
    'hidden_text', v_hidden, 'window_run', v_window_run, 'flags', v_flags,
    'court_act', v_court, 'identity', v_identity, 'ocr', v_ocr, 'same_family', v_same,
    'held', v_held);
  v_key := encode(sha256(convert_to(concat_ws('|',
    p_claim::text, array_to_string(v_ids, ','), v_word_version::text,
    (SELECT max(version) FROM public.court_act_cue)::text,
    (SELECT max(version) FROM public.strong_id_kind)::text,
    r1.reader_fingerprint, CASE WHEN v_has_r2 THEN r2.reader_fingerprint END,
    v_probe::text,
    (SELECT string_agg(x.key || '=' || x.value::text, ',' ORDER BY x.key) FROM public.parameter x
      WHERE x.key IN ('name_match.min_ratio','family_probe.match_threshold')),
    v_result::text), 'UTF8')), 'hex');

  INSERT INTO public.citation_check
    (citation_id, claim_id, doc_id, job_id, span_result, support, counts, hidden_text, window_run,
     negation, attribution, allegation, denial, hedge, future, conditional, question, court_act,
     identity, ocr, same_family, held, reading_ids, list_version, probe_run_id, idempotency_key)
  VALUES
    (v_citation, p_claim, v_doc, p_job, span_result, v_support, v_counts, v_hidden, v_window_run,
     (v_flags ->> 'negation')::boolean, (v_flags ->> 'attribution')::boolean,
     (v_flags ->> 'allegation')::boolean, (v_flags ->> 'denial')::boolean,
     (v_flags ->> 'hedge')::boolean, (v_flags ->> 'future')::boolean,
     (v_flags ->> 'conditional')::boolean, (v_flags ->> 'question')::boolean, v_court,
     v_identity, v_ocr, v_same, v_held, v_ids, v_word_version, v_probe, v_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO STRICT v_row FROM public.citation_check c WHERE c.idempotency_key = v_key;
  END IF;

  PERFORM ev_set_adverse(p_claim, v_span,
                         r1.adverse OR (v_has_r2 AND r2.reader_kind = 'llm' AND r2.adverse));

  check_id := v_row.id;
  citation_id := v_row.citation_id;
  counts := v_row.counts;
  held := v_row.held;
  span_result := v_row.span_result;
  support := v_row.support;
  identity := v_row.identity;
  same_family := v_row.same_family;
  RETURN NEXT;
END $$;

-- THE ADVERSE PREDICATE OF A CLAIM OF GAB'S OWN ANALYSIS. Such a claim has no reader and no span,
-- so code reads the claim text, the attribute keys and the relation type. Only a claim of the
-- operator backend takes this door; a machine claim gets its predicate from the check door.
CREATE OR REPLACE FUNCTION mark_adverse_predicates(p_claim uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = p_claim AND p.author_role = 'gabriel_app') THEN
    RAISE EXCEPTION 'proposal % is not a claim of the own analysis', p_claim
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM ev_set_adverse(p_claim, NULL, false);
  SELECT count(*) INTO v_count FROM public.adverse_predicate a WHERE a.claim_id = p_claim;
  RETURN v_count;
END $$;

-- THE LOADER OF THE APPROVED PREDICATE LIST. One call is one load, and each row gets the same load
-- id. The CHECK of the table refuses a predicate outside the closed list of its subject kind. A
-- load never changes an earlier one: the table is append-only, and code reads the last load.
CREATE OR REPLACE FUNCTION load_adverse_predicates(p_source_file text, p_rows jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_load uuid := gen_random_uuid();
  v_count int;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'a load holds at least one row' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.adverse_predicate_rule
    (load_id, source_file, row_kind, subject_kind, predicate, class, lang, keyword, key)
  SELECT v_load, p_source_file, x.row_kind, x.subject_kind, x.predicate, x.class,
         nullif(x.lang, ''), nullif(lower(btrim(x.keyword)), ''), nullif(x.key, '')
    FROM jsonb_to_recordset(p_rows) AS x(row_kind text, subject_kind text, predicate text,
                                         class text, lang text, keyword text, key text);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_load;
END $$;

-- THE RECORD OF ONE FAMILY PROBE. The command runs the fixed prompt set against the two pinned
-- models and counts the answers that match. The door reads the threshold and decides: a share of
-- matches at or above it fails, because two names that answer alike may be one model. With no
-- threshold row, no probe passes.
CREATE OR REPLACE FUNCTION record_family_probe(
  p_prompt_set_version text,
  p_model_a            text,
  p_model_b            text,
  p_prompts            int,
  p_matches            int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_threshold numeric;
  v_passed boolean;
BEGIN
  SELECT p.value INTO v_threshold FROM public.parameter p
   WHERE p.key = 'family_probe.match_threshold';
  v_passed := v_threshold IS NOT NULL AND p_prompts > 0
              AND p_matches::numeric / p_prompts < v_threshold;
  INSERT INTO public.family_probe_run
    (prompt_set_version, model_a, model_b, prompts, matches, threshold, passed)
  VALUES (p_prompt_set_version, p_model_a, p_model_b, p_prompts, p_matches, v_threshold,
          v_passed);
  RETURN v_passed;
END $$;

-- ============================================================================ THE GUARDS ==

-- A CHECK ROW, A PROBE RUN, A PREDICATE AND A RULE ARE FACTS: each is written once. The owner and
-- the superuser ignore a grant, so a trigger holds it.
CREATE OR REPLACE FUNCTION evidence_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'a row of % is never %. It is a record, and a later fact is a new row',
    TG_TABLE_NAME, CASE TG_OP WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
END $$;

-- A CITATION HOLDS FIXED COLUMNS AND WRITE-ONCE COLUMNS. A fixed column never changes. Every other
-- column changes from NULL to a value one time, so a later ticket can add a column and fill it once.
-- The comparison reads the whole row as jsonb, so a column added later is covered with no change.
CREATE OR REPLACE FUNCTION citation_write_once_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'a row of citation is never deleted. It is the record of what a reader saw';
  END IF;
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      IF v_key IN ('id','claim_id','doc_id','text_extractor','page','start','end','modality',
                   'created_at') THEN
        RAISE EXCEPTION 'the column % of a citation is fixed, and it never changes', v_key;
      END IF;
      IF jsonb_typeof(v_old -> v_key) <> 'null' THEN
        RAISE EXCEPTION 'the column % of a citation is write-once, and it already holds a value',
          v_key;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- ============================================================================== THE VIEW ==

DROP VIEW IF EXISTS public.citation_check_current;
-- THE CURRENT CHECK OF EACH CITATION, AND THE FAMILY PROBE ON TOP OF IT. It is no read of the
-- public surface: it stands in `public`, and no role holds a grant on it. The decision rule reads
-- it as the owner. An older check row never counts.
--
-- A FREE-TEXT READING IS UNKNOWN UNTIL A PROBE PASSES. With no passed probe, each pair of model
-- readings is unknown. After a failed probe, each pair whose newest reading came after the last
-- passed probe is unknown. A pair with a parser or an OCR row is not free text, so it keeps its
-- value. No row is updated: the state is read here.
CREATE VIEW public.citation_check_current AS
  WITH latest AS (
    SELECT DISTINCT ON (c.citation_id) c.*
      FROM public.citation_check c
     ORDER BY c.citation_id, c.created_at DESC, c.id DESC),
  passed AS (
    SELECT max(f.run_at) AS at FROM public.family_probe_run f WHERE f.passed),
  failed AS (
    SELECT max(f.run_at) AS at FROM public.family_probe_run f WHERE NOT f.passed)
  SELECT l.id, l.citation_id, l.claim_id, l.doc_id, l.job_id, l.span_result, l.support, l.counts,
         l.hidden_text, l.window_run, l.negation, l.attribution, l.allegation, l.denial, l.hedge,
         l.future, l.conditional, l.question, l.court_act, l.identity, l.ocr,
         CASE
           WHEN NOT free.text THEN l.same_family
           WHEN (SELECT at FROM passed) IS NULL THEN 'unknown'
           WHEN (SELECT at FROM failed) > (SELECT at FROM passed)
                AND free.newest > (SELECT at FROM passed) THEN 'unknown'
           ELSE l.same_family
         END AS same_family,
         l.held, l.reading_ids, l.list_version, l.probe_run_id, l.created_at
    FROM latest l
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE r.reader_kind = 'llm') = 2 AS text,
             max(r.created_at) AS newest
        FROM public.claim_reading r
       WHERE r.id = ANY (l.reading_ids)) AS free;

RESET ROLE;
