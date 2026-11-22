-- =============================================================================================
-- 0097 — a document has a level and can be restricted                                  ORDERED
--
-- THE PROJECT WANTS TO REPUBLISH, AND A LICENCE WORD DOES NOT SAY THAT ITS TERMS WERE READ. The
-- level comes from research/signed-list.md: A is terms read and reuse allowed. Each other value
-- stays in the store. A level is not stored per document: one edit of a provider row or of a rule
-- moves each document, as for the tier (0033). db/apply/20_views.sql reads it.
--
-- `document_provider.level` IS SET BY HAND, not from the licence: a source can have an open word
-- and terms that nobody read. The default is `not_verified`, so a new row fails closed.
--
-- `document_level_rule` HOLDS ADDRESS PATTERNS, because most documents have no provider, and one
-- host can hold lines of different levels. The worst rule that matches gives the level. A rule with
-- `restricted` marks the document as restricted, and it reads the whole address, so it also holds a
-- copy in a web archive.
--
-- `documents.restricted` IS A ONE-WAY MARK. A trigger sets it from the address rules, and a tool sets
-- it for a file on a host that no rule names (a bank statement PDF). A provider can hold a document
-- with a false mark.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE document_provider
  ADD COLUMN level text NOT NULL DEFAULT 'not_verified'
    CHECK (level IN ('A', 'B', 'C', 'not_verified')),
  ADD COLUMN restricted boolean NOT NULL DEFAULT false;

ALTER TABLE documents ADD COLUMN restricted boolean NOT NULL DEFAULT false;

CREATE TABLE document_level_rule (
  pattern    text PRIMARY KEY CHECK (btrim(pattern) <> ''),
  level      text NOT NULL CHECK (level IN ('A', 'B', 'C', 'not_verified')),
  restricted boolean NOT NULL DEFAULT false,
  line       text NOT NULL CHECK (btrim(line) <> '')
);

RESET ROLE;
