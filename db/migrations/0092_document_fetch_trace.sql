-- =============================================================================================
-- 0092 — a fetched document records how it was read                                    ORDERED
--
-- TWO FACTS OF A READ HAD NO PLACE. A page of a Russian site can be read only with the Russian
-- root certificate, and a state authority can intercept such a read. The record must say which
-- certificate the server showed. A page that a script builds is stored as the render of the
-- browser, and the record must say that it is a render.
--
-- `tls_fingerprint` HOLDS THE SHA-256 FINGERPRINT OF THE CERTIFICATE THAT THE SERVER SHOWED, as
-- Node writes it: 32 pairs of upper-case hex digits with colons. It is set only for a host with
-- a certificate that the tool accepted for that host alone. NULL means that the read used the
-- normal trust store. A document that holds a fingerprint is a source to cross-check.
--
-- `rendered` IS TRUE FOR THE COPY THAT THE BROWSER MADE. It is false for the bytes that a server
-- gave. NOT NULL with a default of false: a stored document is not a render unless it says so.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents ADD COLUMN tls_fingerprint text
  CONSTRAINT documents_tls_fingerprint_shape
  CHECK (tls_fingerprint IS NULL OR tls_fingerprint ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){31}$');

ALTER TABLE documents ADD COLUMN rendered boolean NOT NULL DEFAULT false;

RESET ROLE;
