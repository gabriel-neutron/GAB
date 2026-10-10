-- =============================================================================================
-- 0068 — a document that an official tool stored names its provider                    ORDERED
--
-- THE LICENCE OF A ROW OF A RELEASE COMES FROM THE PROVIDER OF ITS DOCUMENTS. The tool of the EU
-- acts and the tool of the OFAC SDN list stored their documents with no provider, so a claim that
-- cites them took the restrictive licence. The tools now give the provider. This file gives it to
-- each document that they stored before, by the address that each tool reads:
--
--   the Publications Office of the EU    EU EUR-Lex, under the reuse terms of the EU;
--   the SDN list of the Treasury         OFAC SDN, in the public domain.
--
-- A document with a provider keeps it. A fresh database holds no such document, and the seed
-- writes the two providers after the migrations, so the update writes no row there.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

UPDATE documents
   SET provider_id = 'eu_eurlex'
 WHERE provider_id IS NULL AND kind = 'url'
   AND uri LIKE 'https://publications.europa.eu/resource/%';

UPDATE documents
   SET provider_id = 'ofac_sdn'
 WHERE provider_id IS NULL AND kind = 'url'
   AND uri = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';

RESET ROLE;
