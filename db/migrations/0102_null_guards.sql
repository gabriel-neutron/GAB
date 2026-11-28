-- =============================================================================================
-- 0102 — two checks state their NULL guard                                               ORDERED
--
-- tools/null-never-passes.db-test.ts asks each check over one nullable column to state its NULL
-- guard, so a reader sees that NULL passes on purpose. The checks of 0100 (documents.uri) and 0101
-- (proposals.target_kind) did not. The guard is the same rule: a NULL passes, as before. No row changes.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE documents DROP CONSTRAINT documents_uri_unsigned;
ALTER TABLE documents
  ADD CONSTRAINT documents_uri_unsigned CHECK (
    uri IS NULL
    OR coalesce(substring(uri FROM '[?#].*$'), '') !~* (
      '(^|[?&;#])(x[-_.]?amz[-_.]?(signature|credential|security[-_.]?token)|'
      || 'x[-_.]?goog[-_.]?(signature|credential)|signature|key[-_.]?pair[-_.]?id|'
      || 'google[-_.]?access[-_.]?id|aws[-_.]?access[-_.]?key[-_.]?id|sig)=')
  );

ALTER TABLE proposals DROP CONSTRAINT proposals_remove_value_shape;
ALTER TABLE proposals ADD CONSTRAINT proposals_remove_value_shape
  CHECK (NOT payload ? 'remove_value'
         OR (op = 'update_attrs' AND target_kind IS NOT NULL AND target_kind = 'entity'
             AND remove_value_valid(payload)));

RESET ROLE;
