-- =============================================================================================
-- 0092 — a figure without a country has no reporter                                    ORDERED
--
-- A WORLD PRICE HAS NO REPORTER. The monthly Brent price of the World Bank is one price for the
-- world, and the table of the source has no column of areas. A figure like this had to take a
-- made-up code, or it had no way into the record.
--
-- THE RULE: A FIGURE HAS A REPORTER OR IT HAS NONE. The system and the code are both set or both
-- null. The key of the figure already treats null as one value (NULLS NOT DISTINCT), so a figure
-- with no reporter is unique by its other parts. The mapping decides: a mapping with no reporter
-- gives figures with no reporter. The act `create_observation` still needs a reporter.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE observation ALTER COLUMN reporter_system DROP NOT NULL;
ALTER TABLE observation ALTER COLUMN reporter DROP NOT NULL;
ALTER TABLE observation ADD CONSTRAINT observation_reporter_pair
  CHECK ((reporter_system IS NULL) = (reporter IS NULL));

RESET ROLE;
