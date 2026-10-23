-- =============================================================================================
-- 0086 — a document type for Telegram, NGO and news sources                            ORDERED
--
-- NEARLY EVERY DOCUMENT WAS `other`. The tool knew five words, and none of them named a Telegram
-- post, a publication of an NGO or a news article, which are most of the sources of the claims.
-- The check of 0083 now allows three more words. The stored value of a document does not change
-- here: the command `document-labels` reads the documents again and fills the type by the rules
-- of the tool.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents DROP CONSTRAINT documents_doc_type_closed;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_closed
  CHECK (doc_type IN ('legal_act','register_entry','press_release','report',
                      'telegram_post','ngo_publication','news_article','other'));

RESET ROLE;
