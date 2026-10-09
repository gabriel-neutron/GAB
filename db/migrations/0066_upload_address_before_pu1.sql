-- =============================================================================================
-- 0066 — an upload stored before the address rule is not public                       ORDERED
--
-- THE RULING OF 9 OCTOBER 2026 AFTER #403 MAKES AN UPLOAD WITH ITS ADDRESS A PUBLIC DOCUMENT. The
-- upload now asks for the address where the file comes from. Before this ruling, the same box
-- asked for the purchase page or the source page, and the cost was optional. So an older upload
-- can hold the page where a file was bought, with no cost. Such a row must not become public
-- when the rule changes.
--
-- THE MIGRATION MARKS EACH UPLOAD THAT HOLDS AN ADDRESS NOW. The public document view does not
-- count a marked row, so the rule fails closed for the older rows. A row that a later upload
-- writes is not marked. An older upload with no address is not marked either: it is not public
-- because it has no address, and a new upload of the same bytes can give it its address.
--
-- NOT NULL WITH A DEFAULT, so no three-valued logic can let a row pass.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents ADD COLUMN uri_before_pu1 boolean NOT NULL DEFAULT false;

UPDATE documents SET uri_before_pu1 = true
 WHERE kind = 'file' AND btrim(coalesce(uri, ''), E' \t\n\r\f\v') <> '';

RESET ROLE;
