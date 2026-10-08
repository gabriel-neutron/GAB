-- =============================================================================================
-- 0061 — the acts of one claim, found by an index                                     ORDERED
--
-- THE DOUBT RULE READS THE ACTS OF ONE CLAIM FOR EACH UNIT (unit_doubt_cause): every act that
-- shares the claim key of an act of the unit. The only index of the claim key holds the rejected
-- acts, so each read scanned all the acts. Measured on 8 October 2026 over 1,203 units that wait:
-- the doubt rule of all the units took 2.3 s, and with this index it took 0.1 s.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE INDEX proposals_claim_idx ON proposals (claim_key);

RESET ROLE;
