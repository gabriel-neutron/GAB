-- =============================================================================================
-- 0087 — a document type for official, reference and company sources              ORDERED
--
-- THE OFFICIAL SITES AND THE WIKIS WERE STILL `other`. The check of 0086 allows three more words:
-- an official publication (a government site that is neither a list nor a legal act) and a
-- reference (an encyclopaedia, a wiki or map data) and a company publication (the site of a
-- company). The stored value of a document does not
-- change here: `document-labels` fills the type of the documents that are `other`.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents DROP CONSTRAINT documents_doc_type_closed;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_closed
  CHECK (doc_type IN ('legal_act','register_entry','press_release','report',
                      'official_publication','reference','company_publication',
                      'telegram_post','ngo_publication','news_article','other'));

RESET ROLE;
