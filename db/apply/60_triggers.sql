-- =============================================================================================
-- 60 — the triggers                                                               RE-RUNNABLE
--
-- CREATE OR REPLACE TRIGGER is idempotent on PostgreSQL 17.5. Measured on #16: the guard file
-- was applied twice with no error.
--
-- EVERY GUARD CARRIES `ENABLE ALWAYS`. A user trigger is disabled by
-- `session_replication_role = replica`, which is USERSET, while a CHECK keeps firing. This is
-- not a theory: infra/docker-compose.yml still sets POSTGRES_USER to a superuser, and #43 owns
-- the day the day-to-day connections leave that account.
-- =============================================================================================

SET ROLE gabriel_owner;

-- The vocabulary, at the write and at the door.
CREATE OR REPLACE TRIGGER entities_attrs_gate
  BEFORE INSERT OR UPDATE OF attrs ON entities
  FOR EACH ROW EXECUTE FUNCTION attrs_gate();

CREATE OR REPLACE TRIGGER relations_attrs_gate
  BEFORE INSERT OR UPDATE OF attrs ON relations
  FOR EACH ROW EXECUTE FUNCTION attrs_gate();

CREATE OR REPLACE TRIGGER proposals_vocabulary
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION proposals_vocabulary_gate();

-- The witness, and invariant 2 for an array.
CREATE OR REPLACE TRIGGER proposals_stamp_author
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION stamp_author_role();

CREATE OR REPLACE TRIGGER proposals_src_exists
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION proposals_src_exists_fn();

-- The log is append-only.
CREATE OR REPLACE TRIGGER proposals_append_only
  BEFORE UPDATE OR DELETE ON proposals
  FOR EACH ROW EXECUTE FUNCTION proposals_append_only_fn();

-- M4, the price of a polymorphic endpoint.
CREATE OR REPLACE TRIGGER relations_endpoints
  BEFORE INSERT OR UPDATE OF src_id, dst_id, src_kind, dst_kind ON relations
  FOR EACH ROW EXECUTE FUNCTION check_relation_endpoints();

ALTER TABLE entities  ENABLE ALWAYS TRIGGER entities_attrs_gate;
ALTER TABLE relations ENABLE ALWAYS TRIGGER relations_attrs_gate;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_vocabulary;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_stamp_author;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_src_exists;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_append_only;
ALTER TABLE relations ENABLE ALWAYS TRIGGER relations_endpoints;

RESET ROLE;
