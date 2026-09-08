-- =============================================================================================
-- 0010 — the attribute vocabulary is dropped, and M11 is whole again                   ORDERED
--
-- M11 READS: "No attribute-definition table, no key allowlist." The table was built anyway by
-- #97, and no entry of the register was ever rewritten. The operator ruled on 8 September 2026
-- that M11 is the decision that stands. `125492b` removed everything the table REFUSED; this
-- file removes the table itself, so that nothing is left describing what a key must be.
--
-- WHAT IS LOST, AND IT IS REAL. A printable label — "IMO number" and not "Imo number" — the unit
-- symbol of a quantity, and a declared kind that told a screen to draw a seven-digit IMO number
-- as an identifier and not as a number. Every one of them is now derived from the key and from
-- the value it holds. A key that spells its concept badly prints badly.
--
-- M10 IS UNTOUCHED, and it is why the unit column is no loss: the unit of record is carried by
-- the key name, such as `coal_stock_t`. The dropped column held the printable symbol alone.
--
-- WHAT REMAINS OF M11's OWN MITIGATION. `api.key_usage` names every key in use, on an entity and
-- on a relation, with how often each is used and by which type. That is the monitoring view M11
-- asked for, in the form M11 asked for it: it makes the drift visible and it prevents nothing.
--
-- `entity_type` IS NOT TOUCHED. It is a different decision (#93) and a different table: a type
-- carries a hue and a print order that no value can be derived from, and a promotion still lands
-- an unrecognised word as `unknown` with `proposed_type` kept.
--
-- WHY A NEW FILE AND NOT AN EDIT TO 0003. node-pg-migrate keeps a ledger in the `migrations`
-- schema, so an edit to a file already applied reaches no running database until `pnpm db:reset`.
-- 0003 stays the record of what the first schema was.
--
-- THREE VIEWS GO FIRST AND BY NAME, AND THIS WAS MEASURED AND NOT REASONED. A first run of this
-- file raised `cannot drop table because other objects depend on it`: the ordered files run
-- BEFORE the re-runnable ones, so on the operator's database the OLD `20_views.sql` was still in
-- force, and `api.attribute_key`, `api.value_support` and `api.key_usage` all read the table.
-- Dropping only the first left the other two holding it.
--
-- ALL THREE ARE RE-RUNNABLE AND `20_views.sql` MAKES THEM AGAIN in the same command, two of them
-- without the join and the third not at all. On a database built from zero the table carries no
-- view yet and each DROP is a no-op.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

DROP VIEW IF EXISTS api.attribute_key;
DROP VIEW IF EXISTS api.value_support;
DROP VIEW IF EXISTS api.key_usage;
DROP TABLE IF EXISTS attribute_key;

RESET ROLE;
