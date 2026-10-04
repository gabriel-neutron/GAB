-- =============================================================================================
-- 0027 — the text of a document is stored                                              ORDERED
--
-- A STORED PDF WAS BYTES IN THE OBJECT STORE AND NOTHING ELSE. The analyst asks for the lenders
-- of one vessel in a report of eighty pages, and no table held a word of it, so no tool could
-- read the file. This table holds the text that a plain function took from the bytes. It adds no
-- column to a core table, and it carries no project_id.
--
-- THE TEXT IS DERIVED, AND THE BYTES STAY WHERE THEY ARE. The object store keeps the file
-- unchanged. A page here is a copy that another extractor version can replace by a new set, and
-- never by an edit.
--
-- THE TEXT IS PRIVATE. The licence of a document is not always known, so its text is not
-- published. The table is in public, the read role holds no USAGE on public, and no api view
-- shows it. gabriel_app and gabriel_agent read it. No role writes it: put_document_text is the
-- one door.
--
-- ONE SET FOR EACH DOCUMENT AND EXTRACTOR VERSION. The key is the document, the extractor and
-- the page. The pages of a set are numbered from 1 by their place in the array that the door
-- received. An empty page is a lawful row: a page with no text layer is empty, and the caller
-- reports it. Two sets for one pair collide on page 1, so the key alone is the guard against
-- two callers at one instant.
--
-- A PAGE IS A FACT AND IS NEVER UPDATED, DELETED OR TRUNCATED. A trigger holds it, because the
-- owner and the superuser ignore a grant. Every foreign key is RESTRICT.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE document_text (
  document_id  doc_id NOT NULL
               CONSTRAINT document_text_document_fkey REFERENCES documents(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  extractor    text NOT NULL CHECK (btrim(extractor, E' \t\n\r\f\v') <> ''),
  page         int NOT NULL CHECK (page >= 1),
  text         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, extractor, page)
);

RESET ROLE;
