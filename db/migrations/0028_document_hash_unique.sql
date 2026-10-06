-- =============================================================================================
-- 0028 — one hash is one document                                                      ORDERED
--
-- THE SAME BYTES COULD ENTER TWICE. The sha256 column held a format rule and nothing else, so
-- two rows with one hash were lawful, and the second copy of a report doubled its pages for every
-- reader. The hash decides identity, so the table now refuses the second row.
--
-- THE INDEX IS PARTIAL. A `manual` row, an `inherited` row and an address with no bytes hold no
-- hash, and any number of them may exist. Only a row with a hash is held to one row for each
-- value.
--
-- THE MIGRATION STOPS IN FRONT OF A DUPLICATE AND NAMES IT. It deletes nothing and it picks no
-- survivor, because a row may be cited by a proposal or a value. The message lists each hash with
-- the ids that hold it, and the operator decides which row stays.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DO $$
DECLARE v_found text;
BEGIN
  SELECT string_agg(format('%s held by %s', d.sha256, d.ids), '; ' ORDER BY d.sha256)
    INTO v_found
    FROM (SELECT sha256, string_agg(id::text, ', ' ORDER BY id) AS ids
            FROM public.documents
           WHERE sha256 IS NOT NULL
           GROUP BY sha256
          HAVING count(*) > 1) AS d;
  IF v_found IS NOT NULL THEN
    RAISE EXCEPTION 'two documents hold one hash, and no row was changed: %', v_found;
  END IF;
END $$;

CREATE UNIQUE INDEX documents_sha256_key ON documents (sha256) WHERE sha256 IS NOT NULL;

RESET ROLE;
