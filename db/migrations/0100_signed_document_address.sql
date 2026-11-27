-- =============================================================================================
-- 0100 — a document never keeps a signed address                                         ORDERED
--
-- THE RELEASE PUBLISHES THE ADDRESS OF EACH DOCUMENT. Before 2026-11-04, fetch_document stored
-- the final address of a redirect. The list service of OFAC sends each file through a signed
-- address of an S3 bucket, so two documents kept a security token and a signature that expire
-- after one hour. A reader cannot open such an address, and it must never go into a release.
--
-- The update gives each such document the address of OFAC that was asked for: the export of
-- the list service with the same file name. The bytes, the hash and the day of retrieval stay.
-- A fresh database holds no such document, so the update writes no row there. On 2026-11-27 the
-- record held two signed addresses, and the update repairs both, so the check holds on each row.
--
-- The check refuses each later write of a signed address, by each path. The list of query names
-- is the list of isSigned in packages/tools/src/fetch-guard.ts.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

UPDATE documents
   SET uri = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/'
             || substring(uri FROM '/([A-Za-z0-9_]+\.CSV)\?')
 WHERE uri LIKE 'https://wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com/%'
   AND uri ~* '[?&]X-Amz-Signature='
   AND substring(uri FROM '/([A-Za-z0-9_]+\.CSV)\?') IS NOT NULL;

-- The check reads the query and the fragment only. A name can have a dash, a low line or a full
-- stop between its words. shortcut: a percent-encoded name passes the check, and the store step and
-- the release still refuse it; decode the names if a source shows one.
ALTER TABLE documents
  ADD CONSTRAINT documents_uri_unsigned CHECK (
    coalesce(substring(uri FROM '[?#].*$'), '') !~* (
      '(^|[?&;#])(x[-_.]?amz[-_.]?(signature|credential|security[-_.]?token)|'
      || 'x[-_.]?goog[-_.]?(signature|credential)|signature|key[-_.]?pair[-_.]?id|'
      || 'google[-_.]?access[-_.]?id|aws[-_.]?access[-_.]?key[-_.]?id|sig)=')
  );

RESET ROLE;
