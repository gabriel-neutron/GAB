-- =============================================================================================
-- 0103 — the UK Sanctions List, OFSI, GLEIF and the OFAC search get their level           ORDERED
--
-- A DOCUMENT THAT fetch_document STORES HAS NO PROVIDER. With no address rule, a page of the UK
-- Sanctions List, of OFSI, of GLEIF or of the OFAC search stays `not_verified`, but
-- research/signed-list.md rates each of these lines A. Each rule holds the addresses of one line,
-- and no other page of the host. Each rule starts at the address, so a web archive copy stays
-- `not_verified`. A news page of gov.uk has no line, and it stays `not_verified`.
--
-- db/apply/95_seed.sql holds the same rows, so a fresh database and the record stay equal.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

INSERT INTO document_level_rule (pattern, level, restricted, line) VALUES
  ('^https?://search-uk-sanctions-list\.service\.gov\.uk/', 'A', false, 'UK Sanctions List and its notices'),
  ('^https?://sanctionslist\.fcdo\.gov\.uk/docs/', 'A', false, 'UK Sanctions List and its notices'),
  ('^https?://www\.gov\.uk/government/publications/the-uk-sanctions-list([/?#]|$)', 'A', false, 'UK Sanctions List and its notices'),
  ('^https?://www\.gov\.uk/guidance/[a-z0-9-]+-list-of-designations-and-sanctions-notices([/?#]|$)', 'A', false, 'UK Sanctions List and its notices'),
  ('^https?://www\.gov\.uk/government/(publications|collections)/(financial-sanctions-|ofsi-|enforcement-of-financial-sanctions([/?#]|$))', 'A', false, 'OFSI notices'),
  ('^https?://assets\.publishing\.service\.gov\.uk/[^?#]*/Notice_[A-Za-z_]+_[0-9]{6}\.pdf$', 'A', false, 'OFSI notices'),
  ('^https?://api\.gleif\.org/api/v1/lei-records/', 'A', false, 'GLEIF Level 1 and 2'),
  ('^https?://goldencopy\.gleif\.org/storage/golden-copy-files/', 'A', false, 'GLEIF Level 1 and 2'),
  ('^https?://sanctionssearch\.ofac\.treas\.gov/Details\.aspx\?id=[0-9]+$', 'A', false, 'OFAC SDN file, recent actions, enforcement PDFs')
ON CONFLICT (pattern) DO UPDATE SET
  level = EXCLUDED.level,
  restricted = EXCLUDED.restricted,
  line = EXCLUDED.line;

RESET ROLE;
