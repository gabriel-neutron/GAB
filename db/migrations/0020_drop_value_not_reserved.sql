-- =============================================================================================
-- 0020 — a reserved word in a value is refused by the two rules on src                ORDERED
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

-- Departure: proposals_src_within keeps each value source inside src, and
-- proposals_machine_not_reserved refuses a reserved word in src for an agent. A change that
-- loosens proposals_src_within must add a rule on the value again, or an agent hides one there.
ALTER TABLE proposals DROP CONSTRAINT proposals_value_not_reserved;

DROP FUNCTION attrs_cites_reserved(jsonb);

RESET ROLE;
