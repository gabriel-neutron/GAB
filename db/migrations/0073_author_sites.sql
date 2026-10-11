-- =============================================================================================
-- 0073 — the sites of an author                                                       ORDERED
--
-- THE RULING OF 11 OCTOBER 2026: A SOURCE A COUNTS ALONE ONLY ON A SITE OF ITS AUTHOR. A record
-- of an issuer is A when the cited document is on a site where that issuer publishes its own
-- records (for example the site of the sanctions authority). A faithful copy of the record on
-- another site, such as a news page, never counts as A alone: it needs a second independent
-- source, like any other source.
--
-- THE ROW OF AN AUTHOR KEEPS ITS SITES: the host names where the author publishes its own
-- records. A site is a host name in lower case, with no scheme, path, port or user. A site
-- matches the host of an address and each host below it.
--
-- FAIL CLOSED. Each author that the record holds now gets no site. So an author A that is in the
-- record now no longer counts alone, until the operator gives it its sites from the reference
-- set. The pair of two independent sources does not read the sites, so it does not change.
--
-- THE SITES ARE WRITTEN ONCE, like the letter. The row of an author is append-only, and its
-- trigger lets one update pass: the operator gives sites to an author that has none. A change of
-- sites that an author holds needs a new design.
--
-- NOT NULL WITH A DEFAULT, so no three-valued logic can let a row pass.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE author ADD COLUMN sites text[] NOT NULL DEFAULT '{}'
  CONSTRAINT author_site_form
  CHECK (array_position(sites, NULL) IS NULL
         AND (cardinality(sites) = 0
              OR array_to_string(sites, ' ')
                 ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+( [a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)*$'));

RESET ROLE;
