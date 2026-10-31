-- =============================================================================================
-- 0093 — The M49 codes of UN Comtrade in the list of area codes                         ORDERED
--
-- UN Comtrade writes a country as a number (156 for China, 643 for Russia). The list of source
-- codes held Eurostat only, and a source code started with a letter. This migration adds the
-- code list `m49` and lets a source code be a number of one to four digits. The rows of the list
-- are in the re-runnable seed.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE area_code_source DROP CONSTRAINT area_code_source_codes;
ALTER TABLE area_code_source ADD CONSTRAINT area_code_source_codes
  CHECK (codes IN ('eurostat', 'm49'));

ALTER TABLE area_code_source DROP CONSTRAINT area_code_source_shape;
ALTER TABLE area_code_source ADD CONSTRAINT area_code_source_shape
  CHECK (source_code ~ '^([A-Z][A-Z0-9_]{1,19}|[0-9]{1,4})$');

RESET ROLE;
