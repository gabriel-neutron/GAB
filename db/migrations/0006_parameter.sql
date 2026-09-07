-- =============================================================================================
-- 0006 — the operational numbers                                                       ORDERED
--
-- A NUMBER THAT THE OPERATOR TUNES IS A ROW AND NEVER A CODE CONSTANT. One table holds every
-- such number, so one number changes with one statement and with no deploy.
--
-- THE UNIT IS IN THE KEY. A separate unit column can disagree with the value beside it, and a
-- reader that ignores it computes a wrong number in silence.
--
-- NO ROLE WRITES THIS TABLE. It is read by the doors, which run as gabriel_owner.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- ============================================================================== parameter ====
CREATE TABLE parameter (
  key   text PRIMARY KEY,
  -- Every number here is a count, a duration or a proportion, and none of them is zero or less.
  value numeric NOT NULL CHECK (value > 0)
);

RESET ROLE;
