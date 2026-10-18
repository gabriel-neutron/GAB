-- =============================================================================================
-- 0081 — the archive that held a document                                               ORDERED
--
-- A SOURCE CAN GIVE ITS DATA AS A ZIP ARCHIVE (#595). The store tools unpack the archive into one
-- child document for each file, and each child keeps the archive that held it and its path in
-- that archive. A reader finds the hash of the archive in the row of the archive, so a file
-- traces back to the bytes that held it.
--
-- THE LINK IS A COLUMN OF THE DOCUMENT, not a table: the hash decides the identity, so the same
-- file is one document, and it keeps the first archive that held it. The door
-- fill_document_archive writes the link once and never changes it.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents
  -- text and not doc_id: the domain refuses NULL, and a document that no archive held has none.
  ADD COLUMN archive_id text REFERENCES documents (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN archive_path text,
  ADD CONSTRAINT documents_archive_shape
      CHECK ((archive_id IS NULL) = (archive_path IS NULL)
             AND (archive_path IS NULL OR btrim(archive_path, E' \t\n\r\f\v') <> '')
             AND archive_id IS DISTINCT FROM id);

CREATE INDEX documents_archive_id ON documents (archive_id) WHERE archive_id IS NOT NULL;

RESET ROLE;
