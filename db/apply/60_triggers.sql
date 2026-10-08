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

-- THREE TRIGGERS ARE GONE, AND THEY ARE NOT COMING BACK BY ACCIDENT. entities_attrs_gate,
-- relations_attrs_gate and proposals_vocabulary held the declared kind and the declared format
-- of a value. M11 stands: no key allowlist and no rule on a value beyond its shape, which
-- `attrs_valid` carries on the column. The drop below runs on a database that still holds them.
DROP TRIGGER IF EXISTS entities_attrs_gate   ON entities;
DROP TRIGGER IF EXISTS relations_attrs_gate  ON relations;
DROP TRIGGER IF EXISTS proposals_vocabulary  ON proposals;

-- The witness, and invariant 2 for an array.
CREATE OR REPLACE TRIGGER proposals_stamp_author
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION stamp_author_role();

CREATE OR REPLACE TRIGGER proposals_src_exists
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION proposals_src_exists_fn();

-- The unit of decision of each act, read from the acts that wait at the insert.
CREATE OR REPLACE TRIGGER proposals_stamp_unit
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION stamp_unit();

-- The key of the claim of each act, to find a claim that was rejected before.
CREATE OR REPLACE TRIGGER proposals_stamp_claim
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION stamp_claim_key();

-- The log is append-only.
CREATE OR REPLACE TRIGGER proposals_append_only
  BEFORE UPDATE OR DELETE ON proposals
  FOR EACH ROW EXECUTE FUNCTION proposals_append_only_fn();

-- A model call is written once.
CREATE OR REPLACE TRIGGER model_call_append_only
  BEFORE UPDATE OR DELETE ON model_call
  FOR EACH ROW EXECUTE FUNCTION model_call_append_only_fn();

-- A citation is written once.
CREATE OR REPLACE TRIGGER citation_append_only
  BEFORE UPDATE OR DELETE ON citation
  FOR EACH ROW EXECUTE FUNCTION citation_append_only_fn();

-- A letter, a name of an author and a check by a second model are written once.
CREATE OR REPLACE TRIGGER author_append_only
  BEFORE UPDATE OR DELETE ON author
  FOR EACH ROW EXECUTE FUNCTION author_append_only_fn();
CREATE OR REPLACE TRIGGER author_name_append_only
  BEFORE UPDATE OR DELETE ON author_name
  FOR EACH ROW EXECUTE FUNCTION author_append_only_fn();
CREATE OR REPLACE TRIGGER act_check_append_only
  BEFORE UPDATE OR DELETE ON act_check
  FOR EACH ROW EXECUTE FUNCTION author_append_only_fn();

-- A new author name gets a job that rates it.
CREATE OR REPLACE TRIGGER proposals_rate_author
  AFTER INSERT ON proposals
  FOR EACH ROW WHEN (NEW.originator IS NOT NULL) EXECUTE FUNCTION enqueue_author_rating();

-- The approval of a reference author is written once.
CREATE OR REPLACE TRIGGER reference_approval_append_only
  BEFORE UPDATE OR DELETE ON reference_approval
  FOR EACH ROW EXECUTE FUNCTION author_append_only_fn();

-- The taker of a job, from the connection and never from a label the caller passed.
CREATE OR REPLACE TRIGGER jobs_stamp_claimed_by
  BEFORE UPDATE OF claimed_at ON jobs
  FOR EACH ROW EXECUTE FUNCTION stamp_claimed_by();

-- M4, the price of a polymorphic endpoint.
CREATE OR REPLACE TRIGGER relations_endpoints
  BEFORE INSERT OR UPDATE OF src_id, dst_id, src_kind, dst_kind ON relations
  FOR EACH ROW EXECUTE FUNCTION check_relation_endpoints();

-- M6, the interval rule, read on the type row from both sides.
CREATE OR REPLACE TRIGGER relations_interval
  BEFORE INSERT OR UPDATE OF type, valid_from, valid_to ON relations
  FOR EACH ROW EXECUTE FUNCTION check_relation_interval();

CREATE OR REPLACE TRIGGER relations_one_open
  BEFORE INSERT OR UPDATE OF type, src_kind, src_id, dst_kind, dst_id, valid_to ON relations
  FOR EACH ROW EXECUTE FUNCTION check_relation_one_open();

CREATE OR REPLACE TRIGGER relation_type_interval
  BEFORE UPDATE OF takes_interval ON relation_type
  FOR EACH ROW EXECUTE FUNCTION check_relation_type_interval();

ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_stamp_author;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_src_exists;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_stamp_unit;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_stamp_claim;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_append_only;
ALTER TABLE model_call ENABLE ALWAYS TRIGGER model_call_append_only;
ALTER TABLE citation ENABLE ALWAYS TRIGGER citation_append_only;
ALTER TABLE author ENABLE ALWAYS TRIGGER author_append_only;
ALTER TABLE author_name ENABLE ALWAYS TRIGGER author_name_append_only;
ALTER TABLE act_check ENABLE ALWAYS TRIGGER act_check_append_only;
ALTER TABLE reference_approval ENABLE ALWAYS TRIGGER reference_approval_append_only;
ALTER TABLE proposals ENABLE ALWAYS TRIGGER proposals_rate_author;
ALTER TABLE relations ENABLE ALWAYS TRIGGER relations_endpoints;
ALTER TABLE relations ENABLE ALWAYS TRIGGER relations_interval;
ALTER TABLE relations ENABLE ALWAYS TRIGGER relations_one_open;
ALTER TABLE relation_type ENABLE ALWAYS TRIGGER relation_type_interval;
ALTER TABLE jobs      ENABLE ALWAYS TRIGGER jobs_stamp_claimed_by;

RESET ROLE;
