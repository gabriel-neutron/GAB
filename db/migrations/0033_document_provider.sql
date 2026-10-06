-- =============================================================================================
-- 0033 — a document names the provider that distributed it                             ORDERED
--
-- NO DOCUMENT CARRIED A LICENCE, SO NOTHING COULD HOLD A FIELD BACK FROM A RELEASE. A licence is
-- a property of the provider and not of one fetch: one provider row holds it, and one edit of
-- that row moves every document of that provider. The tier is derived from it in
-- db/apply/40_functions.sql and is never stored a second time.
--
-- THE TABLE IS `document_provider` AND NOT `document_sources`. In this schema "source" names a
-- document id (the `src` of a proposal), so a second meaning of the word would mislead a reader.
--
-- THE LICENCE BELONGS TO THE DISTRIBUTOR OF THE BYTES. A carrier is never an originator: a list
-- that a provider republishes keeps the terms of that provider, and the originator of a claim
-- is a different fact. `originator_id` holds that fact, and it is plain text with NO foreign key
-- because the originator table does not exist yet. The migration that adds that table adds the
-- key.
--
-- THE LICENCE IS A CLOSED LIST OF WORDS. A word outside it is refused here, and the tier reads
-- an allow-list, so a word that a later migration adds is internal until the allow-list names it.
--
-- `documents.provider_id` IS NULLABLE. A document with no provider is stored and is internal:
-- the rule fails closed and never fails open. ON UPDATE RESTRICT and ON DELETE RESTRICT, as for
-- relations_type_fkey: a cascading update bypasses the privileges of the caller and rewrites a
-- document row with no act. There is no index on documents (provider_id): only the probe of
-- ON DELETE RESTRICT would use it, no role deletes a provider, and the seed never deletes.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE document_provider (
  id            text PRIMARY KEY
                CHECK (id = btrim(id) AND id ~ '^[a-z][a-z0-9_]*$'),
  name          text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  licence       text NOT NULL
                CHECK (licence IN ('public-domain', 'eu-reuse', 'ogl-v3', 'cc0', 'cc-by-4.0',
                                   'cc-by-nc-4.0', 'odbl', 'copernicus', 'paid-filing',
                                   'registration-terms', 'restricted',
                                   'commercial-no-redistribution', 'own')),
  -- The guard names NULL first, so a blank value cannot pass by three-valued logic.
  originator_id text CHECK (originator_id IS NULL OR btrim(originator_id) <> ''),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ADD COLUMN provider_id text
  REFERENCES document_provider (id) ON UPDATE RESTRICT ON DELETE RESTRICT;

RESET ROLE;
