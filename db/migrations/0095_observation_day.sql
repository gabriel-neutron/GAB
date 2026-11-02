-- =============================================================================================
-- 0095 — a figure can have a day as its period                                         ORDERED
--
-- A SOURCE THAT PUBLISHES ONE FIGURE EACH DAY HAS NO ANNUAL FILE. The CREA Russia Fossil Tracker
-- gives the departures of each port for each day, and gives no yearly figure for a port. The
-- loader reads the figures as they are, and a sum is a read of the record, never a figure made by
-- hand (ADR 0030). The period of a figure is now a year, a quarter, a month, an ISO week or a day.
-- The act `create_observation` keeps its shorter list.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE observation DROP CONSTRAINT observation_period_shape;
ALTER TABLE observation ADD CONSTRAINT observation_period_shape
  CHECK (period ~ '^[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?|-Q[1-4]|-W(0[1-9]|[1-4][0-9]|5[0-3]))?$');

RESET ROLE;
