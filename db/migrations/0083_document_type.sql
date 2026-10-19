-- =============================================================================================
-- 0083 — a document has a type                                                         ORDERED
--
-- A READER COULD NOT TELL A LEGAL ACT FROM A PRESS RELEASE. A document had a kind (how the bytes
-- came in) and a title, and no word for what the text is. The column `doc_type` holds one of five
-- words: a legal act, a register entry, a press release, a report, or other.
--
-- THE DEFAULT IS `other`, and it is a true value: a type that no rule could decide. The stored
-- documents take it here. A command reads them again and fills the type by the rules of the tool
-- (fill_document_type), so this file does not guess a type in SQL.
--
-- THE LIST IS CLOSED BY A CHECK. A new word is a new migration, as for the kind.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents ADD COLUMN doc_type text NOT NULL DEFAULT 'other'
  CONSTRAINT documents_doc_type_closed
  CHECK (doc_type IN ('legal_act','register_entry','press_release','report','other'));

RESET ROLE;
