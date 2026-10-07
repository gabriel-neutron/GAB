-- =============================================================================================
-- 40 — the guards and the doors                                                    RE-RUNNABLE
--
-- Every SECURITY DEFINER function carries SET search_path. Measured on #15: without it, a
-- caller created a temporary table named `entities`, granted it to the owner, and the function
-- wrote one row there and ZERO rows in public.entities. It returned normally.
-- =============================================================================================

SET ROLE gabriel_owner;

-- =========================================================================== THE VOCABULARY ==
-- Departure: M11 puts no vocabulary tier here. `attrs_valid` holds the shape of each key and
-- each attribute on the column, and nothing else is a rule on the free half of the model.

-- Departure: no table describes a key. The cost is that `coal_stock`, `coal_stock_t` and
-- `coal_stock_tonnes` can stand on one type, all valid.

-- External constraint: this file runs again at each apply, so the drop below removes the old
-- vocabulary functions from a database that still holds them.
DROP FUNCTION IF EXISTS attrs_gate() CASCADE;
DROP FUNCTION IF EXISTS proposals_vocabulary_gate() CASCADE;
DROP FUNCTION IF EXISTS attrs_declared(jsonb);


-- ============================================================================== THE WITNESS ==
-- current_user inside a SECURITY DEFINER function is the OWNER, never the caller. session_user
-- is the caller. It separates gabriel_agent from gabriel_app, and it CANNOT separate the
-- operator from the backend, because both hold the name gabriel_app.
-- What makes two machine acts the same act: the operation, the target, the payload, the
-- sources and the role that wrote it. The stamp below and the batch door read it, so both compute
-- one digest. Two roles are two witnesses, and the digest keeps them apart: a merge would lose the
-- second witness. The originator is not part of it, because a model words the same party in more
-- than one way, and each wording would make a second act of one claim.
--
-- An act that waited before this digest keeps the digest it was written with, because a pending
-- act is frozen. A retry of such an act writes it once more.
DROP FUNCTION IF EXISTS act_digest_of(text,text,uuid,jsonb,text[]);
DROP FUNCTION IF EXISTS act_digest_of(text,text,uuid,jsonb,text[],text,text);
CREATE OR REPLACE FUNCTION act_digest_of(
  p_op text, p_target_kind text, p_target_id uuid, p_payload jsonb, p_src text[],
  p_author_role text)
RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT md5(jsonb_build_array(p_op, p_target_kind, p_target_id, p_payload, p_src,
                               p_author_role)::text)
$$;

CREATE OR REPLACE FUNCTION stamp_author_role() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF session_user NOT IN ('gabriel_agent','gabriel_app','gabriel_research') THEN
    RAISE EXCEPTION 'role % may not write a proposal', session_user
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.author_role := session_user;
  NEW.status      := 'pending';
  NEW.decided_at  := NULL;
  NEW.decided_by  := NULL;
  NEW.prior_value := NULL;
  NEW.created_at  := now();
  NEW.xact        := pg_current_xact_id();
  -- A machine act names the call that made it. This runs on the insert alone, so an agent row
  -- from before the call table existed is still decided: the freeze trigger never reads this.
  IF NEW.author_role = 'gabriel_agent' AND NEW.model_call_id IS NULL THEN
    RAISE EXCEPTION 'a proposal of gabriel_agent names the model call that made it'
      USING ERRCODE = 'check_violation';
  END IF;
  -- THE DIGEST OF A MACHINE ACT. A pending act with the same digest is the same act, and the
  -- unique index returns it to a retry. The operator gets none, so an act of the operator is
  -- never joined to an act of a machine.
  NEW.act_digest := CASE WHEN NEW.author_role = 'gabriel_app' THEN NULL
    ELSE act_digest_of(NEW.op, NEW.target_kind, NEW.target_id, NEW.payload, NEW.src::text[],
                       NEW.author_role) END;
  RETURN NEW;
END $$;

-- THE SAME WITNESS ON THE QUEUE. A name a worker passed for claimed_by proved nothing about
-- who holds the row, so the taker is the connection role. The release writes no hour, and the
-- name goes with it: the two columns move as one pair.
CREATE OR REPLACE FUNCTION stamp_claimed_by() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.claimed_at IS NULL THEN
    NEW.claimed_by := NULL;
  ELSE
    NEW.claimed_by := session_user;
  END IF;
  RETURN NEW;
END $$;

-- INVARIANT 2 for proposals.src. An array cannot carry a foreign key, so a trigger carries it.
CREATE OR REPLACE FUNCTION proposals_src_exists_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE missing text;
BEGIN
  SELECT string_agg(d, ', ' ORDER BY d) INTO missing
    FROM unnest(NEW.src) AS d
   WHERE NOT EXISTS (SELECT 1 FROM public.documents x WHERE x.id = d);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'the proposal cites a document that does not exist: %', missing
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

-- THE UNIT OF DECISION (P11). The operator decides one entity with the relations that depend on
-- it. A relation whose end is a pending act outside its group, or a relation, is a unit of its
-- own, so that no entity waits for another group or for a relation. If not, a relation belongs to its source end when that end is a
-- pending entity of the same group, then to its target end. Every other act is its own unit. An
-- entity act has the identifier of the entity it creates, so the unit of an entity is that
-- identifier. The unit is frozen with the act.
CREATE OR REPLACE FUNCTION stamp_unit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_src uuid;
  v_dst uuid;
BEGIN
  NEW.unit_id := NEW.id;
  IF NEW.op <> 'create_relation' OR NEW.batch_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_src := (NEW.payload->>'src_id')::uuid;
  v_dst := (NEW.payload->>'dst_id')::uuid;
  IF EXISTS (SELECT 1 FROM public.proposals o
              WHERE o.id IN (v_src, v_dst) AND o.status = 'pending'
                AND NOT (o.op = 'create_entity'
                         AND o.batch_id IS NOT DISTINCT FROM NEW.batch_id))
     OR EXISTS (SELECT 1 FROM public.relations r WHERE r.id IN (v_src, v_dst)) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.proposals o
              WHERE o.id = v_src AND o.status = 'pending' AND o.op = 'create_entity'
                AND o.batch_id = NEW.batch_id) THEN
    NEW.unit_id := v_src;
  ELSIF EXISTS (SELECT 1 FROM public.proposals o
                 WHERE o.id = v_dst AND o.status = 'pending' AND o.op = 'create_entity'
                   AND o.batch_id = NEW.batch_id) THEN
    NEW.unit_id := v_dst;
  END IF;
  RETURN NEW;
END $$;

-- THE LOG IS FROZEN AT THE INSERT, AND NOT AT THE DECISION. A pending act is already public
-- under PU1, so an agent that runs again must not rewrite what it said. Measured on #16: a
-- table owner ignores a column grant, and only a trigger held.
CREATE OR REPLACE FUNCTION proposals_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'a proposal is never deleted. It is the record of what was set aside';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'proposal % is already %, and a decided act is frozen', OLD.id, OLD.status;
  END IF;
  IF NEW.status = 'pending' THEN
    RAISE EXCEPTION 'a proposal leaves pending and never returns to it';
  END IF;
  -- Everything except the decision and its snapshot is frozen.
  IF (NEW.id, NEW.op, NEW.target_kind, NEW.target_id, NEW.payload, NEW.src, NEW.names,
      NEW.dissent, NEW.dissent_reason, NEW.author_role, NEW.xact, NEW.created_at,
      NEW.model_call_id, NEW.act_digest, NEW.originator, NEW.batch_id, NEW.unit_id)
     IS DISTINCT FROM
     (OLD.id, OLD.op, OLD.target_kind, OLD.target_id, OLD.payload, OLD.src, OLD.names,
      OLD.dissent, OLD.dissent_reason, OLD.author_role, OLD.xact, OLD.created_at,
      OLD.model_call_id, OLD.act_digest, OLD.originator, OLD.batch_id, OLD.unit_id) THEN
    RAISE EXCEPTION 'a proposal is frozen at the insert';
  END IF;
  RETURN NEW;
END $$;

-- A CALL IS A FACT AND NOT A STATE: it is written once and never changes. The owner and the
-- superuser ignore a grant, so a trigger holds it.
CREATE OR REPLACE FUNCTION model_call_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'a model call is never deleted. It is the record of what the model was asked';
  END IF;
  RAISE EXCEPTION 'a model call is never updated. It is the record of what the model was asked';
END $$;

-- A CITATION IS A FACT AND NOT A STATE: where a page states a claim is written once, with the
-- claim. A citation that changed after the decision would change the proof in silence. The owner
-- and the superuser ignore a grant, so a trigger holds it. The reading table went in 0041, and
-- the drop below removes its function, and the trigger that used it, from an older database.
DROP FUNCTION IF EXISTS claim_reading_append_only_fn() CASCADE;
CREATE OR REPLACE FUNCTION citation_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'a citation is never %. It is the record of where a page states a claim',
    CASE TG_OP WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
END $$;

-- M4. src_id and dst_id carry no foreign key, because the target is polymorphic. FOR KEY SHARE
-- is the point: without the lock, one session adds a relation while another deletes the
-- endpoint, and both commit.
CREATE OR REPLACE FUNCTION check_relation_endpoints() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE ok boolean;
BEGIN
  IF NEW.src_kind = 'entity'
    THEN PERFORM 1 FROM public.entities  WHERE id = NEW.src_id FOR KEY SHARE;
    ELSE PERFORM 1 FROM public.relations WHERE id = NEW.src_id FOR KEY SHARE;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the source % does not exist', NEW.src_id
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'relation_ends_exist',
            HINT = 'srcId';
  END IF;

  IF NEW.dst_kind = 'entity'
    THEN PERFORM 1 FROM public.entities  WHERE id = NEW.dst_id FOR KEY SHARE;
    ELSE PERFORM 1 FROM public.relations WHERE id = NEW.dst_id FOR KEY SHARE;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the target % does not exist', NEW.dst_id
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'relation_ends_exist',
            HINT = 'dstId';
  END IF;

  RETURN NEW;
END $$;


-- M6. An interval belongs to a type that takes one, and the type row says so. FOR SHARE is the
-- point: the foreign key takes FOR KEY SHARE alone, which does not block an update of
-- takes_interval, so without it a dated insert and a flip of the flag to false both commit.
-- The refusal keeps the name of the check it replaced.
CREATE OR REPLACE FUNCTION check_relation_interval() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE dated boolean;
BEGIN
  IF NEW.valid_from IS NULL AND NEW.valid_to IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT t.takes_interval INTO dated FROM public.relation_type t
   WHERE t.key = NEW.type FOR SHARE;
  IF NOT coalesce(dated, false) THEN
    RAISE EXCEPTION 'a relation of type % takes no interval, so it has no first and no last day',
      NEW.type
      USING ERRCODE = 'check_violation', CONSTRAINT = 'rel_dates_scope', HINT = 'validFrom';
  END IF;
  RETURN NEW;
END $$;

-- A RELATION OF A DATED TYPE HAS AN END DATE, AND ITS PAIR OF ENDS HOLDS ONE OPEN RELATION OF THAT
-- TYPE. Open means no `valid_to`. Without the rule, a second `owns` between the same two ends is a
-- second claim that nothing closes, and a reader cannot say which one stands. A type that takes no
-- interval has no end date, so it may repeat. The advisory lock makes two concurrent inserts wait
-- for each other: the second sees the first once it commits, and is refused.
CREATE OR REPLACE FUNCTION check_relation_one_open() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE dated boolean;
BEGIN
  IF NEW.valid_to IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT t.takes_interval INTO dated FROM public.relation_type t WHERE t.key = NEW.type;
  IF NOT coalesce(dated, false) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.type || '|' || NEW.src_kind || '|' || NEW.src_id::text
             || '|' || NEW.dst_kind || '|' || NEW.dst_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.relations r
              WHERE r.type = NEW.type
                AND r.src_kind = NEW.src_kind AND r.src_id = NEW.src_id
                AND r.dst_kind = NEW.dst_kind AND r.dst_id = NEW.dst_id
                AND r.valid_to IS NULL
                AND r.id <> NEW.id) THEN
    RAISE EXCEPTION 'a relation of type % between these ends is already open: give it an end date first', NEW.type
      USING ERRCODE = 'unique_violation', CONSTRAINT = 'relations_one_open_per_type',
            HINT = 'validTo';
  END IF;
  RETURN NEW;
END $$;

-- The other side of the same rule: a type stops taking an interval only when no dated relation
-- of it stands. The update holds the row lock, so a dated insert that waits on FOR SHARE above
-- commits first and is seen here, or starts after and is refused there.
CREATE OR REPLACE FUNCTION check_relation_type_interval() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.takes_interval AND NOT NEW.takes_interval AND EXISTS (
       SELECT 1 FROM public.relations r
        WHERE r.type = NEW.key AND (r.valid_from IS NOT NULL OR r.valid_to IS NOT NULL)) THEN
    RAISE EXCEPTION 'relation type % still holds a relation with an interval', NEW.key
      USING ERRCODE = 'check_violation', CONSTRAINT = 'rel_dates_scope',
            TABLE = 'relation_type', SCHEMA = 'public';
  END IF;
  RETURN NEW;
END $$;


-- ================================================================================ THE DOORS ==
-- Fifteen functions, and no role holds INSERT, UPDATE or DELETE on any table.

-- P6, one ingestion door. The object goes to the store first, the row records it, and the job
-- row is written IN THE SAME TRANSACTION: a document row with no job row is invisible to the
-- agents and to the interface, and a job row with no document row names nothing.
--
-- THE PROVIDER IS THE LAST PARAMETER AND IT IS OPTIONAL, so every caller that passes the first
-- nine by position stays correct. A document with no provider is internal tier. The foreign key
-- is the one rule for an unknown provider: the door does no lookup of its own, and the refusal
-- names the value in its detail.
--
-- THE COST IS AFTER THE PROVIDER, AND IT IS OPTIONAL TOO, for the same reason. It is the price
-- of a bought filing in euros. put_fetched_document passes ten arguments by position, so it
-- stores no cost, and a fetch costs nothing that the record must keep.
--
-- The earlier signatures are dropped here: a re-runnable file that only replaces would leave them
-- side by side, and a call with fewer arguments would then be ambiguous.
DROP FUNCTION IF EXISTS put_document(text,text,text,text,text,text,text,text,date);
DROP FUNCTION IF EXISTS put_document(text,text,text,text,text,text,text,text,date,text);
CREATE OR REPLACE FUNCTION put_document(
  p_id           text,
  p_kind         text,
  p_title        text,
  p_s3_key       text DEFAULT NULL,
  p_uri          text DEFAULT NULL,
  p_archive_uri  text DEFAULT NULL,
  p_sha256       text DEFAULT NULL,
  p_mime         text DEFAULT NULL,
  p_retrieved_at date DEFAULT NULL,
  p_provider_id  text DEFAULT NULL,
  p_cost_eur     numeric DEFAULT NULL)
RETURNS doc_id
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
-- MEASURED, 20 August 2026: a plpgsql variable OF A DOMAIN TYPE is initialised to NULL, and the
-- domain checks it on entry. `DECLARE v_id doc_id` therefore raised doc_id_check before the
-- function ran one statement. The variable is plain text; the RETURN value still carries the
-- domain, and it is never null.
DECLARE v_id text;
BEGIN
  INSERT INTO public.documents
    (id, kind, title, s3_key, uri, archive_uri, sha256, mime, retrieved_at, provider_id,
     cost_eur)
  VALUES
    (p_id::doc_id, p_kind, p_title, p_s3_key, p_uri, p_archive_uri, p_sha256, p_mime,
     p_retrieved_at, p_provider_id, p_cost_eur)
  RETURNING id INTO v_id;

  -- STORING A DOCUMENT STARTS NO WORK. The row says that the document entered the door, and it is
  -- born `done`: nothing claims it and nothing finishes it. Work is asked for by enqueue_job,
  -- for the one document that needs it, with the kind of work it needs.
  --
  -- A HAND-ENTERED SOURCE IS THE ONE EXCEPTION, and it is a rule of this line alone. A `manual`
  -- row carries no file and no address, so an agent would have nothing to read and the queue
  -- holds no row for it. The queue is therefore not the whole record of what passed the door.
  --
  -- THE DATE IS NOT WHAT DECIDES IT. Since migration 0011 the retrieval date is demanded of the
  -- BYTES and not of the kind (doc_retrieved_with_bytes), so a `url` row with no date is a
  -- lawful row that names an address nobody has read yet. Such a row DOES earn a job.
  INSERT INTO public.jobs (document_id, kind, status, finished_at)
  SELECT v_id::doc_id, 'store_only', 'done', now() WHERE p_kind <> 'manual';

  RETURN v_id;
END $$;

-- THE SENTENCE OF EACH RULE THAT A TABLE HOLDS. PostgreSQL composes the message of a CHECK, a
-- key or a unique index itself, and that message names a table and not the fault. A door that
-- writes a table catches such a refusal and raises the sentence below in its place, with the same
-- code and the same rule name. The field is the field of the request that the caller corrects.
-- A door names its rule and no table, so a reader of the refusal can tell the two apart.
CREATE OR REPLACE FUNCTION raise_rule(p_rule text, p_table text, p_code text)
RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_sentence text;
  v_field    text;
BEGIN
  IF coalesce(p_table, '') = '' THEN
    RETURN;
  END IF;
  SELECT r.sentence, r.field INTO v_sentence, v_field FROM (VALUES
    ('proposals_payload_attrs', 'attrs',
     'each attribute key is lower case words of letters and digits, joined by one underscore, '
     'with 63 characters at most, and each value is a text that is not blank, a number, a yes '
     'or no, or a flat list of them'),
    ('entities_attrs_valid', 'attrs',
     'each attribute key is lower case words of letters and digits, joined by one underscore, '
     'with 63 characters at most, and each value is a text that is not blank, a number, a yes '
     'or no, or a flat list of them'),
    ('relations_attrs_valid', 'attrs',
     'each attribute key is lower case words of letters and digits, joined by one underscore, '
     'with 63 characters at most, and each value is a text that is not blank, a number, a yes '
     'or no, or a flat list of them'),
    ('proposals_update_names_attrs', 'attrs', 'an update names at least one attribute'),
    ('proposals_update_entity_shape', 'label',
     'the act names a new name, a new type, or both, and neither one is blank'),
    ('proposals_create_entity_shape', 'label',
     'a new entity has a type and a name, and neither one is blank'),
    ('entities_label_check', 'label', 'the name of an entity is not blank'),
    ('proposals_create_relation_shape', 'validFrom',
     'a new relation has a type and two ends, and each day of its interval is a day of the '
     'calendar, written as year, month and day: 2026-01-31'),
    ('relations_type_check', 'type', 'the type of a relation is not blank'),
    ('proposals_create_relation_type_length', 'type',
     'the type of a relation is 200 characters at most'),
    ('relations_type_length', 'type', 'the type of a relation is 200 characters at most'),
    ('rel_dates_order', 'validFrom', 'an interval starts on or before the day it ends'),
    ('proposals_payload_geom', 'geom',
     'the geometry is a Point, a MultiPoint, a LineString, a MultiLineString, a Polygon or a '
     'MultiPolygon, with a type, coordinates and no other key, and with no empty list'),
    ('proposals_payload_geom_position', 'geom',
     'each position of the geometry is a longitude from -180 to 180 and a latitude from -90 to '
     '90, and no third number'),
    ('entities_geom_on_globe', 'geom',
     'the geometry is not a valid shape on the globe: a line has two positions or more, and a '
     'ring has four or more and ends on the position it starts on'),
    ('proposals_op_target_kind', 'targetKind', 'the act names a target of the wrong kind'),
    ('proposals_target_pairs', 'targetId', 'the act names its target with a kind and an id'),
    ('proposals_target_required', 'targetId', 'the act names its target'),
    ('proposals_map_document_shape', 'mapping',
     'a mapping names one document and the call of its model, a table name, a header signature '
     'of 64 hexadecimal characters, a modality of enacts, asserts, attributes, alleges or '
     'denies, its rows as an object and its relations as a list, and no other key'),
    ('proposals_src_shape', 'documents', 'the act cites at least one document'),
    ('proposals_machine_not_reserved', 'documents',
     'a machine cannot cite the reserved documents manual and inherited'),
    ('proposals_src_within', 'documents',
     'each document that a value cites is also a document of the act')
  ) AS r(rule, field, sentence)
  WHERE r.rule = p_rule;
  IF v_sentence IS NULL THEN
    RETURN;
  END IF;
  RAISE EXCEPTION USING MESSAGE = v_sentence, ERRCODE = p_code, CONSTRAINT = p_rule,
    HINT = v_field;
END $$;

-- A REFUSAL OF ONE ITEM OF A BATCH. The rule keeps its own sentence and its field from the table
-- above, and the sentence goes on with the number of the item, so the caller corrects that item.
-- A rule that the table does not word keeps the sentence that it raised.
CREATE OR REPLACE FUNCTION raise_item_rule(p_item int, p_rule text, p_code text, p_said text)
RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_said  text := p_said;
  v_field text := '';
BEGIN
  BEGIN
    PERFORM public.raise_rule(p_rule, 'proposals', p_code);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT, v_field = PG_EXCEPTION_HINT;
  END;
  RAISE EXCEPTION 'item %: %', p_item, v_said
    USING ERRCODE = 'invalid_parameter_value', CONSTRAINT = coalesce(p_rule, ''),
          HINT = coalesce(v_field, '');
END $$;

-- THE DOOR OF THE OPERATOR. gabriel_app alone calls it, through the writer. A machine proposes
-- through propose_batch, which writes the citations with the act. The author role is stamped by
-- a trigger and is never a parameter.
--
-- The earlier signatures are dropped here: a re-runnable file that only replaces would leave them
-- side by side, and a call with fewer arguments would then be ambiguous.
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean);
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text);
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text,uuid);
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid);
CREATE OR REPLACE FUNCTION propose_change(
  p_op              text,
  p_payload         jsonb,
  p_src             text[],
  p_target_kind     text    DEFAULT NULL,
  p_target_id       uuid    DEFAULT NULL,
  p_names           uuid[]  DEFAULT '{}',
  p_dissent         boolean DEFAULT false,
  p_model_call_id   uuid    DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id    uuid;
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  INSERT INTO public.proposals
    (op, target_kind, target_id, payload, src, names, dissent, author_role, model_call_id)
  VALUES
    (p_op, p_target_kind, p_target_id, p_payload, p_src::doc_id[],
     coalesce(p_names, '{}'::uuid[]), coalesce(p_dissent, false),
     session_user,          -- overwritten by the stamp trigger; a value is needed for NOT NULL
     p_model_call_id)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN integrity_constraint_violation THEN
  GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
  PERFORM public.raise_rule(v_rule, v_table, v_code);
  RAISE;
END $$;

-- THE ONE DOOR OF A MACHINE. gabriel_agent and gabriel_research call it with a batch of items.
-- Each item is one act, the party that first stated it, and its citations: the page and the span
-- that code found for each excerpt. The door writes every act and every citation in one
-- transaction, so a fault in one item refuses the whole batch.
--
-- CODE MINTS THE IDENTIFIER OF EACH ITEM, so an item can name an entity that an earlier item of
-- the batch creates. The promotion gives the new row that identifier.
--
-- A PENDING ACT THAT IS ALREADY WRITTEN IS RETURNED, NOT WRITTEN AGAIN. The unique index on the
-- digest of a pending act makes a retry return the act that waits. That act keeps its own
-- identifier and its own originator, so each later item that named the minted one names the act
-- that waits instead. The door adds to that act each citation of the item that it does not hold
-- yet, so a second passage of the same witness is kept, and a retry writes no citation twice.
--
-- THE RULES OF THE DATA ARE HERE. A machine proposes a new entity, a new relation or new
-- attributes. A machine act cites at least one page. The page exists in the text of the document,
-- the span lies in that page, and the document is a source of the act. Each refusal names the
-- item. The tool finds the excerpt, and it checks that each end and each target exists, so that a
-- model gets its fault before the write; the promotion holds those two rules too.
--
-- THE ITEMS THAT NAME EACH OTHER ARE ONE BATCH, and the operator decides them as one unit. An
-- item that names no other item, and that no other item names, stays a single act: a faulty claim
-- never blocks a good claim of the same page. A retry joins the batch of the act that waits.
CREATE OR REPLACE FUNCTION propose_batch(p_items jsonb)
RETURNS TABLE (item int, proposal_id uuid, written boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_item     jsonb;
  v_no       int;
  v_minted   uuid;
  v_id       uuid;
  v_payload  text;
  v_names    uuid[];
  v_target   uuid;
  v_src      text[];
  v_cite     jsonb;
  v_length   int;
  v_moved    jsonb := '{}'::jsonb;
  v_from     text;
  v_to       text;
  v_rule     text;
  v_code     text;
  v_said     text;
  v_valid    boolean;
  v_group    jsonb := '{}'::jsonb;
  v_joined   text[];
  v_key      text;
  v_batches  jsonb := '{}'::jsonb;
  v_batch    uuid;
  v_held     uuid;
BEGIN
  IF coalesce(jsonb_typeof(p_items), 'absent') <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'a batch holds at least one item'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- THE GROUPS OF LINKED ITEMS. Each item starts as a group of its own. Each item then joins its
  -- group to the groups of the items that it names, in any order of the items. Each group takes
  -- the identifier of one of its items.
  SELECT coalesce(jsonb_object_agg(e.value->>'id', e.value->>'id'), '{}'::jsonb) INTO v_group
    FROM jsonb_array_elements(p_items) AS e WHERE e.value->>'id' IS NOT NULL;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT array_agg(DISTINCT v_group->>n.ref) INTO v_joined
      FROM (SELECT jsonb_array_elements_text(
                     CASE WHEN jsonb_typeof(v_item->'names') = 'array' THEN v_item->'names'
                          ELSE '[]'::jsonb END)
            UNION SELECT v_item->>'id'
            UNION SELECT v_item->>'target_id'
            UNION SELECT v_item->'payload'->>'src_id'
            UNION SELECT v_item->'payload'->>'dst_id') AS n(ref)
     WHERE n.ref IS NOT NULL AND v_group ? n.ref;
    IF cardinality(v_joined) > 1 THEN
      v_key := v_joined[1];
      SELECT jsonb_object_agg(g.key, CASE WHEN g.value = ANY (v_joined) THEN v_key ELSE g.value END)
        INTO v_group FROM jsonb_each_text(v_group) AS g;
    END IF;
  END LOOP;

  -- The entities go first, so that the unit stamp of each relation finds the entity acts of its
  -- batch in any order of the items. Each answer keeps the number of its item.
  FOR v_item, v_no IN SELECT e.value, e.ordinality::int FROM jsonb_array_elements(p_items)
                         WITH ORDINALITY AS e(value, ordinality)
                       ORDER BY e.value->>'op' IS DISTINCT FROM 'create_entity', e.ordinality LOOP
    v_minted  := (v_item->>'id')::uuid;
    -- The promotion gives the new row this identifier, so it must not be the identifier of a
    -- row that the record already holds.
    IF EXISTS (SELECT 1 FROM public.entities e WHERE e.id = v_minted)
       OR EXISTS (SELECT 1 FROM public.relations r WHERE r.id = v_minted) THEN
      RAISE EXCEPTION 'item %: the identifier % is already the identifier of a row of the record',
        v_no, v_minted
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_payload := coalesce(v_item->'payload', 'null'::jsonb)::text;
    v_names   := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item->'names', '[]'))::uuid);
    v_target  := (v_item->>'target_id')::uuid;
    v_src     := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item->'src', '[]')));

    -- An earlier item that waited already gave its own identifier. A minted identifier is a
    -- random uuid, so a text replace finds it alone.
    FOR v_from, v_to IN SELECT key, value #>> '{}' FROM jsonb_each(v_moved) LOOP
      v_payload := replace(v_payload, v_from, v_to);
      v_names   := array_replace(v_names, v_from::uuid, v_to::uuid);
      IF v_target = v_from::uuid THEN v_target := v_to::uuid; END IF;
    END LOOP;

    IF btrim(coalesce(v_item->>'originator', ''), E' \t\n\r\f\v') = '' THEN
      RAISE EXCEPTION 'item %: a machine act names the party that first stated it', v_no
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- THE ORIGINATOR OF THE V1 IMPORT IS RESERVED. The review names an act with it "v1 import",
    -- so only an item that cites the stored v1 ORBAT alone may name it.
    IF btrim(v_item->>'originator', E' \t\n\r\f\v') = 'GAB v1 ORBAT (operator)'
       AND (cardinality(v_src) = 0
            OR EXISTS (SELECT 1 FROM unnest(v_src) AS s(doc)
                        WHERE NOT EXISTS (
                                SELECT 1 FROM public.documents d
                                 WHERE d.id = s.doc AND d.title =
                                   'GAB v1 ORBAT: military units and organisations of the v1 '
                                   'GeoPackage'))) THEN
      RAISE EXCEPTION 'item %: the originator "GAB v1 ORBAT (operator)" belongs to the import of '
                      'the v1 work, and the item cites a document that is not the v1 ORBAT', v_no
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- A change of a name or a type and a deletion rewrite what the operator already decided.
    IF coalesce(v_item->>'op', '') NOT IN ('create_entity','create_relation','update_attrs') THEN
      RAISE EXCEPTION 'item %: a machine proposes a new entity, a new relation or new '
                      'attributes, and never a change of a name or a type, nor a deletion', v_no
        USING ERRCODE = 'invalid_parameter_value', HINT = 'op';
    END IF;
    IF coalesce(v_item->>'modality', '') NOT IN ('enacts','asserts','attributes','alleges',
                                                 'denies') THEN
      RAISE EXCEPTION 'item %: the modality is one of enacts, asserts, attributes, alleges, '
                      'denies', v_no
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF coalesce(jsonb_typeof(v_item->'citations'), 'absent') <> 'array'
       OR jsonb_array_length(v_item->'citations') = 0 THEN
      RAISE EXCEPTION 'item %: a machine act cites at least one page', v_no
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    FOR v_cite IN SELECT value FROM jsonb_array_elements(v_item->'citations') LOOP
      IF NOT (v_cite->>'document') = ANY (v_src) THEN
        RAISE EXCEPTION 'item %: the act cites page % of %, and that document is not a source '
                        'of the act', v_no, v_cite->>'page', v_cite->>'document'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      SELECT char_length(t.text) INTO v_length
        FROM public.document_text t
       WHERE t.document_id = v_cite->>'document'
         AND t.extractor = v_cite->>'text_extractor'
         AND t.page = (v_cite->>'page')::int;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'item %: page % of the text % of document % does not exist', v_no,
          v_cite->>'page', v_cite->>'text_extractor', v_cite->>'document'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      -- char_length counts the characters of the database encoding, which is UTF-8: code points.
      IF coalesce((v_cite->>'start')::int < 0 OR (v_cite->>'start')::int >= (v_cite->>'end')::int
                  OR (v_cite->>'end')::int > v_length, true) THEN
        RAISE EXCEPTION 'item %: the span % to % lies outside page %, which holds % code points',
          v_no, v_cite->>'start', v_cite->>'end', v_cite->>'page', v_length
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END LOOP;

    -- THREE RULES THAT THE TABLE CANNOT HOLD, AND THE PROMOTION HOLDS TOO LATE. A relation table
    -- and a geometry column refuse them, after the act waited in the queue. The scope of an
    -- interval reads the type row, so no CHECK of this table can hold it.
    IF v_item->>'op' = 'create_relation' THEN
      IF NOT coalesce(pg_input_is_valid(v_payload::jsonb->>'valid_from', 'date'), true)
         OR NOT coalesce(pg_input_is_valid(v_payload::jsonb->>'valid_to', 'date'), true) THEN
        PERFORM public.raise_item_rule(v_no, 'proposals_create_relation_shape', '23514',
                                       'the day is not a day of the calendar');
      END IF;
      IF (v_payload::jsonb->>'valid_from')::date > (v_payload::jsonb->>'valid_to')::date THEN
        PERFORM public.raise_item_rule(v_no, 'rel_dates_order', '23514',
                                       'an interval starts on or before the day it ends');
      END IF;
      IF (v_payload::jsonb ? 'valid_from' OR v_payload::jsonb ? 'valid_to')
         AND NOT EXISTS (SELECT 1 FROM public.relation_type t
                          WHERE t.key = v_payload::jsonb->>'type' AND t.takes_interval) THEN
        RAISE EXCEPTION 'item %: a relation of type % takes no interval, so it has no first and '
                        'no last day', v_no, v_payload::jsonb->>'type'
          USING ERRCODE = 'invalid_parameter_value', CONSTRAINT = 'rel_dates_scope',
                HINT = 'validFrom';
      END IF;
    END IF;
    IF v_payload::jsonb ? 'geom' THEN
      BEGIN
        v_valid := public.ST_IsValid(public.ST_GeomFromGeoJSON(v_payload::jsonb->'geom'));
      EXCEPTION WHEN OTHERS THEN
        v_valid := false;
      END;
      IF NOT coalesce(v_valid, false) THEN
        PERFORM public.raise_item_rule(v_no, 'entities_geom_on_globe', '23514',
                                       'the geometry is not a valid shape on the globe');
      END IF;
    END IF;

    -- A group of one item is a single act. The first item of a group that already waits gives
    -- the group its batch, so a retry joins the batch that the first call made.
    v_key   := v_group->>(v_item->>'id');
    v_batch := CASE WHEN (SELECT count(*) FROM jsonb_each_text(v_group) g WHERE g.value = v_key) > 1
                    THEN coalesce((v_batches->>v_key)::uuid, v_key::uuid) END;

    v_id := NULL;
    -- A rule of the table refuses the act, and the caller must know which item it refused.
    BEGIN
      INSERT INTO public.proposals
        (id, op, target_kind, target_id, payload, src, names, dissent, dissent_reason,
         author_role, model_call_id, originator, batch_id)
      VALUES
        (v_minted, v_item->>'op', v_item->>'target_kind', v_target, v_payload::jsonb,
         v_src::doc_id[], v_names, coalesce((v_item->>'dissent')::boolean, false),
         v_item->>'dissent_reason',
         session_user,        -- overwritten by the stamp trigger; a value is needed for NOT NULL
         (v_item->>'model_call_id')::uuid, btrim(v_item->>'originator', E' \t\n\r\f\v'),
         v_batch)
      ON CONFLICT (act_digest) WHERE status = 'pending' DO NOTHING
      RETURNING id, batch_id INTO v_id, v_held;
    EXCEPTION WHEN integrity_constraint_violation OR data_exception THEN
      GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_code = RETURNED_SQLSTATE,
                              v_said = MESSAGE_TEXT;
      PERFORM public.raise_item_rule(v_no, v_rule, v_code, v_said);
    END;

    written := v_id IS NOT NULL;
    IF v_id IS NULL THEN
      -- The conflict is the only way to get no row, so the act waits under its digest.
      -- The share lock waits for a decision on that act that runs now. So a retry never joins a
      -- batch that the operator decides at the same time.
      SELECT p.id, p.batch_id INTO v_id, v_held FROM public.proposals p
       WHERE p.status = 'pending'
         AND p.act_digest = act_digest_of(v_item->>'op', v_item->>'target_kind', v_target,
                                          v_payload::jsonb, v_src, session_user::text)
         FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'item %: the operator decided the act that this item repeats while the '
                        'batch was written, so send the batch again', v_no
          USING CONSTRAINT = 'proposal_pending';
      END IF;
      v_moved := v_moved || jsonb_build_object(v_minted::text, v_id::text);
    END IF;
    IF v_batch IS NOT NULL AND NOT v_batches ? v_key THEN
      v_batches := v_batches || jsonb_build_object(v_key, coalesce(v_held, v_batch));
    END IF;

    INSERT INTO public.citation (claim_id, doc_id, text_extractor, page, start, "end", modality)
    SELECT DISTINCT v_id, c->>'document', c->>'text_extractor', (c->>'page')::int,
           (c->>'start')::int, (c->>'end')::int, v_item->>'modality'
      FROM jsonb_array_elements(v_item->'citations') AS c
     WHERE NOT EXISTS (
             SELECT 1 FROM public.citation h
              WHERE h.claim_id = v_id AND h.doc_id = c->>'document'
                AND h.text_extractor = c->>'text_extractor' AND h.page = (c->>'page')::int
                AND h.start = (c->>'start')::int AND h."end" = (c->>'end')::int
                AND h.modality = v_item->>'modality');

    item := v_no; proposal_id := v_id;
    RETURN NEXT;
  END LOOP;
END $$;

-- THE DOOR OF A MAPPING. gabriel_agent alone calls it: the mapper is the one agent that proposes
-- how the columns of a table map, and it names the call of the model that gave the mapping. The
-- table holds the rules of the payload. The call must be a call of the map_structured job of the
-- document that the caller runs now, so a mapping never names the call of another job. A pending
-- mapping that is written already is returned, as the batch door returns a pending act, so a retry
-- writes nothing twice.
CREATE OR REPLACE FUNCTION propose_mapping(p_document text, p_mapping jsonb, p_model_call uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id    uuid;
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  IF NOT EXISTS (SELECT 1
                   FROM public.model_call m
                   JOIN public.jobs j ON j.id = m.job_id
                  WHERE m.id = p_model_call AND j.kind = 'map_structured'
                    AND j.status = 'running' AND j.claimed_by = session_user
                    AND j.document_id = p_document::doc_id) THEN
    RAISE EXCEPTION 'the call of a mapping belongs to the map_structured job of the document, '
                    'and this job must run under this role'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.proposals
    (op, payload, src, author_role, model_call_id)
  VALUES
    ('map_document', p_mapping, ARRAY[p_document]::doc_id[],
     session_user,          -- overwritten by the stamp trigger; a value is needed for NOT NULL
     p_model_call)
  ON CONFLICT (act_digest) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT p.id INTO v_id FROM public.proposals p
     WHERE p.status = 'pending'
       AND p.act_digest = act_digest_of('map_document', NULL, NULL, p_mapping,
                                        ARRAY[p_document], session_user::text);
  END IF;
  RETURN v_id;
EXCEPTION WHEN integrity_constraint_violation THEN
  GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
  PERFORM public.raise_rule(v_rule, v_table, v_code);
  RAISE;
END $$;

-- THE ONE DOOR INTO THE RECORD OF A MODEL CALL. gabriel_agent holds it, and the role writes no
-- table by hand. It takes the digest of the prompt and never the prompt, and the table refuses a
-- digest that is not 64 hexadecimal characters. The outcome list is a CHECK of the table, so a
-- word outside it is refused there, and a test holds that list against packages/model.
CREATE OR REPLACE FUNCTION record_model_call(
  p_agent           text,
  p_agent_version   text,
  p_endpoint        text,
  p_requested_model text,
  p_prompt_sha256   text,
  p_latency_ms      int,
  p_outcome         text,
  p_job_id          uuid DEFAULT NULL,
  p_served_model    text DEFAULT NULL,
  p_input_tokens    int  DEFAULT NULL,
  p_output_tokens   int  DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.model_call
    (job_id, agent, agent_version, endpoint, requested_model, served_model, prompt_sha256,
     input_tokens, output_tokens, latency_ms, outcome)
  VALUES
    (p_job_id, p_agent, p_agent_version, p_endpoint, p_requested_model, p_served_model,
     p_prompt_sha256, p_input_tokens, p_output_tokens, p_latency_ms, p_outcome)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- THE STEP THAT WRITES THE EVIDENTIARY LAYER. No role holds it: it runs inside the two doors
-- below, which are owned by the same role. It encodes no rule about WHO may decide.
CREATE OR REPLACE FUNCTION apply_proposal(p_id uuid, p_decided_by text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  p       public.proposals%ROWTYPE;
  v_id    uuid;
  v_old   jsonb;
  v_prior jsonb;
  v_attrs jsonb;
  v_type  text;
  v_uses  bigint;
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;

  -- FOR UPDATE closes the concurrent replay; the status test closes the serial one. #17 (a).
  SELECT * INTO p FROM public.proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the record holds no act %', p_id USING CONSTRAINT = 'proposal_exists';
  END IF;
  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'the act % is % already, and a decided act is frozen', p_id, p.status
      USING CONSTRAINT = 'proposal_pending';
  END IF;

  -- ---------------------------------------------------------------------------- creations --
  IF p.op = 'create_entity' THEN
    -- #93: an unrecognised word never refuses the row. It lands as `unknown` and survives
    -- beside it, so WHERE type = 'unknown' is a sorted worklist.
    SELECT t.key INTO v_type FROM public.entity_type t
      WHERE t.key = p.payload->>'type' AND NOT t.retired;
    -- S2: the row-level list backs label, type and geom, and never whatever an attribute's own
    -- src cites. payload.sources is the act's own citation for those columns; a candidate that
    -- gives none (no agent proposes a create today, #25) keeps the wider p.src, as before.
    -- The new row takes the identifier of its act, so an act of the same batch that names it
    -- before the promotion names the row that the promotion makes.
    INSERT INTO public.entities
      (id, type, proposed_type, label, geom, attrs, sources, promoted_from)
    VALUES (
      p.id,
      coalesce(v_type, 'unknown'),
      CASE WHEN v_type IS NULL THEN p.payload->>'type' END,
      p.payload->>'label',
      CASE WHEN p.payload ? 'geom'
           THEN public.ST_SetSRID(public.ST_GeomFromGeoJSON(p.payload->'geom'), 4326) END,
      coalesce(p.payload->'attrs', '{}'::jsonb),
      CASE WHEN p.payload ? 'sources'
           THEN ARRAY(SELECT jsonb_array_elements_text(p.payload->'sources'))::doc_id[]
           ELSE p.src END,
      p.id)
    RETURNING id INTO v_id;

  ELSIF p.op = 'create_relation' THEN
    -- The same fallback as create_entity: a word that is not a live type lands as `unknown`,
    -- and the word survives beside it. S2, the same split as create_entity above.
    SELECT t.key INTO v_type FROM public.relation_type t
      WHERE t.key = p.payload->>'type' AND NOT t.retired;
    INSERT INTO public.relations
      (id, type, proposed_type, src_kind, src_id, dst_kind, dst_id, valid_from, valid_to, attrs,
       sources, promoted_from)
    VALUES (
      p.id,
      coalesce(v_type, 'unknown'),
      CASE WHEN v_type IS NULL THEN p.payload->>'type' END,
      coalesce(p.payload->>'src_kind','entity'), (p.payload->>'src_id')::uuid,
      coalesce(p.payload->>'dst_kind','entity'), (p.payload->>'dst_id')::uuid,
      (p.payload->>'valid_from')::date, (p.payload->>'valid_to')::date,
      coalesce(p.payload->'attrs', '{}'::jsonb),
      CASE WHEN p.payload ? 'sources'
           THEN ARRAY(SELECT jsonb_array_elements_text(p.payload->'sources'))::doc_id[]
           ELSE p.src END,
      p.id)
    RETURNING id INTO v_id;

  -- ------------------------------------------------------------------------------ updates --
  ELSIF p.op IN ('update_attrs','update_relation') THEN
    IF p.target_kind = 'entity'
      THEN SELECT attrs INTO v_old FROM public.entities  WHERE id = p.target_id FOR UPDATE;
      ELSE SELECT attrs INTO v_old FROM public.relations WHERE id = p.target_id FOR UPDATE;
    END IF;
    -- #17 (c): a promotion that applies nothing must not commit as a success.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'the target % does not exist, and nothing was applied', p.target_id
        USING CONSTRAINT = 'target_exists', HINT = 'targetId';
    END IF;

    -- S2: the src of an attribute backs that one value alone. A changed value cites the sources
    -- of the act alone, and prior_value keeps the old claim. A kept value keeps each document it
    -- already cites, and then adds the new ones, so no act loses a corroboration. jsonb equality
    -- reads 41200.0 as 41200.
    SELECT jsonb_object_agg(n.k,
             CASE WHEN v_old ? n.k AND v_old->n.k->'v' = n.val->'v'
                  THEN jsonb_build_object('v', n.val->'v', 'src',
                         (v_old->n.k->'src') || coalesce(
                           (SELECT jsonb_agg(y.doc ORDER BY y.ord)
                              FROM jsonb_array_elements(n.val->'src') WITH ORDINALITY AS y(doc, ord)
                             WHERE NOT (v_old->n.k->'src') @> jsonb_build_array(y.doc)),
                           '[]'::jsonb))
                  ELSE n.val END)
      INTO v_attrs
      FROM jsonb_each(coalesce(p.payload->'attrs','{}'::jsonb)) AS n(k, val);

    -- ONLY THE KEYS THE ACT NAMED. A whole-row copy would freeze and republish every other
    -- key, and api.proposal publishes the copy.
    SELECT jsonb_object_agg(ok.k, v_old -> ok.k) INTO v_prior
      FROM jsonb_object_keys(coalesce(p.payload->'attrs','{}'::jsonb)) AS ok(k)
     WHERE v_old ? ok.k;

    IF p.target_kind = 'entity' THEN
      UPDATE public.entities
         SET attrs = attrs || coalesce(v_attrs,'{}'::jsonb), updated_at = now()
       WHERE id = p.target_id;
    ELSE
      UPDATE public.relations
         SET attrs = attrs || coalesce(v_attrs,'{}'::jsonb), updated_at = now()
       WHERE id = p.target_id;
    END IF;
    -- The row-level `sources` list is NOT extended here. It backs the typed columns outside
    -- `attrs`: label, type and geom on an entity; type, both endpoints and valid_from/valid_to
    -- on a relation. An attribute's own `src` backs that one value alone.
    v_id := p.target_id;

  -- ------------------------------------------------------------------------ name and type --
  ELSIF p.op = 'update_entity' THEN
    SELECT to_jsonb(e) INTO v_old FROM public.entities e WHERE id = p.target_id FOR UPDATE;
    IF v_old IS NULL THEN
      RAISE EXCEPTION 'the target % does not exist, and nothing was applied', p.target_id
        USING CONSTRAINT = 'target_exists', HINT = 'targetId';
    END IF;

    SELECT t.key INTO v_type FROM public.entity_type t
      WHERE t.key = p.payload->>'type' AND NOT t.retired;

    v_prior := jsonb_build_object('sources', v_old->'sources');
    IF p.payload ? 'label' THEN
      v_prior := v_prior || jsonb_build_object('label', v_old->'label');
    END IF;
    IF p.payload ? 'type' THEN
      v_prior := v_prior || jsonb_build_object('type', v_old->'type',
                                               'proposed_type', v_old->'proposed_type');
    END IF;

    UPDATE public.entities e
       SET label         = coalesce(p.payload->>'label', e.label),
           type          = CASE WHEN p.payload ? 'type'
                                THEN coalesce(v_type, 'unknown') ELSE e.type END,
           proposed_type = CASE WHEN NOT p.payload ? 'type' THEN e.proposed_type
                                WHEN v_type IS NULL THEN p.payload->>'type' END,
           -- The row-level list backs the name, the type and the location together, so an
           -- act that changes one of them replaces the whole list with its own sources.
           sources       = p.src,
           updated_at    = now()
     WHERE e.id = p.target_id
       AND (e.label, e.type, e.proposed_type) IS DISTINCT FROM
           (coalesce(p.payload->>'label', e.label),
            CASE WHEN p.payload ? 'type' THEN coalesce(v_type, 'unknown') ELSE e.type END,
            CASE WHEN NOT p.payload ? 'type' THEN e.proposed_type
                 WHEN v_type IS NULL THEN p.payload->>'type' END);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'the act changes neither the name nor the type of the entity, and nothing '
                      'was applied'
        USING CONSTRAINT = 'act_changes_something';
    END IF;
    v_id := p.target_id;

  -- ------------------------------------------------------------------------------ deletes --
  ELSIF p.op IN ('delete_entity','delete_relation') THEN
    IF p.target_kind = 'entity' THEN
      SELECT to_jsonb(e) INTO v_prior FROM public.entities e WHERE id = p.target_id FOR UPDATE;
      IF v_prior IS NULL THEN
        RAISE EXCEPTION 'the target % does not exist, and nothing was applied', p.target_id
          USING CONSTRAINT = 'target_exists', HINT = 'targetId';
      END IF;
      SELECT count(*) INTO v_uses FROM public.relations r
       WHERE (r.src_kind = 'entity' AND r.src_id = p.target_id)
          OR (r.dst_kind = 'entity' AND r.dst_id = p.target_id);
      IF v_uses > 0 THEN
        RAISE EXCEPTION 'the entity is an endpoint of % %, and it is not deleted. Delete each of '
                        'those relations first, and then delete the entity again',
                        v_uses, CASE WHEN v_uses = 1 THEN 'relation' ELSE 'relations' END
          USING CONSTRAINT = 'endpoint_free', HINT = 'targetId';
      END IF;
      DELETE FROM public.entities WHERE id = p.target_id;
    ELSE
      SELECT to_jsonb(r) INTO v_prior FROM public.relations r WHERE id = p.target_id FOR UPDATE;
      IF v_prior IS NULL THEN
        RAISE EXCEPTION 'the target % does not exist, and nothing was applied', p.target_id
          USING CONSTRAINT = 'target_exists', HINT = 'targetId';
      END IF;
      SELECT count(*) INTO v_uses FROM public.relations r
       WHERE (r.src_kind = 'relation' AND r.src_id = p.target_id)
          OR (r.dst_kind = 'relation' AND r.dst_id = p.target_id);
      IF v_uses > 0 THEN
        RAISE EXCEPTION 'the relation is an endpoint of % %, and it is not deleted. Delete each '
                        'of those relations first, and then delete this relation again',
                        v_uses, CASE WHEN v_uses = 1 THEN 'relation' ELSE 'relations' END
          USING CONSTRAINT = 'endpoint_free', HINT = 'targetId';
      END IF;
      DELETE FROM public.relations WHERE id = p.target_id;
    END IF;
    v_id := p.target_id;

  -- ---------------------------------------------------------------------------- a mapping --
  -- A MAPPING WRITES NOTHING TO THE GRAPH. It queues the load of its document in the same
  -- transaction, and the load proposes each row. The unique index holds one open job of a kind
  -- for a document, and the sentence below says it in place of the name of the index.
  ELSIF p.op = 'map_document' THEN
    BEGIN
      INSERT INTO public.jobs (document_id, kind, mapping)
      VALUES (p.src[1], 'load_mapped', p.id)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'document % has a load that is queued or runs already. Promote this '
                      'mapping when that load ends', p.src[1]
        USING ERRCODE = 'invalid_parameter_value', CONSTRAINT = 'jobs_one_open_per_kind';
    END;

  ELSE
    -- M12 makes a merge reversible through an alias table and a full snapshot. Neither table
    -- exists, so a merge cannot land, and it must not half-land.
    RAISE EXCEPTION 'the act % has no write path yet: a merge cannot be undone until the record '
                    'holds an alias table and a snapshot', p.op
      USING CONSTRAINT = 'op_has_path';
  END IF;

  UPDATE public.proposals
     SET status      = 'accepted',
         decided_at  = now(),
         decided_by  = p_decided_by,
         prior_value = v_prior
   WHERE id = p_id AND status = 'pending';

  RETURN v_id;
END $$;

-- A LINKED BATCH IS DECIDED AS ONE UNIT (operator decision). The doors of one act refuse an act
-- that waits in a batch, so no act of a batch is decided alone and a batch is never half decided.
-- No role holds this step: it runs inside the two doors of one act.
CREATE OR REPLACE FUNCTION refuse_batch_act(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_batch uuid;
BEGIN
  SELECT batch_id INTO v_batch FROM public.proposals
   WHERE id = p_id AND status = 'pending' AND batch_id IS NOT NULL;
  IF FOUND THEN
    RAISE EXCEPTION 'the act % is part of the linked batch %, and the operator decides a batch '
                    'as one unit: decide the batch', p_id, v_batch
      USING CONSTRAINT = 'batch_whole';
  END IF;
END $$;

-- THE DECISION ON AN ACT THAT WAITS. Only the operator role holds it, and that grant is the rule
-- "a machine proposes, only the operator promotes".
CREATE OR REPLACE FUNCTION promote_proposal(p_id uuid, p_decided_by text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  -- An act of a linked batch names another act of it, so it is promoted only with the batch.
  PERFORM public.refuse_batch_act(p_id);
  -- The measured forgery: propose and accept inside one transaction. Refused by a stored
  -- column, so the legitimate shape — proposed now, decided later — still passes. The operator
  -- signs an act of its own in one transaction through sign_change, which proposes it there.
  IF EXISTS (SELECT 1 FROM public.proposals
              WHERE id = p_id AND xact = pg_current_xact_id()) THEN
    RAISE EXCEPTION 'the act % was written by this transaction, and an act is not decided by '
                    'the transaction that proposed it', p_id
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'decided_later';
  END IF;
  RETURN public.apply_proposal(p_id, p_decided_by);
EXCEPTION WHEN integrity_constraint_violation THEN
  GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
  PERFORM public.raise_rule(v_rule, v_table, v_code);
  RAISE;
END $$;

-- THE ACT OF THE OPERATOR: one proposal and its promotion, in one transaction. Only the operator
-- role holds it, so a machine still proposes and never decides. The act is written whole or not
-- at all: a refusal at the promotion rolls the proposal back with it.
CREATE OR REPLACE FUNCTION sign_change(
  p_decided_by  text,
  p_op          text,
  p_payload     jsonb,
  p_src         text[],
  p_target_kind text,
  p_target_id   uuid,
  p_names       uuid[])
RETURNS TABLE (proposal_id uuid, target_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  proposal_id := public.propose_change(p_op, p_payload, p_src, p_target_kind, p_target_id,
                                       p_names);
  target_id := public.apply_proposal(proposal_id, p_decided_by);
  RETURN NEXT;
EXCEPTION WHEN integrity_constraint_violation THEN
  GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
  PERFORM public.raise_rule(v_rule, v_table, v_code);
  RAISE;
END $$;

-- A rejection writes the decision and leaves the row. A rejected act is never deleted: it is
-- the record of what was set aside. It carries NO REASON, and that is decided and not pending:
-- the record keeps the status, the hour and the name of a rejection, and nothing else.
CREATE OR REPLACE FUNCTION reject_proposal(p_id uuid, p_decided_by text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;
  -- An act of a linked batch is rejected only with the batch, as it is promoted only with it.
  PERFORM public.refuse_batch_act(p_id);
  UPDATE public.proposals
     SET status = 'rejected', decided_at = now(), decided_by = p_decided_by
   WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_id) THEN
      RAISE EXCEPTION 'the record holds no act %', p_id USING CONSTRAINT = 'proposal_exists';
    END IF;
    RAISE EXCEPTION 'the act % is decided already, and a decided act is frozen', p_id
      USING CONSTRAINT = 'proposal_pending';
  END IF;
END $$;

-- THE DECISION ON A LINKED BATCH, AS ONE UNIT. Only the operator role holds it, as it holds the
-- promotion of one act. A promotion writes each act that waits in the batch, an entity before the
-- relation that names it, or it writes none: the first refusal stops the whole transaction, and
-- the sentence names the act and the reason. A rejection rejects each act that waits in the batch.
CREATE OR REPLACE FUNCTION decide_batch(p_batch uuid, p_verdict text, p_decided_by text)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_left  uuid[];
  v_count int;
  p       public.proposals%ROWTYPE;
  v_said  text;
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  IF coalesce(p_verdict, '') NOT IN ('promote', 'reject') THEN
    RAISE EXCEPTION 'a decision on a batch is promote or reject' USING CONSTRAINT = 'batch_verdict';
  END IF;
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;

  -- The lock closes a second decision on the same batch while this one runs.
  PERFORM 1 FROM public.proposals
    WHERE batch_id = p_batch AND status = 'pending' ORDER BY id FOR UPDATE;
  SELECT array_agg(id ORDER BY id) INTO v_left FROM public.proposals
   WHERE batch_id = p_batch AND status = 'pending';
  v_count := coalesce(cardinality(v_left), 0);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'the record holds no batch % that waits', p_batch
      USING CONSTRAINT = 'batch_pending';
  END IF;

  IF p_verdict = 'reject' THEN
    UPDATE public.proposals
       SET status = 'rejected', decided_at = now(), decided_by = p_decided_by
     WHERE id = ANY (v_left);
    RETURN v_count;
  END IF;

  -- The same guard as the promotion of one act: no act is decided by the transaction that
  -- proposed it.
  IF EXISTS (SELECT 1 FROM public.proposals
              WHERE id = ANY (v_left) AND xact = pg_current_xact_id()) THEN
    RAISE EXCEPTION 'the batch % was written by this transaction, and an act is not decided by '
                    'the transaction that proposed it', p_batch
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'decided_later';
  END IF;

  WHILE cardinality(v_left) > 0 LOOP
    -- The next act names no act of the batch that still waits.
    SELECT * INTO p FROM public.proposals x
     WHERE x.id = ANY (v_left)
       AND NOT EXISTS (
             SELECT 1 FROM unnest(x.names || ARRAY[x.target_id,
                                                   (x.payload->>'src_id')::uuid,
                                                   (x.payload->>'dst_id')::uuid]) AS n(id)
              WHERE n.id = ANY (v_left) AND n.id <> x.id)
     ORDER BY x.id
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'nothing of the batch is promoted, because its acts name each other in a '
                      'circle' USING CONSTRAINT = 'batch_order';
    END IF;
    BEGIN
      PERFORM public.apply_proposal(p.id, p_decided_by);
    EXCEPTION WHEN raise_exception OR integrity_constraint_violation OR data_exception THEN
      GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT, v_rule = CONSTRAINT_NAME,
                              v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
      -- A rule of a table gets its own sentence, as it gets it for one act.
      BEGIN
        PERFORM public.raise_rule(v_rule, v_table, v_code);
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT;
      END;
      RAISE EXCEPTION 'nothing of the batch is promoted, because the record refuses its %: %',
        CASE p.op
          WHEN 'create_entity'   THEN 'new entity ' || (p.payload->>'label')
          WHEN 'create_relation' THEN 'new relation ' || (p.payload->>'type')
          ELSE 'act ' || p.id::text END,
        v_said
        USING ERRCODE = v_code, CONSTRAINT = coalesce(nullif(v_rule, ''), 'batch_item');
    END;
    v_left := array_remove(v_left, p.id);
  END LOOP;
  RETURN v_count;
END $$;


-- THE CLAIM. It is a door and not a table write, because no role holds UPDATE on any table, and
-- a worker that could write `jobs` directly could also write it into a state no claim produced.
--
-- SKIP LOCKED KEEPS TWO CLAIMS OFF ONE ROW. The row is locked for the length of the caller's
-- transaction, so a second claim walks past it instead of waiting behind it.
--
-- IT TAKES A WORK KIND AND NEVER A `store_only` ROW. The kind goes back to the caller, because
-- the runner that routes the row has to know which path it takes. A lead has no document, and its
-- text goes back with it: the worker reads the text of the lead that it holds and of no other.
--
-- IT TAKES NO NAME. The taker is stamped from session_user by a trigger, because a label the
-- caller supplies proves nothing about who holds the row. The earlier signatures are dropped
-- here: a re-runnable file that only replaces would leave them side by side.
DROP FUNCTION IF EXISTS claim_job(text);
DROP FUNCTION IF EXISTS claim_job();
CREATE OR REPLACE FUNCTION claim_job()
RETURNS TABLE (job_id uuid, job_document text, job_kind text, job_lead text, job_mapping uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT j.id INTO v_id
    FROM public.jobs j
   WHERE j.status = 'queued' AND j.kind IN ('extract_text','map_structured','load_mapped','research_lead')
   ORDER BY j.created_at, j.id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- An empty queue is not a failure. The caller gets no row and waits.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.jobs j
     SET status     = 'running',
         claimed_at = now(),
         updated_at = now()
   WHERE j.id = v_id
  RETURNING j.id, j.document_id, j.kind, j.lead, j.mapping
       INTO job_id, job_document, job_kind, job_lead, job_mapping;

  RETURN NEXT;
END $$;


-- THE WAY BACK AFTER A CRASH. A runner that stops in the middle of a job leaves its row `running`,
-- and the open-job index then refuses a new job of that kind for that document. The runner calls
-- this at its start, before its first claim, so the work continues.
--
-- ONLY THE ROWS OF THE CALLER GO BACK. One runner works for one operator, so at its start no job
-- of its role is in the hands of a live process.
CREATE OR REPLACE FUNCTION requeue_running_jobs()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_requeued int;
BEGIN
  UPDATE public.jobs j
     SET status     = 'queued',
         claimed_at = NULL,
         updated_at = now()
   WHERE j.status = 'running' AND j.claimed_by = session_user;

  GET DIAGNOSTICS v_requeued = ROW_COUNT;
  RETURN v_requeued;
END $$;

-- THE WAIT OF THE RUNNER ON AN EMPTY QUEUE, AS ONE STRICT READ. The number is a row, and a row
-- that is absent stops the runner loudly. The door returns this number and no other row of the
-- table. The earlier signature returned three numbers, so it is dropped first.
DROP FUNCTION IF EXISTS runner_settings();
CREATE OR REPLACE FUNCTION runner_settings()
RETURNS TABLE (empty_wait_seconds double precision)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  SELECT p.value::double precision INTO empty_wait_seconds
    FROM public.parameter p WHERE p.key = 'runner_empty_wait_seconds';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the parameter runner_empty_wait_seconds is absent, and no default stands';
  END IF;
  RETURN NEXT;
END $$;

-- THE END OF A JOB THAT FAILED. The runner calls it on the first failure, so the operator sees
-- the reason and can queue the document again.
--
-- ONLY A RUNNING ROW ENDS, and the reason is required: a `failed` row with no reason gives the
-- operator nothing to act on. No failure kind is written, because the three kinds name the fault
-- of one call to the model, and this is the end of the job.
CREATE OR REPLACE FUNCTION fail_job(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_reason IS NULL OR btrim(p_reason, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a failed job states why it failed';
  END IF;
  UPDATE public.jobs
     SET status = 'failed', failure_reason = p_reason, finished_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running, and only a running job fails', p_id;
  END IF;
END $$;


-- THE DOOR THAT ASKS FOR WORK. A stored document starts none, so this is the one way a work job
-- appears. It takes a work kind alone, because `store_only` is written by put_document and is
-- never queued. A document with no bytes has nothing to read, so it is refused. The unique index
-- of the table refuses a second open job of one kind for one document, and it answers for two
-- callers at one instant, which a check made here could not. The door words that refusal itself,
-- so no caller reads the name of the index.
CREATE OR REPLACE FUNCTION enqueue_job(p_document text, p_kind text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id    uuid;
  v_bytes text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('extract_text','map_structured') THEN
    RAISE EXCEPTION
      'a job asks for extract_text or map_structured, and this one asked for %',
      coalesce(p_kind, 'nothing')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT d.s3_key INTO v_bytes FROM public.documents d WHERE d.id = p_document::doc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document % does not exist', p_document
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_bytes IS NULL THEN
    RAISE EXCEPTION 'document % holds no bytes, so no work can read it', p_document
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  BEGIN
    INSERT INTO public.jobs (document_id, kind) VALUES (p_document::doc_id, p_kind)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'document % has a job of kind % that is queued or runs already',
      p_document, p_kind
      USING ERRCODE = 'invalid_parameter_value', CONSTRAINT = 'jobs_one_open_per_kind';
  END;
  RETURN v_id;
END $$;

-- THE DOOR THAT STARTS A LEAD. The operator and the research AI give a short text, and the worker
-- searches and stores the sources for it. The role that asked is kept from the connection, never
-- from a label of the caller. The worker role holds no grant on it, so the agent that runs a lead
-- starts no lead of its own.
CREATE OR REPLACE FUNCTION start_lead(p_lead text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_lead IS NULL OR btrim(p_lead, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a lead states what to search for'
      USING ERRCODE = 'invalid_parameter_value', CONSTRAINT = 'jobs_lead_text';
  END IF;
  INSERT INTO public.jobs (kind, lead, lead_by)
  VALUES ('research_lead', btrim(p_lead, E' \t\n\r\f\v'), session_user)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- THE RECORD OF WHAT A LEAD STORED. Only the worker that runs the lead calls it, and only while
-- the lead runs. A second record of one document is no fault, and it writes nothing.
CREATE OR REPLACE FUNCTION record_lead_document(p_job uuid, p_document text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.jobs j
   WHERE j.id = p_job AND j.kind = 'research_lead' AND j.status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not a running lead, and only a running lead stores a document', p_job
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.lead_document (job_id, document_id) VALUES (p_job, p_document::doc_id)
  ON CONFLICT DO NOTHING;
END $$;

-- THE LEADS, FOR THE OPERATOR. Each lead comes with its text, its state and the documents that it
-- stored, the newest lead first. The text is private, so only the operator role holds this read.
CREATE OR REPLACE FUNCTION lead_jobs()
RETURNS TABLE (job_id uuid, lead text, lead_by text, job_status text, job_reason text,
               created_at timestamptz, documents jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT j.id, j.lead, j.lead_by, j.status, j.failure_reason, j.created_at,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'url', d.uri)
                                    ORDER BY l.created_at, d.id)
                     FROM public.lead_document l
                     JOIN public.documents d ON d.id = l.document_id
                    WHERE l.job_id = j.id), '[]'::jsonb)
    FROM public.jobs j
   WHERE j.kind = 'research_lead'
   ORDER BY j.created_at DESC, j.id
$$;

-- THE NAME OF AN ELEMENT FOR THE REVIEW: the label of an entity, in the record or in a pending
-- act, and for a relation its source, the words of its type and its target. A relation names its
-- ends by their labels only, so a name never walks a chain of relations.
--
-- Departure: PL/pgSQL and not SQL. The page names about a thousand units, and a SQL function
-- that cannot be inlined is planned again at each call. Measured on 7 October 2026: 2.8 s for one
-- page of the v1 import, against 0.2 s with the plans that PL/pgSQL keeps.
CREATE OR REPLACE FUNCTION entity_label(p_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_label text;
BEGIN
  SELECT e.label INTO v_label FROM public.entities e WHERE e.id = p_id;
  IF v_label IS NULL THEN
    SELECT w.payload->>'label' INTO v_label FROM public.proposals w
     WHERE w.id = p_id AND w.status = 'pending' AND w.op = 'create_entity';
  END IF;
  RETURN v_label;
END $$;

CREATE OR REPLACE FUNCTION relation_name(p_src uuid, p_type text, p_dst uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_words text;
BEGIN
  SELECT t.label INTO v_words FROM public.relation_type t WHERE t.key = p_type;
  RETURN coalesce(public.entity_label(p_src), 'an element') || ' ' || coalesce(v_words, p_type)
         || ' ' || coalesce(public.entity_label(p_dst), 'an element');
END $$;

CREATE OR REPLACE FUNCTION element_name(p_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_name text := public.entity_label(p_id);
  v_src  uuid;
  v_type text;
  v_dst  uuid;
BEGIN
  IF v_name IS NOT NULL THEN RETURN v_name; END IF;
  SELECT r.src_id, r.type, r.dst_id INTO v_src, v_type, v_dst
    FROM public.relations r WHERE r.id = p_id;
  IF NOT FOUND THEN
    SELECT (w.payload->>'src_id')::uuid, w.payload->>'type', (w.payload->>'dst_id')::uuid
      INTO v_src, v_type, v_dst
      FROM public.proposals w
     WHERE w.id = p_id AND w.status = 'pending' AND w.op = 'create_relation';
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  RETURN public.relation_name(v_src, v_type, v_dst);
END $$;

-- THE CITED WORDS OF THE NAMED ACTS, each with the two lines before and after them. The offsets
-- of a citation count code points.
--
-- Departure: each cited page is cut into lines once, and each citation is placed by the start of
-- its line. A substr of a long page counts the code points from its start at each call. Measured
-- on 7 October 2026: the one page of the v1 import holds about 500,000 characters, and a substr
-- for each citation took 2.7 s for a page of 200 units.
CREATE OR REPLACE FUNCTION cited_passages(p_claims uuid[])
RETURNS TABLE (claim_id uuid, doc_id text, page int, before text, cited text, after text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_page  record;
  v_cite  record;
  v_lines text[];
  v_at    int[];
  v_first int;
  v_last  int;
  v_count int;
BEGIN
  FOR v_page IN SELECT DISTINCT c.doc_id, c.text_extractor, c.page FROM public.citation c
                 WHERE c.claim_id = ANY (p_claims) LOOP
    SELECT string_to_array(t.text, E'\n') INTO v_lines FROM public.document_text t
     WHERE t.document_id = v_page.doc_id AND t.extractor = v_page.text_extractor
       AND t.page = v_page.page;
    CONTINUE WHEN v_lines IS NULL;
    v_count := cardinality(v_lines);
    -- v_at[i] is the offset of the first code point of line i; one more entry closes the page.
    v_at := ARRAY[0];
    FOR i IN 1 .. v_count LOOP
      v_at := v_at || (v_at[i] + char_length(v_lines[i]) + 1);
    END LOOP;
    v_first := 1;
    FOR v_cite IN SELECT c.claim_id, c.start, c."end" FROM public.citation c
                   WHERE c.claim_id = ANY (p_claims) AND c.doc_id = v_page.doc_id
                     AND c.text_extractor = v_page.text_extractor AND c.page = v_page.page
                   ORDER BY c.start, c.claim_id LOOP
      WHILE v_first < v_count AND v_at[v_first + 1] <= v_cite.start LOOP
        v_first := v_first + 1;
      END LOOP;
      v_last := v_first;
      WHILE v_last < v_count AND v_at[v_last + 1] < v_cite."end" LOOP
        v_last := v_last + 1;
      END LOOP;
      claim_id := v_cite.claim_id;
      doc_id := v_page.doc_id;
      page := v_page.page;
      before := array_to_string(
        v_lines[greatest(1, v_first - 2):v_first - 1]
          || substr(v_lines[v_first], 1, v_cite.start - v_at[v_first]), E'\n');
      cited := CASE WHEN v_first = v_last
                    THEN substr(v_lines[v_first], v_cite.start - v_at[v_first] + 1,
                                v_cite."end" - v_cite.start)
                    ELSE array_to_string(
                           substr(v_lines[v_first], v_cite.start - v_at[v_first] + 1)
                           || v_lines[v_first + 1:v_last - 1]
                           || substr(v_lines[v_last], 1, v_cite."end" - v_at[v_last]), E'\n')
               END;
      after := array_to_string(
        substr(v_lines[v_last], v_cite."end" - v_at[v_last] + 1)
          || v_lines[v_last + 1:v_last + 2], E'\n');
      RETURN NEXT;
    END LOOP;
  END LOOP;
END $$;

-- ONE PAGE OF THE REVIEW QUEUE, FOR THE OPERATOR. Each unit comes with its acts, the ends of each
-- act, the proposer, the group, the documents and the cited passages with two lines of context.
-- The passages and the reason of a dispute are private, so only the operator role holds this
-- read. The page starts after the sort key of the last unit of the page before, so a long queue
-- is never read whole. Only the units of the page read their acts, their ends and their passages.
--
-- THE GROUP IS NAMED BY ITS SUBJECT: the entity of the group that is the source of no relation to
-- another entity of the group. The sort key is the group, the name of the unit, then its
-- identifier, so two units never share a key.
DROP FUNCTION IF EXISTS review_units(text[], int);
CREATE OR REPLACE FUNCTION review_units(p_after text[], p_size int)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  WITH size AS (
    SELECT greatest(1, least(coalesce(p_size, 50), 200)) AS n
  ), heads AS (
    -- The head act of each unit: the entity of an entity unit, or the one act of any other unit.
    SELECT DISTINCT ON (p.unit_id) p.unit_id, p.op, p.payload, p.proposer, p.batch_id,
           p.target_id
      FROM public.proposals p
     WHERE p.status = 'pending'
     ORDER BY p.unit_id, (p.id <> p.unit_id), p.created_at, p.id
  ), subjects AS (
    SELECT DISTINCT ON (g.batch_id) g.batch_id, g.payload->>'label' AS subject
      FROM public.proposals g
     WHERE g.op = 'create_entity' AND g.batch_id IN (SELECT batch_id FROM heads)
       AND NOT EXISTS (
             SELECT 1 FROM public.proposals r
               JOIN public.proposals d ON d.id = (r.payload->>'dst_id')::uuid
              WHERE r.op = 'create_relation' AND r.batch_id = g.batch_id
                AND (r.payload->>'src_id')::uuid = g.id
                AND d.op = 'create_entity' AND d.batch_id = g.batch_id)
     ORDER BY g.batch_id, g.created_at, g.id
  ), keyed AS (
    SELECT u.*,
           ARRAY[CASE WHEN u.batch_id IS NULL THEN '1' ELSE '0' END,
                 lower(coalesce(u.subject, '')), coalesce(u.batch_id::text, ''),
                 lower(u.name), u.unit_id::text] AS sort_key
      FROM (SELECT h.unit_id, h.op, h.proposer, h.batch_id, h.payload, s.subject,
                   coalesce(public.element_name(
                              CASE WHEN h.op IN ('create_entity', 'create_relation')
                                   THEN h.unit_id ELSE h.target_id END), '') AS name
              FROM heads h
              LEFT JOIN subjects s ON s.batch_id = h.batch_id) AS u
  ), page AS (
    SELECT k.*, row_number() OVER (ORDER BY k.sort_key) AS no
      FROM (SELECT * FROM keyed
             WHERE p_after IS NULL OR sort_key > p_after
             ORDER BY sort_key
             LIMIT (SELECT n FROM size) + 1) AS k
  ), shown AS (
    SELECT * FROM page WHERE no <= (SELECT n FROM size)
  ), acts AS (
    SELECT a.*
      FROM shown s
      JOIN public.proposals a ON a.unit_id = s.unit_id AND a.status = 'pending'
  ), ends AS (
    SELECT x.id,
           jsonb_build_object(
             'name', public.element_name(x.id),
             'state', CASE
                        WHEN EXISTS (SELECT 1 FROM public.proposals w
                                      WHERE w.id = x.id AND w.status = 'pending') THEN 'pending'
                        WHEN EXISTS (SELECT 1 FROM public.entities e WHERE e.id = x.id)
                          OR EXISTS (SELECT 1 FROM public.relations r WHERE r.id = x.id)
                          THEN 'record'
                        ELSE 'missing' END,
             'group', (SELECT w.batch_id FROM public.proposals w
                        WHERE w.id = x.id AND w.status = 'pending')) AS said
      FROM (SELECT DISTINCT e.ref AS id
              FROM acts a,
                   LATERAL (VALUES ((a.payload->>'src_id')::uuid), ((a.payload->>'dst_id')::uuid),
                                   (a.target_id)) AS e(ref)
             WHERE e.ref IS NOT NULL) AS x
  ), acted AS (
    SELECT a.unit_id,
           jsonb_agg(jsonb_build_object(
             'id', a.id, 'op', a.op, 'payload', a.payload, 'targetId', a.target_id,
             'createdAt', a.created_at, 'dissent', a.dissent, 'dissentReason', a.dissent_reason,
             'target', et.said, 'src', es.said, 'dst', ed.said)
             ORDER BY (a.op <> 'create_entity'), a.created_at, a.id) AS acts
      FROM acts a
      LEFT JOIN ends et ON et.id = a.target_id
      LEFT JOIN ends es ON es.id = (a.payload->>'src_id')::uuid
      LEFT JOIN ends ed ON ed.id = (a.payload->>'dst_id')::uuid
     GROUP BY a.unit_id
  ), cited AS (
    SELECT c.unit_id,
           jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'uri', d.uri,
                                        'mime', d.mime) ORDER BY d.id) AS documents
      FROM (SELECT DISTINCT a.unit_id, s.doc FROM acts a, unnest(a.src) AS s(doc)) AS c
      JOIN public.documents d ON d.id = c.doc
     GROUP BY c.unit_id
  ), quoted AS (
    SELECT a.unit_id,
           jsonb_agg(jsonb_build_object(
             'act', q.claim_id, 'document', q.doc_id, 'page', q.page, 'before', q.before,
             'text', q.cited, 'after', q.after)
             ORDER BY q.claim_id, q.doc_id, q.page) AS passages
      FROM public.cited_passages(ARRAY(SELECT id FROM acts)) AS q
      JOIN acts a ON a.id = q.claim_id
     GROUP BY a.unit_id
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM heads),
    'next', (SELECT p.sort_key FROM page p
              WHERE p.no = (SELECT n FROM size)
                AND EXISTS (SELECT 1 FROM page q WHERE q.no > (SELECT n FROM size))),
    'units', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'unit', s.unit_id,
               'kind', CASE
                         WHEN s.op = 'create_entity' THEN 'entity'
                         WHEN s.op = 'create_relation' AND s.batch_id IS NOT NULL THEN 'link'
                         WHEN s.op = 'create_relation' THEN 'relation'
                         ELSE 'change' END,
               'name', s.name,
               'type', CASE WHEN s.op IN ('create_entity', 'create_relation')
                            THEN s.payload->>'type' END,
               'proposer', s.proposer,
               'group', CASE WHEN s.batch_id IS NULL THEN NULL
                             ELSE jsonb_build_object('id', s.batch_id, 'subject', s.subject) END,
               'acts', coalesce(ac.acts, '[]'::jsonb),
               'documents', coalesce(ci.documents, '[]'::jsonb),
               'passages', coalesce(qu.passages, '[]'::jsonb))
             ORDER BY s.sort_key)
        FROM shown s
        LEFT JOIN acted ac ON ac.unit_id = s.unit_id
        LEFT JOIN cited ci ON ci.unit_id = s.unit_id
        LEFT JOIN quoted qu ON qu.unit_id = s.unit_id), '[]'::jsonb))
$$;

-- THE WORDS OF THE PARTS THAT A JOB COULD NOT PROPOSE. The status of a done job and the reason of
-- a failed one read the same words, so they are made here alone.
CREATE OR REPLACE FUNCTION refused_parts_said(p_parts int, p_refusal text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN p_parts > 0
              THEN p_parts || CASE WHEN p_parts = 1 THEN ' part' ELSE ' parts' END
                   || ' refused: ' || p_refusal END
$$;

-- THE HOST OF AN ADDRESS, in lower case and with no `www.`. A file with no address has none.
CREATE OR REPLACE FUNCTION uri_host(p_uri text) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT lower(regexp_replace(
           substring(p_uri FROM '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^/?#@]*@)?([^/?#:]+)'),
           '^www\.', ''))
$$;

-- THE REUSE OF A MAPPING. A new file from the same host with the same header is loaded under the
-- mapping that the operator already promoted, and no model reads it. The door finds the newest
-- accepted mapping of the same host and the same header, and queues the load. It returns no
-- identifier when there is none, and the caller asks the model. A file with no address has no
-- host, so it always gets a mapping of its own. The caller runs the map_structured job of the
-- document. The loader reads the header of the file again and stops on a header that differs, so
-- a caller that states a false header loads nothing. A load that is open already for the document
-- is returned, so a job that runs again queues no second one.
CREATE OR REPLACE FUNCTION enqueue_mapped_load(p_document text, p_header_sig text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_host    text;
  v_mapping uuid;
  v_id      uuid;
BEGIN
  IF coalesce(p_header_sig, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'the header signature is 64 hexadecimal characters, the digest of the header'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs j
                  WHERE j.document_id = p_document::doc_id AND j.kind = 'map_structured'
                    AND j.status = 'running' AND j.claimed_by = session_user) THEN
    RAISE EXCEPTION 'this role holds no running map_structured job of document %', p_document
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT public.uri_host(d.uri) INTO v_host
    FROM public.documents d WHERE d.id = p_document::doc_id;

  SELECT j.id INTO v_id FROM public.jobs j
   WHERE j.document_id = p_document::doc_id AND j.kind = 'load_mapped'
     AND j.status IN ('queued','running');
  IF FOUND THEN
    RETURN v_id;
  END IF;

  SELECT p.id INTO v_mapping
    FROM public.proposals p
    JOIN public.documents d ON d.id = p.src[1]
   WHERE p.op = 'map_document' AND p.status = 'accepted'
     AND p.payload->>'header_sig' = p_header_sig
     AND v_host IS NOT NULL AND public.uri_host(d.uri) = v_host
   ORDER BY p.decided_at DESC, p.id
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.jobs (document_id, kind, mapping)
    VALUES (p_document::doc_id, 'load_mapped', v_mapping)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Another caller queued the load between the read and the insert.
    SELECT j.id INTO v_id FROM public.jobs j
     WHERE j.document_id = p_document::doc_id AND j.kind = 'load_mapped'
       AND j.status IN ('queued','running');
  END;
  RETURN v_id;
END $$;

-- THE REPORT OF A LOAD. Each load stores the rows it excluded, with the reason of each, as one
-- `report` document. The worker holds no other door that writes a report, and this one is as
-- narrow as the act: the caller holds a running load, the key is raw/ and the hash of the bytes,
-- and the day is today. The door cannot read the store, so the caller writes the bytes first. The
-- bytes name the load, so two loads never share a report, and the same bytes return the report
-- that holds them, so a load that runs again stores one report. Bytes that another kind of
-- document holds are refused.
CREATE OR REPLACE FUNCTION put_load_report(p_job uuid, p_title text, p_s3_key text,
                                           p_sha256 text, p_mime text)
RETURNS doc_id
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_kind     text;
  v_known    text;
  v_doc_kind text;
BEGIN
  SELECT j.kind INTO v_kind
    FROM public.jobs j
   WHERE j.id = p_job AND j.status = 'running' AND j.claimed_by = session_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running under this role, so it stores no report', p_job
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_kind <> 'load_mapped' THEN
    RAISE EXCEPTION 'a load report belongs to a job of load_mapped, and this job is %', v_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_s3_key IS DISTINCT FROM 'raw/' || p_sha256 THEN
    RAISE EXCEPTION 'the key of a load report is raw/ and the hash of its bytes'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT d.id, d.kind INTO v_known, v_doc_kind FROM public.documents d WHERE d.sha256 = p_sha256;
  IF FOUND AND v_doc_kind = 'report' THEN
    RETURN v_known;
  END IF;
  IF FOUND THEN
    RAISE EXCEPTION 'the bytes with the hash % are document % of kind %, and not a report',
      p_sha256, v_known, v_doc_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN public.put_document('doc_' || left(p_sha256, 12), 'report', p_title, p_s3_key, NULL,
                             NULL, p_sha256, p_mime, current_date);
END $$;

-- THE STATUS OF THE WORK ON ONE DOCUMENT, FOR THE OPERATOR. A job names its proposals only
-- through the model calls it recorded, and the operator role holds no read of those calls. So
-- this door counts them, and returns the count and no row of a call. The `store_only` row of
-- the ingestion is no work, so it is left out. The newest job comes first.
DROP FUNCTION IF EXISTS document_jobs(text);
CREATE OR REPLACE FUNCTION document_jobs(p_document text)
RETURNS TABLE (job_id uuid, job_kind text, job_status text, job_reason text, job_refused text,
               proposal_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT j.id, j.kind, j.status, j.failure_reason,
         public.refused_parts_said(j.refused_parts, j.refusal),
         (SELECT count(*) FROM public.model_call m
            JOIN public.proposals p ON p.model_call_id = m.id
           WHERE m.job_id = j.id)
    FROM public.jobs j
   WHERE j.document_id = p_document AND j.kind <> 'store_only'
   ORDER BY j.created_at DESC, j.id
$$;

-- THE TEXT OF A DOCUMENT, WRITTEN ONCE. p_pages is a jsonb array of strings, and the door sets
-- the page number from the place of each string, counting from 1, so the caller cannot leave a
-- gap or repeat a number. An empty string is a valid page. A document with no bytes has nothing
-- that a text could come from, so it is refused.
--
-- THE PRIMARY KEY IS THE GUARD FOR A SECOND SET. A second set for the same document and
-- extractor version collides on page 1 at the insert, and the caller receives the unique
-- violation of the key. The door checks nothing else about the arguments: the CHECK of the
-- table refuses a blank extractor, and the foreign key refuses an unknown document.
CREATE OR REPLACE FUNCTION put_document_text(p_document text, p_pages jsonb, p_extractor text)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_bytes text;
  v_count int;
BEGIN
  SELECT d.s3_key INTO v_bytes FROM public.documents d WHERE d.id = p_document::doc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document % does not exist', p_document
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_bytes IS NULL THEN
    RAISE EXCEPTION 'document % holds no bytes, so no text can be read from it', p_document
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.document_text (document_id, extractor, page, text)
  SELECT p_document::doc_id, p_extractor, e.n::int, e.t
    FROM jsonb_array_elements_text(p_pages) WITH ORDINALITY AS e(t, n);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- THE NEWEST TEXT OF A DOCUMENT. A document can hold more than one set of text, one for each
-- extractor version, and an older set is a reading that a newer one replaced. Each reader of the
-- text and the propose tool choose the set here, so they choose the same one. The caller reads the
-- text with its own grant, so this is no door.
CREATE OR REPLACE FUNCTION newest_text_extractor(p_document text)
RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT t.extractor FROM public.document_text t
   WHERE t.document_id = p_document
   ORDER BY t.created_at DESC, t.extractor DESC
   LIMIT 1
$$;

-- THE DOOR OF A MACHINE THAT FETCHED A SOURCE. put_document takes any kind and does not demand the
-- bytes, so it is the operator's. This door is as narrow as the act it serves: an address that was
-- read (`url` or `api`), the bytes that came back, the hash of those bytes and the day they came.
-- A `file`, a `report` and a `manual` row stay with the operator.
--
-- THE HASH DECIDES THE IDENTITY, and the id is made from it: the same twelve characters that the
-- worker takes for a file, so the two paths name one document alike. A second row for a hash is
-- refused by name here, and the unique index answers for two callers at one instant. The store
-- row is written by put_document, so the one rule of "a stored document starts no work" stays in
-- one place.
--
-- THE PROVIDER IS THE LAST PARAMETER, OPTIONAL, and it goes to put_document unchanged. The earlier
-- signature is dropped for the reason that put_document gives.
DROP FUNCTION IF EXISTS put_fetched_document(text,text,text,text,text,text,date,text);
CREATE OR REPLACE FUNCTION put_fetched_document(
  p_kind          text,
  p_title         text,
  p_s3_key        text,
  p_uri           text,
  p_sha256        text,
  p_mime          text,
  p_retrieved_at  date,
  p_archive_uri   text DEFAULT NULL,
  p_provider_id   text DEFAULT NULL)
RETURNS doc_id
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_blank text := E' \t\n\r\f\v';
  v_known text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('url','api') THEN
    RAISE EXCEPTION 'a fetched document is a url or an api, and this one is %',
      coalesce(p_kind, 'nothing')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_title IS NULL OR btrim(p_title, v_blank) = '' THEN
    RAISE EXCEPTION 'a fetched document has a title' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_s3_key IS NULL OR btrim(p_s3_key, v_blank) = '' THEN
    RAISE EXCEPTION 'a fetched document has its bytes in the store, and no object key was given'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_uri IS NULL OR btrim(p_uri, v_blank) = '' THEN
    RAISE EXCEPTION 'a fetched document has the address it came from'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_sha256 IS NULL OR btrim(p_sha256, v_blank) = '' THEN
    RAISE EXCEPTION 'a fetched document has the hash of its bytes'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_retrieved_at IS NULL THEN
    RAISE EXCEPTION 'a fetched document has the day it was retrieved'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT d.id INTO v_known FROM public.documents d WHERE d.sha256 = p_sha256;
  IF FOUND THEN
    RAISE EXCEPTION 'the bytes with the hash % are already document %', p_sha256, v_known
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN public.put_document('doc_' || left(p_sha256, 12), p_kind, p_title, p_s3_key, p_uri,
                             p_archive_uri, p_sha256, p_mime, p_retrieved_at, p_provider_id);
END $$;

-- THE END OF A JOB THAT RAN TO ITS END. Only a running row ends, so a row that nobody claimed
-- cannot be marked done by hand.
--
-- A JOB THAT READS IN PARTS GIVES ITS COUNT OF PARTS, the count that the propose door refused,
-- and the first refusal. The job keeps the count and the reason, so no lost claim is silent. A job
-- whose every part was refused proposed nothing, so it fails with the same words as its reason.
-- The door returns the status that it wrote. The earlier signature is dropped first.
DROP FUNCTION IF EXISTS complete_job(uuid);
CREATE OR REPLACE FUNCTION complete_job(p_id uuid, p_parts int DEFAULT 0, p_refused int DEFAULT 0,
                                        p_refusal text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_status text;
BEGIN
  IF p_refused < 0 OR p_refused > p_parts THEN
    RAISE EXCEPTION 'a job refuses from none to all of its % parts, and not %', p_parts, p_refused
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_status := CASE WHEN p_refused > 0 AND p_refused = p_parts THEN 'failed' ELSE 'done' END;
  UPDATE public.jobs
     SET status = v_status,
         refused_parts = p_refused,
         refusal = p_refusal,
         failure_reason = CASE WHEN v_status = 'failed'
                               THEN public.refused_parts_said(p_refused, p_refusal) END,
         finished_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running, and only a running job completes', p_id;
  END IF;
  RETURN v_status;
END $$;


-- THE LAYOUT DOOR. A position is derived and no role writes the table it lands in, so the whole
-- set arrives here, as an array of {"id","x","y"}, and this function writes it as gabriel_owner.
--
-- ONE RUN REPLACES THE RUN BEFORE IT. A position has a meaning only beside the positions of the
-- same run: two runs mixed in one table give a picture that is correct in no frame. So the set
-- is emptied and refilled in one transaction, and an entity the run left out loses its position.
--
-- AN UNKNOWN IDENTIFIER STOPS THE WHOLE RUN, by the foreign key. A run reads the entities and
-- places them, so an identifier that no entity carries says the run and the record disagree.
CREATE OR REPLACE FUNCTION set_entity_layout(p_layout jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  -- Departure: a missing set is a caller fault and never a run. '[]' is the run that places none.
  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'array' THEN
    RAISE EXCEPTION 'a layout run sends an array of positions, and this one sent %',
      coalesce(jsonb_typeof(p_layout), 'nothing')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.entity_layout;

  INSERT INTO public.entity_layout (entity_id, x, y)
  SELECT p.id, p.x, p.y
    FROM jsonb_to_recordset(p_layout) AS p(id uuid, x double precision, y double precision);
END $$;


-- ================================================================================= THE TIER ==
-- THE TIER OF A DOCUMENT IS READ FROM THE LICENCE OF ITS PROVIDER, AND IT IS NEVER STORED. One
-- edit of a provider row moves every document of that provider, and no document row changes.
--
-- AN ALLOW-LIST, SO THE RULE FAILS CLOSED. Only the licences named below give 'cc-by'. A document
-- with no provider, an id that names no document, any other licence, and a word that a later
-- migration adds to the closed list give 'internal'. A paid filing is internal until a legal
-- read of its terms. The function never returns NULL.
--
-- THE RESERVED ROW `inherited` IS ALWAYS INTERNAL. It says that nothing here supports the value,
-- so no provider can make it public.
--
-- SECURITY DEFINER, AND THE REASON WAS MEASURED. PostgreSQL checks EXECUTE on a function that a
-- view calls against the user of the view and not against its owner. A plain SQL function is
-- inlined into the view, and its body then needs USAGE on public, which the read role does not
-- hold. A SECURITY DEFINER function is never inlined, so the reader of an export needs EXECUTE
-- on this function and nothing more.
CREATE OR REPLACE FUNCTION document_tier(p_document text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN EXISTS (
           SELECT 1
             FROM public.documents d
             JOIN public.document_provider p ON p.id = d.provider_id
            WHERE d.id = p_document
              AND d.id <> 'inherited'
              AND p.licence IN ('public-domain', 'eu-reuse', 'ogl-v3', 'cc0', 'cc-by-4.0',
                                'copernicus', 'own'))
         THEN 'cc-by' ELSE 'internal' END
$$;


-- ============================================================================== THE TRAVERSAL =
-- T4 and docs/spec.md: complex read logic lives in a SQL function and never in the client.
-- The join requires an entity at BOTH ends. Without that, the walk returns the identifier of an
-- M4 relation in a column named entity_id, and the surface draws a phantom node.
--
-- The walk reads api.relation and NOT public.relations. This function has invoker rights, and
-- gabriel_read holds nothing on public, not even USAGE. Reading the base table raised
-- `permission denied for schema public` for the only role that is granted EXECUTE. The view
-- runs with the rights of gabriel_owner, so it answers where the base table cannot, and this
-- function needs no SECURITY DEFINER to do it.
CREATE OR REPLACE FUNCTION api.neighbourhood(root uuid, depth int DEFAULT 2)
RETURNS TABLE (entity_id uuid, hop int)
LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  WITH RECURSIVE walk(entity_id, hop) AS (
    SELECT root, 0
    UNION
    SELECT CASE WHEN r.src_id = w.entity_id THEN r.dst_id ELSE r.src_id END, w.hop + 1
      FROM walk w
      JOIN api.relation r
        ON r.src_kind = 'entity' AND r.dst_kind = 'entity'
       AND (r.src_id = w.entity_id OR r.dst_id = w.entity_id)
     WHERE w.hop < depth
  )
  SELECT entity_id, min(hop) FROM walk GROUP BY entity_id;
$$;

RESET ROLE;
