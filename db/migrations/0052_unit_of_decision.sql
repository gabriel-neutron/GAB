-- =============================================================================================
-- 0052 — the unit and the proposer of an act                                           ORDERED
--
-- THE OPERATOR DECIDES ONE ENTITY WITH THE RELATIONS THAT DEPEND ON IT (P11). Each act gets the
-- identifier of its unit when the door writes it, and the unit never changes. The stamp trigger
-- in the re-runnable files holds the rule for each new act. This file adds the column and gives
-- each act of the record its unit by the same rule.
--
-- THE RULE. An act that creates an entity is its own unit. A relation whose end is a pending act
-- outside its group, or a relation, is a unit of its own (a link unit), so that no entity waits
-- for another group or for a relation. If not, a relation belongs to the unit of its source end
-- when that end is a pending entity of the same group, then to the unit of its target end. Every
-- other act is its own unit.
--
-- A DECIDED ACT GETS ITS UNIT TOO. Its ends were pending when the door wrote it, so the rule
-- reads the ends with no status. A pending act reads only the ends that still wait.
-- Measured on 7 October 2026: in the v1 import, 993 relations go to the child entity, and 34
-- relations that cross two groups are link units.
--
-- WHO PROPOSED AN ACT, IN THE WORDS OF THE REVIEW: the extractor of the worker, the research AI,
-- the import of the v1 work, or the operator. The connection role separates the first two from
-- the operator. The research role writes both the research and the v1 import, and the importer
-- of the v1 work names one reserved originator on each act it writes: the batch door refuses
-- that name on an item that does not cite the stored v1 ORBAT alone. A generated column holds
-- the rule once, for the view of the read API and for the read of the queue.
--
-- THE FREEZE TRIGGER REFUSES EVERY UPDATE OF AN ACT, so it is off for the fill alone. The
-- re-runnable files create it again with ENABLE ALWAYS. A new database has no trigger yet.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

ALTER TABLE proposals
  ADD COLUMN unit_id uuid,
  ADD COLUMN proposer text NOT NULL GENERATED ALWAYS AS (
    CASE author_role
      WHEN 'gabriel_agent' THEN 'extractor'
      WHEN 'gabriel_research' THEN
        CASE WHEN originator = 'GAB v1 ORBAT (operator)' THEN 'v1_import' ELSE 'research_ai' END
      ELSE 'operator'
    END) STORED;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
              WHERE tgrelid = 'public.proposals'::regclass
                AND tgname = 'proposals_append_only') THEN
    ALTER TABLE proposals DISABLE TRIGGER proposals_append_only;
  END IF;
END $$;

WITH ends AS (
  SELECT r.id,
         (r.payload->>'src_id')::uuid AS src,
         (r.payload->>'dst_id')::uuid AS dst,
         r.batch_id,
         r.status
    FROM proposals r
   WHERE r.op = 'create_relation'
), placed AS (
  SELECT e.id,
         CASE
           WHEN e.batch_id IS NULL THEN e.id
           WHEN EXISTS (SELECT 1 FROM proposals o
                         WHERE o.id IN (e.src, e.dst)
                           AND (e.status <> 'pending' OR o.status = 'pending')
                           AND NOT (o.op = 'create_entity'
                                    AND o.batch_id IS NOT DISTINCT FROM e.batch_id))
             THEN e.id
           WHEN EXISTS (SELECT 1 FROM relations r WHERE r.id IN (e.src, e.dst)) THEN e.id
           WHEN EXISTS (SELECT 1 FROM proposals o
                         WHERE o.id = e.src AND o.op = 'create_entity'
                           AND (e.status <> 'pending' OR o.status = 'pending')
                           AND o.batch_id = e.batch_id)
             THEN e.src
           WHEN EXISTS (SELECT 1 FROM proposals o
                         WHERE o.id = e.dst AND o.op = 'create_entity'
                           AND (e.status <> 'pending' OR o.status = 'pending')
                           AND o.batch_id = e.batch_id)
             THEN e.dst
           ELSE e.id
         END AS unit_id
    FROM ends e
)
UPDATE proposals p SET unit_id = placed.unit_id FROM placed WHERE placed.id = p.id;

UPDATE proposals SET unit_id = id WHERE unit_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
              WHERE tgrelid = 'public.proposals'::regclass
                AND tgname = 'proposals_append_only') THEN
    ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_append_only;
  END IF;
END $$;

ALTER TABLE proposals ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX proposals_pending_unit_idx ON proposals (unit_id) WHERE status = 'pending';

RESET ROLE;
