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
-- A NEW ENTITY ALSO KEEPS ITS PASSAGES IN THE DIGEST. A label does not identify a unit: one page
-- can name two battalions "3rd Motorized Rifle Battalion", each under a different brigade. Two
-- creations with one type and one label, that cite different passages, are two acts. A retry
-- cites the same passages, so it still returns the act that waits. The passages are the cited
-- spans, which code calculated from the excerpts. A relation and new attributes have no
-- passages in the digest: their target and their payload identify the fact.
--
-- An act that waited before this digest keeps the digest it was written with, because a pending
-- act is frozen. A retry of such an act writes it once more.
DROP FUNCTION IF EXISTS act_digest_of(text,text,uuid,jsonb,text[]);
DROP FUNCTION IF EXISTS act_digest_of(text,text,uuid,jsonb,text[],text);
DROP FUNCTION IF EXISTS act_digest_of(text,text,uuid,jsonb,text[],text,text);
CREATE OR REPLACE FUNCTION act_digest_of(
  p_op text, p_target_kind text, p_target_id uuid, p_payload jsonb, p_src text[],
  p_author_role text, p_passages jsonb DEFAULT NULL)
RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  -- With no passages, the digest is the digest of an act that waits already.
  SELECT md5(CASE WHEN p_passages IS NULL
                  THEN jsonb_build_array(p_op, p_target_kind, p_target_id, p_payload, p_src,
                                         p_author_role)
                  ELSE jsonb_build_array(p_op, p_target_kind, p_target_id, p_payload, p_src,
                                         p_author_role, p_passages) END::text)
$$;

-- THE PASSAGES OF A NEW ENTITY, in one order. Each citation of the item gives its document, its
-- text, its page, and its span or its transcription. Another item gives no passages.
CREATE OR REPLACE FUNCTION act_passages_of(p_op text, p_citations jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN p_op = 'create_entity' THEN
    (SELECT coalesce(jsonb_agg(DISTINCT x.passage ORDER BY x.passage), '[]'::jsonb)
       FROM (SELECT jsonb_build_object(
                      'document', c->>'document', 'text_extractor', c->>'text_extractor',
                      'page', (c->>'page')::int, 'start', (c->>'start')::int,
                      'end', (c->>'end')::int, 'transcription', c->>'transcription') AS passage
               FROM jsonb_array_elements(
                      CASE WHEN jsonb_typeof(p_citations) = 'array' THEN p_citations
                           ELSE '[]'::jsonb END) AS c) AS x)
  END
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
  -- never joined to an act of a machine. The passages of a new entity come from propose_batch,
  -- which sets them for each item before its insert. No role inserts a proposal by hand, so only
  -- a door sets them.
  NEW.act_digest := CASE WHEN NEW.author_role = 'gabriel_app' THEN NULL
    ELSE act_digest_of(NEW.op, NEW.target_kind, NEW.target_id, NEW.payload, NEW.src::text[],
                       NEW.author_role,
                       CASE WHEN NEW.op = 'create_entity'
                            THEN nullif(current_setting('gabriel.act_passages', true), '')::jsonb
                       END) END;
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
  -- The door checks the shape of the payload after this stamp, so an end that is no identifier
  -- names no act here, and the door words its own refusal.
  v_src := CASE WHEN pg_input_is_valid(NEW.payload->>'src_id', 'uuid')
                THEN (NEW.payload->>'src_id')::uuid END;
  v_dst := CASE WHEN pg_input_is_valid(NEW.payload->>'dst_id', 'uuid')
                THEN (NEW.payload->>'dst_id')::uuid END;
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

-- THE CLAIM OF THE ACT, with no identity that a run mints: it finds a claim that the operator
-- rejected before. An end that waits gives the key of its act, so the stamp reads it at the
-- insert, and the key is frozen with the act.
CREATE OR REPLACE FUNCTION stamp_claim_key() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.claim_key := claim_key_of(NEW.op, NEW.target_kind, NEW.target_id, NEW.payload);
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
  -- A rejection keeps why. The door words the refusal; this is the guard of every other path.
  IF NEW.status = 'rejected' AND NEW.reject_reason IS NULL THEN
    RAISE EXCEPTION 'a rejection names one reason' USING CONSTRAINT = 'rejection_reason';
  END IF;
  IF NEW.status <> 'rejected' AND (NEW.reject_reason, NEW.reject_note) IS DISTINCT FROM
     (OLD.reject_reason, OLD.reject_note) THEN
    RAISE EXCEPTION 'only a rejection writes a reason and a note';
  END IF;
  -- A decision that names no rule is a decision of the operator.
  IF NEW.decision_origin IS NULL THEN
    NEW.decision_origin := 'validated manually by the operator';
  END IF;
  -- Everything except the decision and its snapshot is frozen.
  IF (NEW.id, NEW.op, NEW.target_kind, NEW.target_id, NEW.payload, NEW.src, NEW.names,
      NEW.dissent, NEW.dissent_reason, NEW.author_role, NEW.xact, NEW.created_at,
      NEW.model_call_id, NEW.act_digest, NEW.originator, NEW.batch_id, NEW.unit_id,
      NEW.claim_key)
     IS DISTINCT FROM
     (OLD.id, OLD.op, OLD.target_kind, OLD.target_id, OLD.payload, OLD.src, OLD.names,
      OLD.dissent, OLD.dissent_reason, OLD.author_role, OLD.xact, OLD.created_at,
      OLD.model_call_id, OLD.act_digest, OLD.originator, OLD.batch_id, OLD.unit_id,
      OLD.claim_key) THEN
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
-- A new entity keeps its passages in the digest, so a creation with the same type and the same
-- label that cites another passage is a new act, and not a second passage of the first.
--
-- THE RULES OF THE DATA ARE HERE. A machine proposes a new entity, a new relation or new
-- attributes. A machine act cites at least one page. The page exists in the text of the document,
-- the span lies in that page, and the document is a source of the act. A citation of a PNG or JPEG
-- document can give a transcription in place of a span: the words that the AI read from the image.
-- Its act is disputed, so the operator compares the words with the image. Each refusal names the
-- item. The tool finds the excerpt, and it checks that each end and each target exists, so that a
-- model gets its fault before the write; the promotion holds those two rules too.
--
-- THE ITEMS THAT NAME EACH OTHER ARE ONE BATCH: a group, which is a label and a filter. The
-- operator decides one unit of it (P11). An item that names no other item, and that no other item
-- names, stays a single act: a faulty claim never blocks a good claim of the same page. A retry joins the batch of the act that waits.
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
  v_written  uuid[] := '{}';
  v_passages jsonb;
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
      -- A TRANSCRIPTION IS WORDS THAT THE AI READ FROM AN IMAGE, which the OCR text does not hold.
      -- Only a PNG or JPEG document has one, and only an act that the operator sees as disputed.
      IF coalesce(jsonb_typeof(v_cite->'transcription'), 'null') <> 'null' THEN
        IF coalesce(jsonb_typeof(v_cite->'start'), 'null') <> 'null'
           OR coalesce(jsonb_typeof(v_cite->'end'), 'null') <> 'null' THEN
          RAISE EXCEPTION 'item %: a citation of page % of % gives a span or a transcription, '
                          'and never both', v_no, v_cite->>'page', v_cite->>'document'
            USING ERRCODE = 'invalid_parameter_value';
        END IF;
        IF jsonb_typeof(v_cite->'transcription') <> 'string'
           OR btrim(v_cite->>'transcription', E' \t\n\r\f\v') = ''
           OR char_length(v_cite->>'transcription') > 600 THEN
          RAISE EXCEPTION 'item %: a transcription of page % of % is a text of 1 to 600 '
                          'characters', v_no, v_cite->>'page', v_cite->>'document'
            USING ERRCODE = 'invalid_parameter_value';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.documents d
                        WHERE d.id = v_cite->>'document'
                          AND lower(split_part(d.mime, ';', 1)) IN ('image/png', 'image/jpeg')) THEN
          RAISE EXCEPTION 'item %: document % is no PNG or JPEG image, so its citation gives the '
                          'span of an excerpt of its text', v_no, v_cite->>'document'
            USING ERRCODE = 'invalid_parameter_value';
        END IF;
        IF NOT coalesce((v_item->>'dissent')::boolean, false) THEN
          RAISE EXCEPTION 'item %: an act that cites words read from an image is disputed, so '
                          'the operator compares them with the image', v_no
            USING ERRCODE = 'invalid_parameter_value';
        END IF;
        IF v_item->>'model_call_id' IS NOT NULL THEN
          RAISE EXCEPTION 'item %: an agent cites the stored text, and never words read from an '
                          'image', v_no
            USING ERRCODE = 'invalid_parameter_value';
        END IF;
        CONTINUE;
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
    -- The stamp trigger reads the passages of a new entity into its digest.
    v_passages := public.act_passages_of(v_item->>'op', v_item->'citations');
    PERFORM set_config('gabriel.act_passages', coalesce(v_passages::text, ''), true);
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
      -- unit that the operator decides at the same time.
      SELECT p.id, p.batch_id INTO v_id, v_held FROM public.proposals p
       WHERE p.status = 'pending'
         AND p.act_digest = act_digest_of(v_item->>'op', v_item->>'target_kind', v_target,
                                          v_payload::jsonb, v_src, session_user::text,
                                          v_passages)
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

    -- An act that waits already and is not disputed takes no words read from an image.
    IF NOT written
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_item->'citations') AS c
                    WHERE c->>'transcription' IS NOT NULL)
       AND NOT (SELECT p.dissent FROM public.proposals p WHERE p.id = v_id) THEN
      RAISE EXCEPTION 'item %: the act that this item repeats waits with no dispute, so it takes '
                      'no words read from an image', v_no
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    INSERT INTO public.citation
      (claim_id, doc_id, text_extractor, page, start, "end", transcription, modality)
    SELECT DISTINCT v_id, c->>'document', c->>'text_extractor', (c->>'page')::int,
           (c->>'start')::int, (c->>'end')::int, c->>'transcription', v_item->>'modality'
      FROM jsonb_array_elements(v_item->'citations') AS c
     WHERE NOT EXISTS (
             SELECT 1 FROM public.citation h
              WHERE h.claim_id = v_id AND h.doc_id = c->>'document'
                AND h.text_extractor = c->>'text_extractor' AND h.page = (c->>'page')::int
                AND h.start IS NOT DISTINCT FROM (c->>'start')::int
                AND h."end" IS NOT DISTINCT FROM (c->>'end')::int
                AND h.transcription IS NOT DISTINCT FROM c->>'transcription'
                AND h.modality = v_item->>'modality');

    v_written := v_written || v_id;
    item := v_no; proposal_id := v_id;
    RETURN NEXT;
  END LOOP;
  PERFORM set_config('gabriel.act_passages', '', true);

  -- The rules run on each unit of the batch, and on each unit that shares a claim with it: a new
  -- act can add a source to a fact of a unit that waits.
  PERFORM public.run_rules(ARRAY(
    SELECT DISTINCT q.unit_id FROM public.proposals q
     WHERE q.status = 'pending'
       AND (q.unit_id IN (SELECT w.unit_id FROM public.proposals w WHERE w.id = ANY (v_written))
            OR q.claim_key IN (SELECT w.claim_key FROM public.proposals w
                                WHERE w.id = ANY (v_written)))));
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

-- THE STEP THAT WRITES THE EVIDENTIARY LAYER. No role holds it: it runs inside the doors below,
-- which are owned by the same role. It encodes no rule about WHO may decide. The mode says how
-- the operator decided: one unit, or a group action. The act that the operator signs is no
-- decision on the queue, and it has no mode.
DROP FUNCTION IF EXISTS apply_proposal_as(uuid, text, text, text);
CREATE OR REPLACE FUNCTION apply_proposal_as(p_id uuid, p_decided_by text, p_mode text,
                                             p_origin text, p_reason text DEFAULT NULL)
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
         decided_as  = p_mode,
         decision_origin = p_origin,
         decision_reason = p_reason,
         prior_value = v_prior
   WHERE id = p_id AND status = 'pending';

  RETURN v_id;
END $$;

-- THE WRITE OF AN ACT THAT THE OPERATOR DECIDES: no rule gives an origin, so the freeze trigger
-- records "validated manually by the operator".
CREATE OR REPLACE FUNCTION apply_proposal(p_id uuid, p_decided_by text, p_mode text)
RETURNS uuid
LANGUAGE sql
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.apply_proposal_as(p_id, p_decided_by, p_mode, NULL)
$$;

-- THE PENDING ACTS OF ONE UNIT, LOCKED. The lock closes a second decision on the same unit while
-- this one runs. No role holds this step: it runs inside the doors of the unit.
CREATE OR REPLACE FUNCTION pending_unit(p_unit uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_left uuid[];
BEGIN
  PERFORM 1 FROM public.proposals
    WHERE unit_id = p_unit AND status = 'pending' ORDER BY id FOR UPDATE;
  SELECT array_agg(id ORDER BY id) INTO v_left FROM public.proposals
   WHERE unit_id = p_unit AND status = 'pending';
  IF v_left IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.proposals WHERE unit_id = p_unit) THEN
      RAISE EXCEPTION 'the unit % is decided already, and a decided act is frozen', p_unit
        USING CONSTRAINT = 'unit_pending';
    END IF;
    RAISE EXCEPTION 'the record holds no unit %', p_unit USING CONSTRAINT = 'unit_exists';
  END IF;
  RETURN v_left;
END $$;

-- THE UNITS THAT ONE UNIT NEEDS: the other units of the queue that hold an act that a relation of
-- the unit names. The promotion of the unit waits until each of them is in the record. The check
-- of the faults, the group action and the reads of the groups read this one rule. No role holds
-- this step.
--
-- Departure: PL/pgSQL and not SQL, for the plans that it keeps (see the name of an element). The
-- check of the faults calls it for each end of each unit of the queue.
CREATE OR REPLACE FUNCTION unit_needs(p_unit uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT o.unit_id
    FROM public.proposals x,
         LATERAL (VALUES ((x.payload->>'src_id')::uuid), ((x.payload->>'dst_id')::uuid)) AS e(ref)
    JOIN public.proposals o ON o.id = e.ref AND o.status = 'pending'
   WHERE x.unit_id = p_unit AND x.status = 'pending' AND x.op = 'create_relation'
     AND o.unit_id <> p_unit;
END $$;

-- THE UNITS THAT ONE UNIT WAITS FOR, directly or through a chain. A unit waits for another unit
-- when one of its relations names an act that waits in that other unit. Two relations of one group
-- can make a circle: "A to B" belongs to the unit of A and "B to A" to the unit of B, so each unit
-- waits for the other. A unit that is in its own list waits in a circle, and no promotion ends the
-- wait. The check of the faults reads this list, and the promotion reads that check. No role
-- holds this step.
--
-- Departure: a loop and not a recursive query. Measured on 8 October 2026: a recursive query that
-- calls the needs of each unit took 35 ms for each unit, and the check of the faults of the queue
-- took 40 s, against 0.7 s with this loop.
CREATE OR REPLACE FUNCTION unit_waits_for(p_unit uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_seen uuid[] := '{}';
  v_next uuid[] := ARRAY(SELECT n.unit_id FROM public.unit_needs(p_unit) AS n(unit_id));
BEGIN
  WHILE cardinality(v_next) > 0 LOOP
    v_seen := v_seen || v_next;
    v_next := ARRAY(SELECT DISTINCT n.unit_id
                      FROM unnest(v_next) AS u(unit_id), public.unit_needs(u.unit_id) AS n(unit_id)
                     WHERE NOT n.unit_id = ANY (v_seen));
  END LOOP;
  RETURN QUERY SELECT unnest(v_seen);
END $$;

-- THE WRITE OF ONE UNIT, WITH NO CHECK OF ITS FAULTS. No role holds this step. The promotion of one
-- unit runs the check first, and the group action runs the check once for its whole list and then
-- writes each clean unit here. It writes each act that waits in the unit, an entity before the
-- relation that names it, or it writes none: the first refusal stops the whole unit, and the
-- sentence names the act and the reason. A relation is written only when each end is in the
-- record or comes with the unit.
DROP FUNCTION IF EXISTS write_unit_as(uuid, text, text, text);
CREATE OR REPLACE FUNCTION write_unit_as(p_unit uuid, p_decided_by text, p_mode text,
                                         p_origin text, p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_left  uuid[];
  v_head  uuid;
  v_id    uuid;
  v_act   text;
  v_end   uuid;
  v_name  text;
  p       public.proposals%ROWTYPE;
  v_said  text;
  v_rule  text;
  v_table text;
  v_code  text;
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;
  v_left := public.pending_unit(p_unit);

  -- The measured forgery: propose and accept inside one transaction. Refused by a stored
  -- column, so the legitimate shape — proposed now, decided later — still passes. The operator
  -- signs an act of its own in one transaction through sign_change, which proposes it there.
  -- A named rule runs in the transaction of the act, and it is no machine that decides: no role
  -- holds the function of the rules, so a rule skips this test. Every other decision takes it.
  IF p_mode IS DISTINCT FROM 'rule' AND EXISTS (SELECT 1 FROM public.proposals
              WHERE id = ANY (v_left) AND xact = pg_current_xact_id()) THEN
    RAISE EXCEPTION 'the unit % was written by this transaction, and an act is not decided by '
                    'the transaction that proposed it', p_unit
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'decided_later';
  END IF;

  -- In a group action, an end that an earlier unit of the list failed to write is named here.
  SELECT x.payload->>'type', e.ref INTO v_act, v_end
    FROM public.proposals x,
         LATERAL (VALUES ((x.payload->>'src_id')::uuid), ((x.payload->>'dst_id')::uuid)) AS e(ref)
   WHERE x.id = ANY (v_left) AND x.op = 'create_relation'
     AND NOT e.ref = ANY (v_left)
     AND NOT EXISTS (SELECT 1 FROM public.entities n WHERE n.id = e.ref)
     AND NOT EXISTS (SELECT 1 FROM public.relations r WHERE r.id = e.ref)
   ORDER BY x.id
   LIMIT 1;
  IF FOUND THEN
    v_name := coalesce(public.element_name(v_end), v_end::text);
    RAISE EXCEPTION 'nothing of the unit is promoted, because its relation % waits for %, which '
                    'is not in the record', v_act, v_name
      USING CONSTRAINT = 'unit_end_waits';
  END IF;

  WHILE cardinality(v_left) > 0 LOOP
    -- The next act names no act of the unit that still waits.
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
      RAISE EXCEPTION 'nothing of the unit is promoted, because its acts name each other in a '
                      'circle' USING CONSTRAINT = 'unit_order';
    END IF;
    BEGIN
      v_id := public.apply_proposal_as(p.id, p_decided_by, p_mode, p_origin, p_reason);
    EXCEPTION WHEN raise_exception OR integrity_constraint_violation OR data_exception THEN
      GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT, v_rule = CONSTRAINT_NAME,
                              v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
      -- A rule of a table gets its own sentence.
      BEGIN
        PERFORM public.raise_rule(v_rule, v_table, v_code);
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT;
      END;
      RAISE EXCEPTION 'nothing of the unit is promoted, because the record refuses its %: %',
        CASE p.op
          WHEN 'create_entity'   THEN 'new entity ' || (p.payload->>'label')
          WHEN 'create_relation' THEN 'new relation ' || (p.payload->>'type')
          ELSE 'act ' || p.id::text END,
        v_said
        USING ERRCODE = v_code, CONSTRAINT = coalesce(nullif(v_rule, ''), 'unit_item');
    END;
    IF p.id = p_unit THEN
      v_head := v_id;
    END IF;
    v_left := array_remove(v_left, p.id);
  END LOOP;
  RETURN v_head;
END $$;

-- THE WRITE OF A UNIT THAT THE OPERATOR DECIDES, with the test of the transaction.
CREATE OR REPLACE FUNCTION write_unit(p_unit uuid, p_decided_by text, p_mode text)
RETURNS uuid
LANGUAGE sql
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.write_unit_as(p_unit, p_decided_by, p_mode, NULL)
$$;

-- THE PROMOTION OF ONE UNIT, WITH ITS ORIGIN. No role holds this step: the door of the operator
-- and the door of an AI reviewer run it. It runs the check of the faults that the screen reads,
-- and refuses a unit that the check blocks, or that waits for an entity of its own group, with
-- the words of each such fault. Then it writes the unit whole, or nothing. A NULL origin is a
-- decision of the operator.
CREATE OR REPLACE FUNCTION promote_unit_as(p_unit uuid, p_decided_by text, p_origin text,
                                           p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_left  uuid[];
  v_stops text;
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;
  -- The lock comes before the check, so the check reads the acts that the write writes.
  v_left := public.pending_unit(p_unit);

  -- The measured forgery: propose and accept inside one transaction. Refused by a stored
  -- column, so the legitimate shape — proposed now, decided later — still passes. The operator
  -- signs an act of its own in one transaction through sign_change, which proposes it there.
  IF EXISTS (SELECT 1 FROM public.proposals
              WHERE id = ANY (v_left) AND xact = pg_current_xact_id()) THEN
    RAISE EXCEPTION 'the unit % was written by this transaction, and an act is not decided by '
                    'the transaction that proposed it', p_unit
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'decided_later';
  END IF;

  SELECT string_agg(x->>'said', '; ') INTO v_stops
    FROM public.unit_faults(ARRAY[p_unit]) AS f, jsonb_array_elements(f.faults) AS x
   WHERE x->>'level' IN ('blocks', 'waits');
  IF v_stops IS NOT NULL THEN
    RAISE EXCEPTION 'nothing of the unit is promoted: %', v_stops
      USING CONSTRAINT = 'unit_blocked';
  END IF;
  RETURN public.write_unit_as(p_unit, p_decided_by, 'unit', p_origin, p_reason);
END $$;

-- THE PROMOTION OF ONE UNIT (P11), BY THE OPERATOR. Only the operator role holds it.
CREATE OR REPLACE FUNCTION promote_unit(p_unit uuid, p_decided_by text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.promote_unit_as(p_unit, p_decided_by, NULL, NULL)
$$;

-- THE REASON OF A REJECTION, CHECKED. It is one word of a fixed list, and "other" needs a note.
-- A blank note is no note. The note is private, as the reason is. No role holds this step.
CREATE OR REPLACE FUNCTION rejection_note(p_reason text, p_note text, p_decided_by text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, ''), E' \t\n\r\f\v'), '');
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;
  IF coalesce(p_reason, '') NOT IN ('wrong_value', 'not_in_source', 'wrong_type', 'duplicate',
                                    'out_of_scope', 'end_rejected', 'other') THEN
    RAISE EXCEPTION 'a rejection names one reason: wrong value, not in the source, wrong type, '
                    'duplicate, out of scope, end rejected, or other'
      USING CONSTRAINT = 'rejection_reason';
  END IF;
  IF p_reason = 'other' AND v_note IS NULL THEN
    RAISE EXCEPTION 'a rejection for another reason says that reason in its note'
      USING CONSTRAINT = 'rejection_note';
  END IF;
  IF char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'the note of a rejection is 500 characters at most'
      USING CONSTRAINT = 'rejection_note';
  END IF;
  RETURN v_note;
END $$;

-- AN END OF A NEW RELATION THAT THE OPERATOR REJECTED. Only such a relation takes the reason "end
-- rejected", so the reason never hides another one. It takes the operation and the payload of the
-- act, so a query can give the columns of any row. No role holds this step.
DROP FUNCTION IF EXISTS end_was_rejected(public.proposals);
CREATE OR REPLACE FUNCTION end_was_rejected(p_op text, p_payload jsonb)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p_op = 'create_relation'
     AND EXISTS (SELECT 1 FROM public.proposals w
                  WHERE w.id IN ((p_payload->>'src_id')::uuid, (p_payload->>'dst_id')::uuid)
                    AND w.status = 'rejected')
$$;

-- THE REJECTION OF ONE UNIT, WITH ITS ORIGIN. No role holds this step: the door of the operator
-- and the door of an AI reviewer run it. It rejects every act that waits in the unit, with one
-- reason and one note, and it leaves each row: a rejected act is never deleted, because it is the
-- record of what was set aside. A NULL origin is a decision of the operator.
CREATE OR REPLACE FUNCTION reject_unit_as(p_unit uuid, p_reason text, p_note text,
                                          p_decided_by text, p_origin text, p_why text)
RETURNS int
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_note text := public.rejection_note(p_reason, p_note, p_decided_by);
  v_left uuid[] := public.pending_unit(p_unit);
BEGIN
  IF p_reason = 'end_rejected'
     AND EXISTS (SELECT 1 FROM public.proposals x
                  WHERE x.id = ANY (v_left) AND NOT public.end_was_rejected(x.op, x.payload)) THEN
    RAISE EXCEPTION 'the reason "end rejected" is only for a relation whose other end was rejected'
      USING CONSTRAINT = 'rejection_end';
  END IF;
  UPDATE public.proposals
     SET status = 'rejected', decided_at = now(), decided_by = p_decided_by,
         decided_as = 'unit', reject_reason = p_reason, reject_note = v_note,
         decision_origin = p_origin, decision_reason = p_why
   WHERE id = ANY (v_left);
  RETURN cardinality(v_left);
END $$;

-- THE REJECTION OF ONE UNIT, BY THE OPERATOR. Only the operator role holds it.
CREATE OR REPLACE FUNCTION reject_unit(p_unit uuid, p_reason text, p_note text,
                                       p_decided_by text)
RETURNS int
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.reject_unit_as(p_unit, p_reason, p_note, p_decided_by, NULL, NULL)
$$;

-- THE REJECTION OF ONE RELATION OF A UNIT, WITH ITS ORIGIN. No role holds this step. One bad link
-- does not block a correct entity: the rest of the unit waits, and it stays one unit.
CREATE OR REPLACE FUNCTION reject_relation_as(p_id uuid, p_reason text, p_note text,
                                              p_decided_by text, p_origin text, p_why text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_note text := public.rejection_note(p_reason, p_note, p_decided_by);
  p      public.proposals%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the record holds no act %', p_id USING CONSTRAINT = 'proposal_exists';
  END IF;
  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'the act % is % already, and a decided act is frozen', p_id, p.status
      USING CONSTRAINT = 'proposal_pending';
  END IF;
  IF p.op <> 'create_relation' THEN
    RAISE EXCEPTION 'the act % is no new relation: reject its unit', p_id
      USING CONSTRAINT = 'relation_only';
  END IF;
  IF p_reason = 'end_rejected' AND NOT public.end_was_rejected(p.op, p.payload) THEN
    RAISE EXCEPTION 'the reason "end rejected" is only for a relation whose other end was rejected'
      USING CONSTRAINT = 'rejection_end';
  END IF;
  UPDATE public.proposals
     SET status = 'rejected', decided_at = now(), decided_by = p_decided_by,
         decided_as = 'relation', reject_reason = p_reason, reject_note = v_note,
         decision_origin = p_origin, decision_reason = p_why
   WHERE id = p_id;
END $$;

-- THE REJECTION OF ONE RELATION OF A UNIT, BY THE OPERATOR. Only the operator role holds it.
CREATE OR REPLACE FUNCTION reject_relation(p_id uuid, p_reason text, p_note text,
                                           p_decided_by text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.reject_relation_as(p_id, p_reason, p_note, p_decided_by, NULL, NULL)
$$;

-- THE DECISIONS OF AN AI REVIEWER. Only the research role holds them. Each one is the decision of
-- the page, with the same check of the faults, and it records its own origin, "decided by an AI
-- reviewer", with the reason that the AI gives. It is not a rule and it is not a decision of the
-- operator. Which session decides is a rule of the research skills: the session that proposed a
-- unit does not decide it. A refusal keeps its sentence and names the field to correct in its
-- hint, and it gives what the decision took: the name and the count of its acts.
CREATE OR REPLACE FUNCTION ai_decision(p_kind text, p_id uuid, p_reason text, p_note text,
                                       p_why text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  c_origin CONSTANT text := 'decided by an AI reviewer';
  c_by     CONSTANT text := 'an AI reviewer, through the MCP server';
  v_why    text := btrim(coalesce(p_why, ''), E' \t\n\r\f\v');
  v_said   jsonb;
  v_text   text;
  v_rule   text;
  v_code   text;
BEGIN
  BEGIN
    IF v_why = '' OR char_length(v_why) > 1000 THEN
      RAISE EXCEPTION 'an AI reviewer gives the reason of its decision, in 1,000 characters at most'
        USING CONSTRAINT = 'review_reason';
    END IF;
    IF p_kind = 'relation' THEN
      v_said := public.decision_said(NULL, p_id);
      PERFORM public.reject_relation_as(p_id, p_reason, p_note, c_by, c_origin, v_why);
    ELSE
      v_said := public.decision_said(p_id);
      IF p_kind = 'promote' THEN
        PERFORM public.promote_unit_as(p_id, c_by, c_origin, v_why);
      ELSE
        PERFORM public.reject_unit_as(p_id, p_reason, p_note, c_by, c_origin, v_why);
      END IF;
    END IF;
  EXCEPTION WHEN raise_exception OR integrity_constraint_violation OR data_exception
              OR insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_text = MESSAGE_TEXT, v_rule = CONSTRAINT_NAME,
                            v_code = RETURNED_SQLSTATE;
    RAISE EXCEPTION USING MESSAGE = v_text, ERRCODE = v_code, CONSTRAINT = v_rule,
      HINT = CASE WHEN v_rule IN ('rejection_reason', 'rejection_end') THEN 'reason'
                  WHEN v_rule = 'rejection_note' THEN 'note'
                  WHEN v_rule = 'review_reason' THEN 'why'
                  WHEN p_kind = 'relation' THEN 'relationId'
                  ELSE 'unitId' END;
  END;
  RETURN v_said;
END $$;

CREATE OR REPLACE FUNCTION ai_promote_unit(p_unit uuid, p_why text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.ai_decision('promote', p_unit, NULL, NULL, p_why)
$$;

CREATE OR REPLACE FUNCTION ai_reject_unit(p_unit uuid, p_reason text, p_note text, p_why text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.ai_decision('reject', p_unit, p_reason, p_note, p_why)
$$;

CREATE OR REPLACE FUNCTION ai_reject_relation(p_id uuid, p_reason text, p_note text, p_why text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.ai_decision('relation', p_id, p_reason, p_note, p_why)
$$;

-- THE GROUP ACTION (P11): "promote the clean proposals of this group". No role holds this step:
-- the door of the operator and the door of an AI reviewer run it. It takes the group and the exact list of units that the screen showed, so a unit that
-- came after the view is never written. It locks the acts of the list, runs the check of the
-- faults once for the whole list, and writes only the units that are still pending, still in the
-- group and still clean. A unit that others need is written first: a parent before its child, so
-- a child whose parent is in the list can be written. Each unit runs in its own savepoint, so a
-- unit that fails rolls back only itself, and a unit whose end failed before it is refused with
-- the name of that end. It gives one result for each unit of the list: the refused units first,
-- in the order of the list, then the units in the order of the writes.
CREATE OR REPLACE FUNCTION promote_group_as(p_group uuid, p_units uuid[], p_decided_by text,
                                            p_origin text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_units   uuid[];
  v_clean   uuid[] := '{}';
  v_ready   uuid[];
  v_unit    uuid;
  v_name    text;
  v_said    text;
  v_out     jsonb := '[]'::jsonb;
  r         record;
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it' USING CONSTRAINT = 'decision_named';
  END IF;
  IF p_group IS NULL OR coalesce(cardinality(p_units), 0) = 0 THEN
    RAISE EXCEPTION 'a group action names its group and the units of it that the screen showed'
      USING CONSTRAINT = 'group_named';
  END IF;
  SELECT array_agg(u.id ORDER BY u.at) INTO v_units
    FROM (SELECT l.id, min(l.at) AS at FROM unnest(p_units) WITH ORDINALITY AS l(id, at)
           WHERE l.id IS NOT NULL GROUP BY l.id) AS u;

  -- The lock comes before the check, so the check reads the acts that the writes write.
  PERFORM 1 FROM public.proposals
    WHERE unit_id = ANY (v_units) AND status = 'pending' ORDER BY id FOR UPDATE;

  FOR r IN
    SELECT u.id, f.state,
           (SELECT string_agg(x->>'said', '; ') FROM jsonb_array_elements(f.faults) AS x
             WHERE x->>'level' IN ('blocks', 'not_clean')) AS stops,
           EXISTS (SELECT 1 FROM public.proposals p
                    WHERE p.unit_id = u.id AND p.status = 'pending'
                      AND p.batch_id = p_group) AS in_group,
           EXISTS (SELECT 1 FROM public.proposals p WHERE p.unit_id = u.id) AS known
      FROM unnest(v_units) WITH ORDINALITY AS u(id, at)
      LEFT JOIN public.unit_faults(v_units) AS f ON f.unit_id = u.id
     ORDER BY u.at
  LOOP
    v_said := CASE
      WHEN NOT r.known THEN 'The record holds no such unit'
      WHEN r.state IS NULL THEN 'The unit is decided already'
      WHEN NOT r.in_group THEN 'The unit is not in this group'
      WHEN r.state = 'blocked' THEN 'Blocked: ' || r.stops
      WHEN r.state = 'not_clean' THEN 'Not clean: ' || r.stops END;
    IF v_said IS NULL THEN
      v_clean := v_clean || r.id;
    ELSE
      v_out := v_out || jsonb_build_object(
        'unit', r.id, 'name', coalesce(public.element_name(r.id), r.id::text),
        'outcome', 'refused', 'said', v_said);
    END IF;
  END LOOP;

  WHILE cardinality(v_clean) > 0 LOOP
    -- The units of the list that wait for no unit of the list that is still to write.
    SELECT array_agg(c.id ORDER BY c.at) INTO v_ready
      FROM unnest(v_clean) WITH ORDINALITY AS c(id, at)
     WHERE NOT EXISTS (SELECT 1 FROM public.unit_needs(c.id) AS n(unit_id)
                        WHERE n.unit_id = ANY (v_clean));
    -- A circle has no first unit. The check blocks it, so this is a guard: each unit of it is
    -- tried, and the write refuses it with the name of the end that waits.
    v_ready := coalesce(v_ready, v_clean);
    FOREACH v_unit IN ARRAY v_ready LOOP
      v_name := coalesce(public.element_name(v_unit), v_unit::text);
      BEGIN
        PERFORM public.write_unit_as(v_unit, p_decided_by, 'group', p_origin, p_reason);
        v_out := v_out || jsonb_build_object(
          'unit', v_unit, 'name', v_name, 'outcome', 'promoted', 'said', NULL);
      EXCEPTION WHEN raise_exception OR integrity_constraint_violation OR data_exception
                  OR insufficient_privilege THEN
        GET STACKED DIAGNOSTICS v_said = MESSAGE_TEXT;
        v_out := v_out || jsonb_build_object(
          'unit', v_unit, 'name', v_name, 'outcome', 'refused', 'said', v_said);
      END;
    END LOOP;
    v_clean := ARRAY(SELECT c FROM unnest(v_clean) AS c WHERE NOT c = ANY (v_ready));
  END LOOP;
  RETURN v_out;
END $$;

-- THE GROUP ACTION, BY THE OPERATOR. Only the operator role holds it.
CREATE OR REPLACE FUNCTION promote_group(p_group uuid, p_units uuid[], p_decided_by text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.promote_group_as(p_group, p_units, p_decided_by, NULL, NULL)
$$;

-- THE GROUP ACTION OF AN AI REVIEWER. Only the research role holds it. It is the group action of
-- the page, with the same check of the faults: each clean unit of the list is written as its own
-- decision, with the origin "decided by an AI reviewer" and the one reason that the AI gives, and
-- each other unit is refused with the reason. A refusal of the whole call names its field.
CREATE OR REPLACE FUNCTION ai_promote_group(p_group uuid, p_units uuid[], p_why text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_why  text := btrim(coalesce(p_why, ''), E' \t\n\r\f\v');
  v_text text;
  v_rule text;
  v_code text;
BEGIN
  IF v_why = '' OR char_length(v_why) > 1000 THEN
    RAISE EXCEPTION 'an AI reviewer gives the reason of its decision, in 1,000 characters at most'
      USING CONSTRAINT = 'review_reason', HINT = 'why';
  END IF;
  RETURN public.promote_group_as(p_group, p_units, 'an AI reviewer, through the MCP server',
                                 'decided by an AI reviewer', v_why);
EXCEPTION WHEN raise_exception OR integrity_constraint_violation OR data_exception THEN
  GET STACKED DIAGNOSTICS v_text = MESSAGE_TEXT, v_rule = CONSTRAINT_NAME,
                          v_code = RETURNED_SQLSTATE;
  RAISE EXCEPTION USING MESSAGE = v_text, ERRCODE = v_code, CONSTRAINT = v_rule,
    HINT = CASE WHEN v_rule = 'review_reason' THEN 'why'
                WHEN v_rule = 'group_named' THEN 'unitIds'
                ELSE 'groupId' END;
END $$;

-- THE RAIL OF THE GROUPS, FOR THE OPERATOR. The groups come in the order of the queue, with the
-- subject of that order. For each group that holds a unit that waits: its subject, its proposer, its document, the count of its units and of its clean units, and for each
-- fault that keeps a unit out of the group action, the count of the units that have it. A clean
-- unit that needs a unit that is not clean, directly or through a chain, is not counted clean:
-- the group action cannot write it. The faults read private data, so only the operator role holds
-- this read.
--
-- Departure: no compiled plan (jit), as for the page of the queue.
CREATE OR REPLACE FUNCTION review_groups()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET jit = off
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_rail jsonb;
BEGIN
  WITH RECURSIVE waiting AS (
    SELECT p.unit_id, p.batch_id, p.proposer, p.src
      FROM public.proposals p
     WHERE p.status = 'pending' AND p.batch_id IS NOT NULL
  ), units AS (
    SELECT DISTINCT w.unit_id, w.batch_id FROM waiting w
  ), checked AS (
    SELECT u.batch_id, u.unit_id, f.state, f.faults
      FROM units u
      JOIN public.unit_faults(ARRAY(SELECT unit_id FROM units)) AS f ON f.unit_id = u.unit_id
  ), needs AS (
    SELECT u.unit_id, n.needed FROM units u, public.unit_needs(u.unit_id) AS n(needed)
  ), spoiled AS (
    SELECT c.unit_id FROM checked c WHERE c.state <> 'clean'
    UNION
    SELECT n.unit_id FROM needs n JOIN spoiled s ON s.unit_id = n.needed
  ), counted AS (
    SELECT c.batch_id, count(*) AS units,
           count(*) FILTER (WHERE c.unit_id NOT IN (SELECT s.unit_id FROM spoiled s)) AS clean
      FROM checked c GROUP BY c.batch_id
  ), kinds AS (
    SELECT k.batch_id, jsonb_object_agg(k.kind, k.n) AS faults
      FROM (SELECT c.batch_id, x->>'kind' AS kind, count(DISTINCT c.unit_id) AS n
              FROM checked c, jsonb_array_elements(c.faults) AS x
             WHERE x->>'level' IN ('blocks', 'not_clean')
             GROUP BY c.batch_id, x->>'kind') AS k
     GROUP BY k.batch_id
  ), heads AS (
    SELECT w.batch_id, mode() WITHIN GROUP (ORDER BY w.proposer) AS proposer,
           mode() WITHIN GROUP (ORDER BY s.doc) AS document
      FROM waiting w LEFT JOIN LATERAL unnest(w.src) AS s(doc) ON true
     GROUP BY w.batch_id
  ), lines AS (
    SELECT n.batch_id, q.subject, q.sort_key, h.proposer, d.id AS doc,
           d.title, d.uri, n.units, n.clean, coalesce(k.faults, '{}'::jsonb) AS faults
      FROM counted n
      JOIN public.queue_groups() AS q ON q.batch_id = n.batch_id
      JOIN heads h ON h.batch_id = n.batch_id
      LEFT JOIN kinds k ON k.batch_id = n.batch_id
      LEFT JOIN public.documents d ON d.id = h.document
  )
  SELECT jsonb_build_object('groups', coalesce(jsonb_agg(jsonb_build_object(
           'id', l.batch_id, 'subject', l.subject, 'proposer', l.proposer,
           'document', CASE WHEN l.doc IS NULL THEN NULL
                            ELSE jsonb_build_object('id', l.doc, 'title', l.title, 'uri', l.uri)
                       END,
           'units', l.units, 'clean', l.clean, 'faults', l.faults)
           ORDER BY l.sort_key), '[]'::jsonb))
    INTO v_rail
    FROM lines l;
  RETURN v_rail;
END $$;

-- THE UNITS OF ONE GROUP THAT WAIT, FOR THE CONFIRMATION OF THE GROUP ACTION. Each unit comes with
-- its state, the kind and the level of each fault, the count of its entities and relations, the
-- parent of its entity (the other end of its relation "subordinate to", with the unit of that end
-- when it waits in the queue), and whether the group action can write it: a clean unit is
-- writable when each unit that it needs, directly or through a chain, is a clean unit of the same
-- group. The rail of the groups counts the clean units by the same rule. The screen draws the tree
-- of the writable units, and it sends back the units that it showed. Only the operator role holds
-- this read, as for the queue.
--
-- Departure: no compiled plan (jit). Measured on the record on 8 October 2026: the compile took
-- 0.9 s of the 1 s of the read of the largest group.
CREATE OR REPLACE FUNCTION review_group(p_group uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET jit = off
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_units uuid[] := ARRAY(SELECT DISTINCT p.unit_id FROM public.proposals p
                           WHERE p.batch_id = p_group AND p.status = 'pending');
  v_read  jsonb;
BEGIN
  IF cardinality(v_units) = 0 THEN
    RAISE EXCEPTION 'no unit of this group waits' USING CONSTRAINT = 'group_waits';
  END IF;
  WITH RECURSIVE acts AS (
    SELECT a.* FROM public.proposals a WHERE a.unit_id = ANY (v_units) AND a.status = 'pending'
  ), heads AS (
    SELECT DISTINCT ON (a.unit_id) a.unit_id, a.op, a.payload, a.target_id
      FROM acts a ORDER BY a.unit_id, (a.id <> a.unit_id), a.created_at, a.id
  ), sizes AS (
    SELECT a.unit_id, count(*) FILTER (WHERE a.op = 'create_entity') AS entities,
           count(*) FILTER (WHERE a.op = 'create_relation') AS relations
      FROM acts a GROUP BY a.unit_id
  ), parents AS (
    SELECT h.unit_id, (l.payload->>'dst_id')::uuid AS parent
      FROM heads h, public.parent_link(h.unit_id, true) AS l
     WHERE h.op = 'create_entity'
  ), checked AS (
    SELECT f.unit_id, f.state, f.faults FROM public.unit_faults(v_units) AS f
  ), needs AS (
    SELECT h.unit_id, n.needed FROM heads h, public.unit_needs(h.unit_id) AS n(needed)
  ), spoiled AS (
    -- The group action writes a clean unit only when it writes each unit that it needs too.
    SELECT c.unit_id FROM checked c WHERE c.state <> 'clean'
    UNION
    SELECT n.unit_id FROM needs n WHERE NOT n.needed = ANY (v_units)
    UNION
    SELECT n.unit_id FROM needs n JOIN spoiled s ON s.unit_id = n.needed
  ), named AS (
    SELECT h.*, coalesce(public.element_name(
                  CASE WHEN h.op IN ('create_entity', 'create_relation')
                       THEN h.unit_id ELSE h.target_id END), '') AS name
      FROM heads h
  )
  SELECT jsonb_agg(jsonb_build_object(
           'unit', h.unit_id,
           'kind', CASE WHEN h.op = 'create_entity' THEN 'entity'
                        WHEN h.op = 'create_relation' THEN 'link'
                        ELSE 'change' END,
           'name', h.name,
           'type', CASE WHEN h.op IN ('create_entity', 'create_relation')
                        THEN h.payload->>'type' END,
           'state', f.state,
           'faults', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', x->>'kind',
                                                                   'level', x->>'level')),
                                      '[]'::jsonb)
                        FROM jsonb_array_elements(f.faults) AS x),
           'entities', s.entities, 'relations', s.relations,
           'writable', h.unit_id NOT IN (SELECT sp.unit_id FROM spoiled sp),
           'parent', CASE WHEN pa.parent IS NULL THEN NULL
                          ELSE jsonb_build_object(
                                 'unit', (SELECT w.unit_id FROM public.proposals w
                                           WHERE w.id = pa.parent AND w.status = 'pending'),
                                 'name', coalesce(public.element_name(pa.parent),
                                                  pa.parent::text)) END)
           ORDER BY lower(h.name), h.unit_id)
    INTO v_read
    FROM named h
    JOIN sizes s ON s.unit_id = h.unit_id
    JOIN checked f ON f.unit_id = h.unit_id
    LEFT JOIN parents pa ON pa.unit_id = h.unit_id;
  RETURN jsonb_build_object('id', p_group, 'subject', public.group_subject(p_group),
                            'units', v_read);
END $$;

-- THE DECIDED ACTS, FOR THE OPERATOR: each promoted and each rejected act, the newest decision
-- first, with how the operator decided it (one unit, one relation or a group action) and the name
-- of the element that it proposed. A rejected act comes with its reason and its note, which are
-- private, so only the operator role holds this read. The public read shows no rejected act.
--
-- The read comes in pages: a page starts after the hour and the identifier of the last act of the
-- page before, and it gives the key of its own last act when more acts follow.
DROP FUNCTION IF EXISTS review_decided();
CREATE OR REPLACE FUNCTION review_decided(p_after_at timestamptz, p_after_id uuid, p_size int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_size int := greatest(1, least(coalesce(p_size, 100), 500));
BEGIN
  RETURN (
    WITH page AS (
      SELECT p.*, row_number() OVER (ORDER BY p.decided_at DESC, p.id) AS no
        FROM (SELECT * FROM public.proposals q
               WHERE q.status <> 'pending'
                 AND (p_after_at IS NULL
                      OR q.decided_at < p_after_at
                      OR (q.decided_at = p_after_at AND q.id > p_after_id))
               ORDER BY q.decided_at DESC, q.id
               LIMIT v_size + 1) AS p
    )
    SELECT jsonb_build_object(
      'acts', coalesce(jsonb_agg(jsonb_build_object(
                'id', p.id, 'op', p.op, 'payload', p.payload, 'targetKind', p.target_kind,
                'targetId', p.target_id, 'proposer', p.proposer, 'status', p.status,
                'createdAt', p.created_at, 'decidedAt', p.decided_at, 'decidedBy', p.decided_by,
                'decidedAs', p.decided_as, 'rejectReason', p.reject_reason,
                'rejectNote', p.reject_note, 'decisionOrigin', p.decision_origin,
                'decisionReason', p.decision_reason,
                'name', public.element_name(coalesce(p.target_id, p.id)))
                ORDER BY p.no) FILTER (WHERE p.no <= v_size), '[]'::jsonb),
      'next', (SELECT jsonb_build_object('decidedAt', l.decided_at, 'id', l.id)
                 FROM page l
                WHERE l.no = v_size AND EXISTS (SELECT 1 FROM page m WHERE m.no > v_size)))
      FROM page p);
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
  target_id := public.apply_proposal(proposal_id, p_decided_by, NULL);
  RETURN NEXT;
EXCEPTION WHEN integrity_constraint_violation THEN
  GET STACKED DIAGNOSTICS v_rule = CONSTRAINT_NAME, v_table = TABLE_NAME, v_code = RETURNED_SQLSTATE;
  PERFORM public.raise_rule(v_rule, v_table, v_code);
  RAISE;
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
RETURNS TABLE (job_id uuid, job_document text, job_kind text, job_lead text, job_mapping uuid,
               job_author text, job_budget integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT j.id INTO v_id
    FROM public.jobs j
   WHERE j.status = 'queued'
     AND j.kind IN ('extract_text','map_structured','load_mapped','research_lead','rate_author')
     -- A rating waits for the approval of the reference set: with no set, no model can compare.
     AND (j.kind <> 'rate_author' OR EXISTS (SELECT 1 FROM public.reference_approval))
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
  RETURNING j.id, j.document_id, j.kind, j.lead, j.mapping, j.author, j.token_budget
       INTO job_id, job_document, job_kind, job_lead, job_mapping, job_author, job_budget;

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
  PERFORM public.run_rules(public.units_of_job(p_id));
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

-- THE NAME OF AN ELEMENT FOR THE REVIEW: the label of an entity, in the record or in its act, and
-- for a relation its source, the words of its type and its target. The act gives the name also
-- when the operator rejected it, so the review names an end that was rejected. A relation names its
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
     WHERE w.id = p_id AND w.op = 'create_entity';
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
     WHERE w.id = p_id AND w.op = 'create_relation';
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  RETURN public.relation_name(v_src, v_type, v_dst);
END $$;

-- WHAT ONE DECISION TAKES: the name of the unit, or of the one relation, and the count of its
-- pending entities, relations and other acts. The writer reads it in the statement of the
-- decision, with the snapshot of that statement, so it reads the acts that the decision writes or
-- rejects: a promotion writes the whole unit or nothing, and a rejection takes every act that
-- waits. A relation named alone is that relation. Only the operator role holds it.
CREATE OR REPLACE FUNCTION decision_said(p_unit uuid, p_relation uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object(
    'name', coalesce((SELECT public.element_name(
                               CASE WHEN h.op IN ('create_entity', 'create_relation') THEN h.id
                                    ELSE h.target_id END)
                        FROM public.proposals h WHERE h.id = coalesce(p_relation, p_unit)), ''),
    'entities', count(*) FILTER (WHERE a.op = 'create_entity'),
    'relations', count(*) FILTER (WHERE a.op = 'create_relation'),
    'others', count(*) FILTER (WHERE a.op NOT IN ('create_entity', 'create_relation')))
    FROM public.proposals a
   WHERE a.status = 'pending'
     AND (CASE WHEN p_relation IS NULL THEN a.unit_id = p_unit ELSE a.id = p_relation END)
$$;

-- THE CITED WORDS OF THE NAMED ACTS, each with the two lines before and after them. The offsets
-- of a citation count code points.
--
-- Departure: each cited page is cut into lines once, and each citation is placed by the start of
-- its line. A substr of a long page counts the code points from its start at each call. Measured
-- on 7 October 2026: the one page of the v1 import holds about 500,000 characters, and a substr
-- for each citation took 2.7 s for a page of 200 units.
--
-- A citation with a transcription gives its words as they are, with no line before or after, and
-- `transcribed` says that the AI read them from the image.
--
-- External constraint: CREATE OR REPLACE cannot change the columns of a function, so each apply
-- drops it first. No view, no grant and no function body that the catalogue tracks depends on it.
DROP FUNCTION IF EXISTS cited_passages(uuid[]);
CREATE FUNCTION cited_passages(p_claims uuid[])
RETURNS TABLE (claim_id uuid, doc_id text, page int, before text, cited text, after text,
               transcribed boolean)
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
  RETURN QUERY
    SELECT c.claim_id, c.doc_id::text, c.page, ''::text, c.transcription, ''::text, true
      FROM public.citation c
     WHERE c.claim_id = ANY (p_claims) AND c.transcription IS NOT NULL;
  transcribed := false;
  FOR v_page IN SELECT DISTINCT c.doc_id, c.text_extractor, c.page FROM public.citation c
                 WHERE c.claim_id = ANY (p_claims) AND c.transcription IS NULL LOOP
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
                     AND c.transcription IS NULL
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

-- THE ACT THAT PUTS AN ENTITY UNDER ITS PARENT: the first act, by its hour, that proposes the
-- relation "subordinate to" from the entity. With p_pending, only an act that waits. The parent of
-- an entity, the faults, the tree of a group and the order of the queue read this one rule. No row
-- says that no act puts the entity under a parent. No role holds this step.
--
-- Departure: no fixed search path, so the planner puts the body inside the query that calls it.
-- The body names each table with its schema, and the function runs with the rights of its caller.
-- Measured on 8 October 2026: as a function of its own, it took 0.3 s of the check of the faults
-- of the queue.
CREATE OR REPLACE FUNCTION parent_link(p_child uuid, p_pending boolean)
RETURNS SETOF public.proposals
LANGUAGE sql STABLE AS $$
  SELECT w.* FROM public.proposals w
   WHERE w.names @> ARRAY[p_child] AND w.op = 'create_relation'
     AND w.payload->>'type' = 'subordinate_to' AND (w.payload->>'src_id')::uuid = p_child
     AND (w.status = 'pending' OR NOT p_pending)
   ORDER BY w.created_at, w.id
   LIMIT 1
$$;

-- THE PARENT OF AN ENTITY OF THE RECORD: the target of its relation "subordinate to", in the queue
-- or in the record. A pending act comes first, because it is the newest claim.
CREATE OR REPLACE FUNCTION parent_of(p_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_parent uuid;
BEGIN
  SELECT (l.payload->>'dst_id')::uuid INTO v_parent FROM public.parent_link(p_id, true) AS l;
  IF v_parent IS NULL THEN
    SELECT r.dst_id INTO v_parent FROM public.relations r
     WHERE r.src_id = p_id AND r.src_kind = 'entity' AND r.type = 'subordinate_to'
     ORDER BY r.valid_to DESC NULLS FIRST, r.id
     LIMIT 1;
  END IF;
  RETURN v_parent;
END $$;

-- THE SUBJECT OF A GROUP. A group with a tree (an entity of the group put under a parent) is named
-- by the top of its tree: its entity that is under no other entity of the group. A group with no
-- tree, as the extractor gives, is named by the document that its acts cite most. A group with no
-- top, because its parents make a circle, or with no document, is named by its first entity. An
-- act keeps its group after the decision, so the subject stays the same while the operator decides
-- the group.
CREATE OR REPLACE FUNCTION group_subject(p_batch uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_subject text;
  v_tree    boolean;
BEGIN
  SELECT EXISTS (
           SELECT 1 FROM public.proposals r
             JOIN public.proposals c ON c.id = (r.payload->>'src_id')::uuid
                                    AND c.op = 'create_entity' AND c.batch_id = p_batch
            WHERE r.batch_id = p_batch AND r.op = 'create_relation'
              AND r.payload->>'type' = 'subordinate_to')
    INTO v_tree;
  IF v_tree THEN
    SELECT g.payload->>'label' INTO v_subject
      FROM public.proposals g
     WHERE g.batch_id = p_batch AND g.op = 'create_entity'
       AND NOT EXISTS (
             SELECT 1 FROM public.proposals r
               JOIN public.proposals d ON d.id = (r.payload->>'dst_id')::uuid
              WHERE r.op = 'create_relation' AND r.batch_id = p_batch
                AND r.payload->>'type' = 'subordinate_to' AND (r.payload->>'src_id')::uuid = g.id
                AND d.op = 'create_entity' AND d.batch_id = p_batch)
     ORDER BY g.created_at, g.payload->>'label', g.id
     LIMIT 1;
  ELSE
    SELECT d.title INTO v_subject
      FROM public.proposals g, unnest(g.src) AS s(doc)
      JOIN public.documents d ON d.id = s.doc
     WHERE g.batch_id = p_batch
     GROUP BY d.id, d.title
     ORDER BY count(*) DESC, d.id
     LIMIT 1;
  END IF;
  IF v_subject IS NULL THEN
    SELECT g.payload->>'label' INTO v_subject
      FROM public.proposals g
     WHERE g.batch_id = p_batch AND g.op = 'create_entity'
     ORDER BY g.created_at, g.payload->>'label', g.id
     LIMIT 1;
  END IF;
  RETURN v_subject;
END $$;

-- THE WORDS OF A DISPUTE. The checks store their verdict as a code and a value by the name of its
-- field, and the operator reads words. A reason with no code stays as it is. A ref of an item that
-- an older checker wrote, such as "e3", stays too: the record keeps no ref and no order of the
-- items of a batch, so no act answers to it. The propose tool now writes the name in its place.
-- No role holds this step: the reads of the operator call it.
CREATE OR REPLACE FUNCTION dispute_said(p_reason text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           regexp_replace(p_reason,
             'the checker says not_supported',
             'the checker finds that the passage does not support the act', 'g'),
           'the checker says unclear', 'the checker finds the passage unclear', 'g'),
           '(states |, )label "', '\1the name "', 'g'),
           '(states |, )validFrom "', '\1the start date "', 'g'),
           '(states |, )validTo "', '\1the end date "', 'g'),
           '(states |, )attrs\.', '\1', 'g')
$$;

-- THE FAULTS OF EACH UNIT, AND ITS STATE. The queue, the promotion and the group action read this
-- one check, so the screen and the record always agree on "clean". Each fault has a level:
--
--   blocks       Promote cannot write the unit: an end waits in another group or in a circle, was
--                rejected or does not exist; a relation points to itself or to a relation that is
--                not in the record; an act of a machine cites no passage. The operator names the
--                documents of an own act, and a mapping names its whole document: they cite no
--                passage.
--   waits        Promote of this unit alone waits for an entity of its own group. The unit stays
--                clean, because the group action writes the parent before the child.
--   not_clean    The operator decides the unit alone, and never in a group action: a dispute; two
--                acts that set one key differently; a source that reports a claim and does not
--                state a fact; the same name and type under the same parent; an unknown type; a
--                claim that the operator rejected before (the newest rejection gives the day, and
--                the key of its reason and its note, which stay private to the operator); a value
--                that an import broke; an entity whose link to a rejected parent the operator
--                rejected, so that it has no parent now.
--   information  The unit stays clean: sources from the parent (a decision of the operator for the
--                v1 import), an approximate position, a note, the same name under another parent.
--
-- A relation alone (a link, or a relation with no group) waits until each end is in the record.
--
-- THE V1 IMPORT SAYS "SOURCES FROM THE PARENT" in two places, and only an act of the v1 import is
-- read for it. A new import writes the parent in the payload, where the promotion does not copy
-- it. The acts of the first import have it only in the cited line, which the importer ends with
-- "| sources of <name> (v1 <id>): <addresses>".
--
-- THE CHECK READS A LIST OF UNITS AT ONCE, so a group action checks its whole list in one call.
--
-- Departure: PL/pgSQL and not SQL, for the plans that it keeps (see the name of an element).
CREATE OR REPLACE FUNCTION unit_faults(p_units uuid[])
RETURNS TABLE (unit_id uuid, state text, faults jsonb)
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RETURN QUERY
  WITH acts AS (
    SELECT a.* FROM public.proposals a
     WHERE a.unit_id = ANY (p_units) AND a.status = 'pending'
  ), units AS (
    SELECT a.unit_id, (array_agg(a.batch_id))[1] AS batch_id,
           bool_or(a.op = 'create_entity' AND a.id = a.unit_id) AS entity_unit
      FROM acts a GROUP BY a.unit_id
  ), ends AS (
    SELECT a.id AS act, a.unit_id, e.ref,
           CASE WHEN e.kind = 'relation'
                THEN EXISTS (SELECT 1 FROM public.relations r WHERE r.id = e.ref)
                ELSE EXISTS (SELECT 1 FROM public.entities x WHERE x.id = e.ref) END AS held
      FROM acts a,
           LATERAL (VALUES ((a.payload->>'src_id')::uuid,
                            coalesce(a.payload->>'src_kind', 'entity')),
                           ((a.payload->>'dst_id')::uuid,
                            coalesce(a.payload->>'dst_kind', 'entity')),
                           (a.target_id, a.target_kind)) AS e(ref, kind)
     WHERE e.ref IS NOT NULL AND e.ref <> a.id
  ), placed AS (
    SELECT DISTINCT ON (n.act, n.ref) n.*, u.entity_unit, u.batch_id, w.status AS end_status,
           w.op AS end_op, w.unit_id AS end_unit, w.batch_id AS end_batch,
           w.decided_at AS end_decided, coalesce(public.element_name(n.ref), n.ref::text) AS name
      FROM ends n
      JOIN units u ON u.unit_id = n.unit_id
      LEFT JOIN public.proposals w ON w.id = n.ref
     WHERE NOT n.held
       AND w.unit_id IS DISTINCT FROM n.unit_id
     ORDER BY n.act, n.ref
  ), circles AS (
    SELECT DISTINCT ON (p.unit_id) p.unit_id, p.act, p.name
      FROM placed p
     WHERE p.end_status = 'pending'
       AND p.unit_id IN (SELECT public.unit_waits_for(p.end_unit))
     ORDER BY p.unit_id, p.name
  ), waits AS (
    SELECT p.*, coalesce(p.entity_unit AND p.end_batch = p.batch_id, false) AS own_group
      FROM placed p
     WHERE p.end_status = 'pending' AND p.end_op = 'create_entity'
       AND p.unit_id NOT IN (SELECT c.unit_id FROM circles c)
  ), sets AS (
    SELECT a.unit_id,
           CASE a.op WHEN 'create_entity' THEN a.id::text
                     WHEN 'create_relation'
                       THEN concat_ws(' ', a.payload->>'type', a.payload->>'src_id',
                                      a.payload->>'dst_id')
                     ELSE a.target_id::text END AS element,
           s.key, s.value
      FROM acts a,
           LATERAL (SELECT t.k, t.v->'v'
                      FROM jsonb_each(coalesce(a.payload->'attrs', '{}'::jsonb)) AS t(k, v)
                    UNION ALL
                    SELECT f.k, a.payload->f.k FROM unnest(ARRAY['valid_from', 'valid_to']) AS f(k)
                     WHERE a.payload ? f.k) AS s(key, value)
  ), subjects AS (
    SELECT b.batch_id, coalesce(public.group_subject(b.batch_id), 'with no subject') AS subject
      FROM (SELECT DISTINCT w.batch_id FROM public.proposals w
             WHERE w.status = 'pending' AND w.batch_id IS NOT NULL) AS b
  ), named AS (
    -- A pending entity is not in the record, so its parent is in a pending act.
    SELECT a.unit_id, a.id, public.name_key(a.payload->>'label') AS key,
           a.payload->>'type' AS type, (pa.payload->>'dst_id')::uuid AS parent,
           pa.claim_key AS parent_key
      FROM acts a
      LEFT JOIN LATERAL public.parent_link(a.id, true) AS pa ON true
     WHERE a.op = 'create_entity'
  ), twins AS (
    SELECT n.unit_id, n.parent, o.payload->>'label' AS label,
           (pa.payload->>'dst_id')::uuid AS other_parent,
           CASE WHEN o.batch_id IS NULL THEN 'waits in the queue (no group)'
                ELSE 'waits in the queue (group ' || sb.subject || ')' END AS place
      FROM named n
      JOIN public.proposals o ON o.status = 'pending' AND o.op = 'create_entity' AND o.id <> n.id
                             AND o.payload->>'type' = n.type
                             AND public.name_key(o.payload->>'label') = n.key
      LEFT JOIN LATERAL public.parent_link(o.id, true) AS pa ON true
      LEFT JOIN subjects sb ON sb.batch_id = o.batch_id
    UNION ALL
    SELECT n.unit_id, n.parent, e.label, public.parent_of(e.id), 'is in the record'
      FROM named n
      JOIN public.entities e ON e.type = n.type AND public.name_key(e.label) = n.key
  ), inherited AS (
    SELECT a.unit_id, a.payload->>'sources_from' AS holder
      FROM acts a
     WHERE a.op = 'create_entity' AND a.proposer = 'v1_import' AND a.payload ? 'sources_from'
    UNION ALL
    SELECT a.unit_id, substring(q.cited FROM '\| sources of (.+) \(v1 [^)]*\):[^|]*$')
      FROM public.cited_passages(ARRAY(
             SELECT x.id FROM acts x
              WHERE x.op = 'create_entity' AND x.proposer = 'v1_import'
                AND NOT x.payload ? 'sources_from')) AS q
      JOIN acts a ON a.id = q.claim_id
  ), before AS (
    -- The newest rejection of the same claim, for each unit. The key of an entity holds no
    -- parent, so that a key never changes, and the match of an entity also compares the claim
    -- of its parent: the first act that puts it under a parent. No parent matches no parent. So a
    -- rejected "1st battalion" marks only a "1st battalion" under the same parent.
    SELECT DISTINCT ON (a.unit_id) a.unit_id, a.id AS act, r.decided_at, r.reject_reason,
           r.reject_note
      FROM acts a
      JOIN public.proposals r ON r.claim_key = a.claim_key AND r.status = 'rejected'
                             AND r.id <> a.id AND r.decided_as IS DISTINCT FROM 'rule'
      LEFT JOIN named n ON n.id = a.id
     WHERE a.op <> 'create_entity'
        OR n.parent_key IS NOT DISTINCT FROM (SELECT l.claim_key
                                                FROM public.parent_link(r.id, false) AS l)
     ORDER BY a.unit_id, r.decided_at DESC, r.id
  ), found (unit_id, level, kind, act, said) AS (
    -- -------------------------------------------------------------------------------- blocks --
    SELECT w.unit_id, 'blocks', 'end_waits', w.act,
           'Waits for ' || w.name
           || CASE WHEN w.end_batch IS NULL THEN ' (no group)'
                   ELSE ' (group ' || sb.subject || ')' END
      FROM waits w LEFT JOIN subjects sb ON sb.batch_id = w.end_batch
     WHERE NOT w.own_group
    UNION ALL
    SELECT c.unit_id, 'blocks', 'circle', c.act,
           'Waits in a circle with ' || c.name || ', which waits for this unit: reject one '
           || 'relation of the circle'
      FROM circles c
    UNION ALL
    SELECT p.unit_id, 'blocks', 'end_relation_waits', p.act,
           'Points to the relation ' || p.name || ', which is not in the record yet'
      FROM placed p WHERE p.end_status = 'pending' AND p.end_op = 'create_relation'
    UNION ALL
    SELECT p.unit_id, 'blocks', 'end_rejected', p.act,
           CASE WHEN p.entity_unit THEN 'The other end ' ELSE 'The end ' END || p.name
           || ' was rejected on '
           || to_char(p.end_decided AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      FROM placed p WHERE p.end_status = 'rejected'
    UNION ALL
    SELECT p.unit_id, 'blocks', 'end_missing', p.act,
           'The end ' || p.name || ' is not in the record and not in the queue'
      FROM placed p WHERE p.end_status IS NULL OR p.end_status = 'accepted'
    UNION ALL
    SELECT a.unit_id, 'blocks', 'self', a.id,
           'The relation ' || coalesce(public.element_name(a.id), a.payload->>'type')
           || ' has the same element at its two ends'
      FROM acts a
     WHERE a.op = 'create_relation' AND a.payload->>'src_id' = a.payload->>'dst_id'
    UNION ALL
    SELECT a.unit_id, 'blocks', 'no_source', a.id,
           'The act ' || coalesce(public.element_name(coalesce(a.target_id, a.id)), a.op)
           || ' cites no passage of a source'
      FROM acts a
     WHERE a.author_role <> 'gabriel_app' AND a.op <> 'map_document'
       AND NOT EXISTS (SELECT 1 FROM public.citation c WHERE c.claim_id = a.id)
    -- --------------------------------------------------------------------------------- waits --
    UNION ALL
    SELECT w.unit_id, 'waits', 'end_waits_in_group', w.act,
           'Waits for ' || w.name || ' in this group: promote it first'
      FROM waits w WHERE w.own_group
    -- ----------------------------------------------------------------------------- not clean --
    UNION ALL
    SELECT a.unit_id, 'not_clean', 'dispute', a.id,
           coalesce('Disputed: ' || public.dispute_said(a.dissent_reason),
                    'Disputed. The check recorded no reason')
      FROM acts a WHERE a.dissent
    UNION ALL
    SELECT s.unit_id, 'not_clean', 'contradiction', NULL::uuid,
           'Two acts set ' || s.key || ' differently: '
           || string_agg(DISTINCT coalesce(s.value #>> '{}', s.value::text), ' and ')
      FROM sets s
     GROUP BY s.unit_id, s.element, s.key
    HAVING count(DISTINCT s.value) > 1
    UNION ALL
    SELECT DISTINCT ON (a.id) a.unit_id, 'not_clean', 'reported_claim', a.id,
           'The source reports a claim (' || c.modality || ') and does not state a fact'
      FROM acts a JOIN public.citation c ON c.claim_id = a.id
     WHERE c.modality IN ('alleges', 'attributes', 'denies')
    UNION ALL
    SELECT t.unit_id, 'not_clean', 'duplicate', NULL::uuid,
           'Same name and type under the same parent: '
           || string_agg(t.label || ' ' || t.place, '; ' ORDER BY t.place, t.label)
      FROM twins t WHERE t.other_parent IS NOT DISTINCT FROM t.parent
     GROUP BY t.unit_id
    UNION ALL
    SELECT a.unit_id, 'not_clean', 'unknown_type', a.id,
           CASE WHEN a.op = 'create_entity' THEN 'The entity type ' ELSE 'The relation type ' END
           || CASE WHEN a.payload->>'type' = 'unknown' THEN 'is unknown'
                   ELSE (a.payload->>'type') || ' is not a type of the record' END
      FROM acts a
     WHERE (a.op = 'create_entity'
            AND NOT EXISTS (SELECT 1 FROM public.entity_type t
                             WHERE t.key = a.payload->>'type' AND NOT t.retired
                               AND t.key <> 'unknown'))
        OR (a.op = 'create_relation'
            AND NOT EXISTS (SELECT 1 FROM public.relation_type t
                             WHERE t.key = a.payload->>'type' AND NOT t.retired
                               AND t.key <> 'unknown'))
    UNION ALL
    -- The reason and the note go with the fault as a key and a text, and the page words the key.
    SELECT b.unit_id, 'not_clean', 'rejected_before', b.act,
           'Rejected before on ' || to_char(b.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      FROM before b
    UNION ALL
    -- The v1 import wrote an object of its source file as the text "[object Object]", and a list
    -- that it cut at each space as "[object" and "Object]".
    SELECT DISTINCT a.unit_id, 'not_clean', 'broken_value', a.id, 'A value is broken: ' || k.key
      FROM acts a, jsonb_each(coalesce(a.payload->'attrs', '{}'::jsonb)) AS k(key, held)
     WHERE (jsonb_typeof(k.held->'v') = 'string' AND k.held->>'v' = '[object Object]')
        OR (jsonb_typeof(k.held->'v') = 'array'
            AND (k.held->'v') ?| ARRAY['[object Object]', '[object', 'Object]'])
    UNION ALL
    -- An entity whose link to its parent the operator rejected after the parent: it has no parent
    -- now, and the operator decides it alone.
    SELECT DISTINCT ON (n.unit_id) n.unit_id, 'not_clean', 'parent_rejected', l.id,
           'Its parent ' || coalesce(public.element_name(d.id), d.id::text) || ' was rejected on '
           || to_char(d.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      FROM named n
      JOIN public.proposals l ON l.names @> ARRAY[n.id] AND l.status = 'rejected'
                             AND l.op = 'create_relation'
                             AND l.payload->>'type' = 'subordinate_to'
                             AND (l.payload->>'src_id')::uuid = n.id
      JOIN public.proposals d ON d.id = (l.payload->>'dst_id')::uuid AND d.status = 'rejected'
     WHERE n.parent IS NULL
    -- --------------------------------------------------------------------------- information --
    UNION ALL
    SELECT DISTINCT i.unit_id, 'information', 'sources_from_parent', NULL::uuid,
           'Sources from the parent ' || i.holder
      FROM inherited i WHERE i.holder IS NOT NULL
    UNION ALL
    SELECT a.unit_id, 'information', 'approximate_position', a.id, 'The position is approximate'
      FROM acts a WHERE a.payload#>>'{attrs,position_precision,v}' = 'approximate'
    UNION ALL
    SELECT a.unit_id, 'information', 'note', a.id, 'Note: ' || (a.payload#>>'{attrs,note,v}')
      FROM acts a WHERE a.payload->'attrs' ? 'note'
    UNION ALL
    -- Origin of the number: three names fit on one line of the right column.
    SELECT o.unit_id, 'information', 'same_name', NULL::uuid,
           'Same name under ' || array_to_string((array_agg(o.parent ORDER BY o.parent))[1:3], ', ')
           || CASE WHEN count(*) > 3 THEN ' and ' || (count(*) - 3)::text || ' more' ELSE '' END
      FROM (SELECT DISTINCT t.unit_id,
                   coalesce(public.element_name(t.other_parent), 'no parent') AS parent
              FROM twins t WHERE t.other_parent IS DISTINCT FROM t.parent) AS o
     GROUP BY o.unit_id
  )
  SELECT u.unit_id,
         CASE WHEN bool_or(f.level = 'blocks') THEN 'blocked'
              WHEN bool_or(f.level = 'not_clean') THEN 'not_clean'
              ELSE 'clean' END,
         coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'level', f.level, 'act', f.act,
                                               'said', f.said)
                            || CASE WHEN f.kind = 'rejected_before'
                                    THEN jsonb_build_object('reason', b.reject_reason,
                                                            'note', b.reject_note)
                                    ELSE '{}'::jsonb END
                            ORDER BY array_position(ARRAY['blocks', 'waits', 'not_clean',
                                                          'information'],
                                                    f.level), f.kind, f.said)
                    FILTER (WHERE f.kind IS NOT NULL), '[]'::jsonb)
    FROM units u
    LEFT JOIN found f ON f.unit_id = u.unit_id
    LEFT JOIN before b ON b.unit_id = u.unit_id
   GROUP BY u.unit_id;
END $$;

-- THE GROUPS OF THE QUEUE, IN THE ORDER OF THE QUEUE. The queue and the rail of the groups read
-- this one order. Each group that holds a pending act gives its subject, its sort key and the
-- count of its pending units.
--
-- A group that other groups wait for comes before them. A group waits for another group when one
-- of its relations names an act of that group. The height of a group is the longest chain of
-- groups that wait for it, and a larger height comes first. Then the subject, then the
-- identifier. The sort key is ARRAY['0', 999 - height, subject in lower case, identifier]: the
-- numbers have a fixed width, because the key compares as text.
--
-- THE ORDER READS EVERY ACT OF A GROUP, pending or decided. An act and its group never change, so
-- a decision never moves a group, and a page read after a decision starts where the screen left.
-- No role holds this step: the reads of the operator call it.
CREATE OR REPLACE FUNCTION queue_groups()
RETURNS TABLE (batch_id uuid, subject text, sort_key text[], pending_units int)
LANGUAGE sql STABLE
SET jit = off
SET search_path = pg_catalog, public, pg_temp AS $$
  WITH RECURSIVE every AS (
    SELECT DISTINCT p.batch_id FROM public.proposals p WHERE p.batch_id IS NOT NULL
  ), waits AS (
    -- Group "waiter" waits for group "held".
    SELECT DISTINCT r.batch_id AS waiter, o.batch_id AS held
      FROM public.proposals r,
           LATERAL (VALUES ((r.payload->>'src_id')::uuid), ((r.payload->>'dst_id')::uuid)) AS e(ref)
      JOIN public.proposals o ON o.id = e.ref
     WHERE r.op = 'create_relation' AND r.batch_id IS NOT NULL
       AND o.batch_id IS NOT NULL AND o.batch_id <> r.batch_id
  ), climb (root, last, path, height) AS (
    SELECT g.batch_id, g.batch_id, ARRAY[g.batch_id], 0 FROM every g
    UNION ALL
    SELECT c.root, w.waiter, c.path || w.waiter, c.height + 1
      FROM climb c JOIN waits w ON w.held = c.last
     WHERE NOT w.waiter = ANY (c.path)
  ), pending AS (
    SELECT p.batch_id, count(DISTINCT p.unit_id)::int AS units
      FROM public.proposals p
     WHERE p.status = 'pending' AND p.batch_id IS NOT NULL
     GROUP BY p.batch_id
  )
  SELECT n.batch_id, n.subject,
         ARRAY['0', lpad((999 - least(n.height, 999))::text, 3, '0'),
               lower(coalesce(n.subject, '')), n.batch_id::text],
         n.units
    FROM (SELECT g.batch_id, public.group_subject(g.batch_id) AS subject, g.units,
                 (SELECT max(c.height) FROM climb c WHERE c.root = g.batch_id) AS height
            FROM pending g) AS n
$$;

-- ============================================================================== THE NAMED RULES (A) ==
-- The three reads of one unit stand here, before the review read that calls them. The rest of the
-- rules stand with the decision (apply_rules) below.

-- WHY A UNIT IS A DOUBT WHEN NO FAULT SAYS IT. The doubt rule reads three causes beside the faults:
-- a check that disputes a fact, a denial by a party to the conflict, and a source whose name
-- joined an author A or B. The first one that holds gives its key, and NULL means none holds. The
-- rule and the sentence of the review page read this one function. No role holds this step.
CREATE OR REPLACE FUNCTION unit_doubt_cause(p_unit uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RETURN (SELECT CASE
           WHEN EXISTS (SELECT 1 FROM public.act_check k WHERE k.proposal_id = f.id
                                                           AND k.verdict = 'not_supported')
             THEN 'check_disputes'
           WHEN EXISTS (SELECT 1 FROM public.citation c
                          JOIN public.author w ON w.id = public.author_of(f.originator)
                         WHERE c.claim_id = f.id AND c.modality = 'denies' AND w.party)
             THEN 'party_denies'
           WHEN EXISTS (SELECT 1 FROM public.author_name n
                         WHERE n.name_key = public.name_key(f.originator) AND n.doubt)
             THEN 'name_joins'
         END
    FROM public.proposals a
    JOIN public.proposals f ON f.claim_key = a.claim_key AND f.status <> 'rejected'
                           AND f.originator IS NOT NULL
   WHERE a.unit_id = p_unit AND a.status = 'pending' AND a.claim_key IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.act_check k WHERE k.proposal_id = f.id
                                                     AND k.verdict = 'not_supported')
          OR EXISTS (SELECT 1 FROM public.citation c
                       JOIN public.author w ON w.id = public.author_of(f.originator)
                      WHERE c.claim_id = f.id AND c.modality = 'denies' AND w.party)
          OR EXISTS (SELECT 1 FROM public.author_name n
                      WHERE n.name_key = public.name_key(f.originator) AND n.doubt))
   LIMIT 1);
END $$;

-- THE RULE THAT MATCHES A UNIT. The rules read in this order, and the first one that matches
-- decides:
--
--   impossible      a link to an element that was rejected, or from an element to itself;
--   doubt           any fault of the check that the review page reads at the level "not clean",
--                   except a contradiction or a reported claim from an author F (the unit waits);
--                   a check that disputes a fact, a denial by a party to the conflict, or a
--                   source whose name joined an author A or B;
--   strong_sources  no fault stops the unit, and each fact is strong (see fact_is_strong). A fact
--                   with no passed second check never passes, a research fact included;
--   weak_sources    every other unit. It waits.
--
-- The function reads and writes nothing. NULL when the unit has no act that waits.
--
-- THE RULE READS THE FAULTS OF THE UNIT, and the check of the faults is the costly step. So the
-- rules stand in rule_of_faults, which takes the faults as an argument, and a list of units checks
-- its faults once in one call of unit_faults. unit_rule is the rule of one unit. No role holds
-- rule_of_faults.
CREATE OR REPLACE FUNCTION rule_of_faults(p_unit uuid, p_faults jsonb)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_all_f  boolean;
  v_single text;
  v_pair   text;
  v_other  text;
BEGIN
  IF p_faults IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_faults) AS x
              WHERE x->>'kind' IN ('self', 'end_rejected')) THEN
    RETURN 'impossible';
  END IF;
  -- A contradiction or a reported claim from an author F is no doubt: the unit waits, and the card
  -- shows the conflict. A reported claim reads the author of its act. A contradiction has no
  -- single act, so it reads every act of the unit: it waits only when each one is from an author F.
  v_all_f := NOT EXISTS (SELECT 1 FROM public.proposals a
                          WHERE a.unit_id = p_unit AND a.status = 'pending'
                            AND (a.originator IS NULL OR public.letter_of(a.originator) <> 'F'));
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_faults) AS x
              WHERE x->>'level' = 'not_clean'
                AND NOT (x->>'kind' = 'contradiction' AND v_all_f)
                AND NOT (x->>'kind' = 'reported_claim'
                         AND EXISTS (SELECT 1 FROM public.proposals r
                                      WHERE r.id = (x->>'act')::uuid AND r.originator IS NOT NULL
                                        AND public.letter_of(r.originator) = 'F')))
     OR public.unit_doubt_cause(p_unit) IS NOT NULL
  THEN
    RETURN 'doubt';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_faults) AS x
              WHERE x->>'level' IN ('blocks', 'waits')) THEN
    RETURN 'weak_sources';
  END IF;
  SELECT c.settings->>'single', c.settings->>'pair', c.settings->>'other'
    INTO v_single, v_pair, v_other
    FROM public.rule_config c WHERE c.rule = 'strong_sources';
  IF NOT EXISTS (
       SELECT 1 FROM public.proposals a
        WHERE a.unit_id = p_unit AND a.status = 'pending'
          AND NOT (a.claim_key IS NOT NULL AND a.originator IS NOT NULL AND NOT a.dissent
                   AND EXISTS (SELECT 1 FROM public.act_check k
                                WHERE k.proposal_id = a.id AND k.passed)
                   AND public.fact_is_strong(a.claim_key, v_single, v_pair, v_other))) THEN
    RETURN 'strong_sources';
  END IF;
  RETURN 'weak_sources';
END $$;

CREATE OR REPLACE FUNCTION unit_rule(p_unit uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.rule_of_faults(p_unit, (SELECT f.faults FROM public.unit_faults(ARRAY[p_unit]) AS f));
$$;

-- WHAT THE REVIEW PAGE SAYS OF A UNIT THAT A RULE DID NOT DECIDE. A doubt gives its reason: the
-- sentences of its faults that are not clean, or the cause that the doubt rule read beside them.
-- A unit that waits gives the source that it needs. The sentence of the missing check or letter
-- comes first, because nothing else can help while it is missing. The letters come from the
-- configuration of the strong rule, so a new threshold changes the sentence. NULL when the unit
-- has no act that waits. The conflict of an author F that waits is told before the need. No role
-- holds this step: only the read of the operator calls it. The read gives the faults that it
-- checked already, so the costly check runs once for each unit.
DROP FUNCTION IF EXISTS unit_said(uuid, text);
CREATE OR REPLACE FUNCTION unit_said(p_unit uuid, p_rule text, p_faults jsonb)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_faults jsonb := p_faults;
  v_said   text;
  v_conflict text;
  v_need   text;
  v_single text;
  v_pair   text;
  v_other  text;
BEGIN
  IF v_faults IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_rule = 'doubt' THEN
    SELECT string_agg(x->>'said', '; ') INTO v_said
      FROM jsonb_array_elements(v_faults) AS x WHERE x->>'level' = 'not_clean';
    RETURN coalesce(v_said, CASE public.unit_doubt_cause(p_unit)
      WHEN 'check_disputes' THEN 'A second model says that a source does not support a fact'
      WHEN 'party_denies' THEN 'A party to the conflict denies a fact'
      WHEN 'name_joins' THEN 'The name of a source joined an author of letter A or B'
    END);
  END IF;
  SELECT string_agg(x->>'said', '; ') INTO v_said
    FROM jsonb_array_elements(v_faults) AS x WHERE x->>'level' IN ('blocks', 'waits');
  IF v_said IS NOT NULL THEN
    RETURN v_said;
  END IF;
  -- A conflict that waits is a fault of an author F: the card shows it before the need.
  SELECT string_agg(x->>'said', '; ') INTO v_conflict
    FROM jsonb_array_elements(v_faults) AS x WHERE x->>'level' = 'not_clean';
  SELECT c.settings->>'single', c.settings->>'pair', c.settings->>'other'
    INTO v_single, v_pair, v_other
    FROM public.rule_config c WHERE c.rule = 'strong_sources';
  IF EXISTS (SELECT 1 FROM public.proposals a
              WHERE a.unit_id = p_unit AND a.status = 'pending'
                AND (a.claim_key IS NULL OR a.originator IS NULL)) THEN
    v_need := 'A cited source with a known author for each act';
  ELSIF EXISTS (SELECT 1 FROM public.proposals a
                 WHERE a.unit_id = p_unit AND a.status = 'pending'
                   AND NOT EXISTS (SELECT 1 FROM public.act_check k
                                    WHERE k.proposal_id = a.id AND k.passed)) THEN
    v_need := 'A passed check by a second model family for each fact';
  ELSIF EXISTS (SELECT 1 FROM public.proposals a
                  JOIN public.proposals p ON p.claim_key = a.claim_key AND p.status <> 'rejected'
                                         AND p.originator IS NOT NULL
                 WHERE a.unit_id = p_unit AND a.status = 'pending'
                   AND public.author_of(p.originator) IS NOT NULL
                   AND public.letter_of(p.originator) <= v_pair
                   AND EXISTS (SELECT 1 FROM public.act_check k
                                WHERE k.proposal_id = p.id AND k.passed)) THEN
    v_need := 'A second independent author, ' || v_other || ' or better';
  ELSE
    v_need := 'One source ' || v_single || ' on its own record, or two independent authors, '
              || v_pair || ' or better and ' || v_other || ' or better';
  END IF;
  RETURN CASE WHEN v_conflict IS NULL THEN v_need ELSE v_conflict || '; ' || v_need END;
END $$;

-- ONE PAGE OF THE REVIEW QUEUE, FOR THE OPERATOR. Each unit comes with its state and its faults,
-- its acts, the ends of each act, the proposer, the group, the documents and the cited passages
-- with two lines of context. Each passage names the element of the act that it supports. A
-- passage of the v1 import is the whole line of its unit, and the lines around it state other
-- units, so the passage says so. Each act, and each unit whose every act is such a relation, says
-- whether the reason "end rejected" fits it. Each act gives the check of a second model on it, or
-- null when no model checked it.
-- The passages and the reason of a dispute are private, so only the operator role holds this
-- read. The page starts after the sort key of the last unit of the page before, so a long queue
-- is never read whole. Only the units of the page read their acts, their ends and their passages.
--
-- THE GROUP IS NAMED BY ITS SUBJECT: the entity of the group that is the source of no relation to
-- another entity of the group.
--
-- THE ORDER clears the import fast:
--   1. the groups in the order of the groups of the queue, and after them the acts with no group;
--   2. in a group, the units with a fault (not clean or blocked) first, then the clean units;
--   3. the depth in the tree of the group, so a parent comes before its child. A unit that is not
--      an entity comes after the tree;
--   4. the name, then the identifier of the unit, so two units never share a key.
-- The numbers of the key have a fixed width, because the key compares as text. The depth reads
-- every act of the group, pending or decided, so a decision never changes it.
--
-- THE LIMIT OF THE ORDER: the fault of a unit can change after a decision. When the operator
-- rejects a parent, its children become blocked and move to the start of their group, before the
-- place of the screen. The next page then does not show them. They show again when the operator
-- reads the queue from its first unit, or filters by the fault.
--
-- THE LANES: the rules sort the units that wait in two lists. The lane "doubt" holds the units that
-- the doubt rule sent to the operator, each with its reason. The lane "waiting" holds every other
-- unit, each with the source that it needs. The lane is a filter too: a null lane keeps both. A
-- lane check reads every unit that the other filters keep, as a fault filter does. The answer
-- counts the units that rules decided, and the units of each lane, over the whole queue.
--
-- THE FILTERS: the group, the proposer, a kind of fault, a cited document, a part of the name
-- in any case, and the identifier of one unit. A null filter keeps every unit. The filter of one
-- unit opens a link to a unit that is not on the first page; a unit that waits no more gives no
-- unit.
--
-- THE CHECK OF THE FAULTS IS THE COSTLY STEP, so it runs once for each unit that waits, in one
-- call, and the lanes, the filters and the sentences read its result. A page with no fault filter
-- sorts only the groups that the page can reach: the group of the key that the page starts after,
-- and the next groups until they hold one unit more than the page. A fault filter sorts every
-- unit that the other filters keep.
--
-- The answer also counts every unit of the queue, the units that the filters keep, and the units
-- of the filters before the page, and it gives the choices of the filters: each group in the order
-- of the queue, each document that a pending act cites, and each proposer of a unit that waits.
--
-- Departure: no compiled plan (jit). Measured on the record on 2026-10-07: the compile of the
-- check of the faults took longer than the check.
DROP FUNCTION IF EXISTS review_units(text[], int);
DROP FUNCTION IF EXISTS review_units(text[], int, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS review_units(text[], int, uuid, text, text, text, text, uuid);
CREATE OR REPLACE FUNCTION review_units(p_after text[], p_size int, p_group uuid DEFAULT NULL,
  p_proposer text DEFAULT NULL, p_fault text DEFAULT NULL, p_document text DEFAULT NULL,
  p_name text DEFAULT NULL, p_unit uuid DEFAULT NULL, p_lane text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET jit = off
SET search_path = pg_catalog, public, pg_temp AS $$
  WITH RECURSIVE size AS (
    SELECT greatest(1, least(coalesce(p_size, 50), 200)) AS n
  ), heads AS (
    -- The head act of each unit: the entity of an entity unit, or the one act of any other unit.
    SELECT DISTINCT ON (p.unit_id) p.unit_id, p.op, p.payload, p.proposer, p.batch_id,
           p.target_id
      FROM public.proposals p
     WHERE p.status = 'pending'
     ORDER BY p.unit_id, (p.id <> p.unit_id), p.created_at, p.id
  ), faulted AS (
    -- The faults of every unit that waits, from one call. The lanes, the fault filter and the
    -- sentence of each unit read them here, so the costly check runs once for each unit.
    SELECT f.unit_id, f.state, f.faults
      FROM public.unit_faults(ARRAY(SELECT h.unit_id FROM heads h)) AS f
  ), ruled AS (
    -- The rule that matches each unit that waits. The doubt rule makes the lane "doubt", and any
    -- other result is the lane "waiting".
    SELECT r.unit_id, r.rule, CASE WHEN r.rule = 'doubt' THEN 'doubt' ELSE 'waiting' END AS lane
      FROM (SELECT f.unit_id, public.rule_of_faults(f.unit_id, f.faults) AS rule
              FROM faulted f) AS r
  ), groups AS (
    SELECT q.batch_id, q.subject, q.sort_key AS group_key FROM public.queue_groups() AS q
  ), tree (start, at, path, depth) AS (
    -- The depth of each pending entity in the tree of its own group, read on every act.
    SELECT h.unit_id, h.unit_id, ARRAY[h.unit_id], 0
      FROM heads h WHERE h.op = 'create_entity' AND h.batch_id IS NOT NULL
    UNION ALL
    SELECT t.start, d.id, t.path || d.id, t.depth + 1
      FROM tree t
      JOIN public.proposals r ON r.op = 'create_relation'
                             AND r.payload->>'type' = 'subordinate_to'
                             AND (r.payload->>'src_id')::uuid = t.at
      JOIN public.proposals d ON d.id = (r.payload->>'dst_id')::uuid
                             AND d.op = 'create_entity' AND d.batch_id = r.batch_id
     WHERE NOT d.id = ANY (t.path)
  ), depths AS (
    SELECT t.start AS unit_id, max(t.depth) AS depth FROM tree t GROUP BY t.start
  ), kept AS (
    -- Each unit that the filters other than the fault keep, with its key up to the fault.
    SELECT u.*,
           coalesce(g.group_key, ARRAY['1', '', '', '']) AS group_key,
           ARRAY[lpad(coalesce(dp.depth, 999)::text, 3, '0'), lower(u.name), u.unit_id::text]
             AS tail_key
      FROM (SELECT h.unit_id, h.op, h.proposer, h.batch_id, h.payload, gs.subject,
                   coalesce(public.element_name(
                              CASE WHEN h.op IN ('create_entity', 'create_relation')
                                   THEN h.unit_id ELSE h.target_id END), '') AS name
              FROM heads h
              LEFT JOIN groups gs ON gs.batch_id = h.batch_id
             WHERE (p_group IS NULL OR h.batch_id = p_group)
               AND (p_unit IS NULL OR h.unit_id = p_unit)
               AND (p_proposer IS NULL OR h.proposer = p_proposer)
               AND (p_document IS NULL
                    OR EXISTS (SELECT 1 FROM public.proposals a
                                WHERE a.unit_id = h.unit_id AND a.status = 'pending'
                                  AND p_document = ANY (a.src)))) AS u
      LEFT JOIN groups g ON g.batch_id = u.batch_id
      LEFT JOIN depths dp ON dp.unit_id = u.unit_id
     WHERE p_name IS NULL OR strpos(lower(u.name), lower(p_name)) > 0
  ), counted AS (
    SELECT k.group_key, count(*) AS units FROM kept k GROUP BY k.group_key
  ), reached AS (
    -- The groups that the page can reach, when no fault filter asks to check every unit.
    SELECT c.group_key FROM counted c
     WHERE p_after IS NOT NULL AND c.group_key = p_after[1:4]
    UNION ALL
    SELECT r.group_key
      FROM (SELECT c.group_key,
                   coalesce(sum(c.units) OVER (ORDER BY c.group_key
                              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS earlier
              FROM counted c
             WHERE p_after IS NULL OR c.group_key > p_after[1:4]) AS r
     WHERE r.earlier < (SELECT n FROM size) + 1
  ), checked AS (
    SELECT fa.unit_id, fa.state, fa.faults,
           p_fault IS NULL OR fa.faults @> jsonb_build_array(jsonb_build_object('kind', p_fault))
             AS hit
      FROM faulted fa
     WHERE fa.unit_id IN (SELECT k.unit_id FROM kept k
                           WHERE p_fault IS NOT NULL OR p_lane IS NOT NULL
                              OR k.group_key IN (SELECT group_key FROM reached))
  ), keyed AS (
    SELECT k.*, ch.state, ch.faults, ru.rule, ru.lane,
           k.group_key || CASE WHEN ch.state = 'clean' THEN '1' ELSE '0' END || k.tail_key
             AS sort_key
      FROM kept k
      JOIN checked ch ON ch.unit_id = k.unit_id
      JOIN ruled ru ON ru.unit_id = k.unit_id
     WHERE ch.hit AND (p_lane IS NULL OR ru.lane = p_lane)
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
                        WHEN EXISTS (SELECT 1 FROM public.proposals w
                                      WHERE w.id = x.id AND w.status = 'rejected')
                          THEN 'rejected'
                        ELSE 'missing' END,
             'group', (SELECT w.batch_id FROM public.proposals w
                        WHERE w.id = x.id AND w.status = 'pending'),
             'rejectedOn', (SELECT to_char(w.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
                              FROM public.proposals w
                             WHERE w.id = x.id AND w.status = 'rejected')) AS said
      FROM (SELECT DISTINCT e.ref AS id
              FROM acts a,
                   LATERAL (VALUES ((a.payload->>'src_id')::uuid), ((a.payload->>'dst_id')::uuid),
                                   (a.target_id)) AS e(ref)
             WHERE e.ref IS NOT NULL) AS x
  ), acted AS (
    SELECT a.unit_id,
           jsonb_agg(jsonb_build_object(
             'id', a.id, 'op', a.op, 'payload', a.payload, 'targetId', a.target_id,
             'createdAt', a.created_at, 'dissent', a.dissent,
             'endRejected', public.end_was_rejected(a.op, a.payload),
             'dissentReason', public.dispute_said(a.dissent_reason),
             'check', (SELECT jsonb_build_object('model', k.checker_model, 'verdict', k.verdict,
                                                 'passed', k.passed, 'reason', k.reason)
                         FROM public.act_check k WHERE k.proposal_id = a.id),
             'target', et.said, 'src', es.said, 'dst', ed.said)
             ORDER BY (a.op <> 'create_entity'), a.created_at, a.id) AS acts,
           bool_and(public.end_was_rejected(a.op, a.payload)) AS end_rejected
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
             'act', q.claim_id,
             'supports', coalesce(public.element_name(coalesce(a.target_id, a.id)), a.op),
             'ownLine', a.proposer = 'v1_import',
             'document', q.doc_id, 'page', q.page, 'before', q.before,
             'text', q.cited, 'after', q.after, 'transcribed', q.transcribed)
             ORDER BY q.claim_id, q.doc_id, q.page) AS passages
      FROM public.cited_passages(ARRAY(SELECT id FROM acts)) AS q
      JOIN acts a ON a.id = q.claim_id
     GROUP BY a.unit_id
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM heads),
    'matched', CASE WHEN p_fault IS NULL AND p_lane IS NULL THEN (SELECT count(*) FROM kept)
                    ELSE (SELECT count(*) FROM keyed) END,
    -- A unit of a group before the groups that the page reaches was not checked, and comes
    -- before the page whatever its faults.
    'counts', jsonb_build_object(
      'decided', (SELECT count(DISTINCT q.unit_id) FROM public.proposals q
                   WHERE q.decided_as = 'rule'),
      'doubt', (SELECT count(*) FROM ruled WHERE lane = 'doubt'),
      'waiting', (SELECT count(*) FROM ruled WHERE lane = 'waiting')),
    'before', CASE WHEN p_after IS NULL THEN 0
                   ELSE (SELECT count(*) FROM keyed WHERE sort_key <= p_after)
                        + (SELECT count(*) FROM kept k
                            WHERE k.unit_id NOT IN (SELECT unit_id FROM checked)
                              AND k.group_key < p_after[1:4]) END,
    'next', (SELECT p.sort_key FROM page p
              WHERE p.no = (SELECT n FROM size)
                AND EXISTS (SELECT 1 FROM page q WHERE q.no > (SELECT n FROM size))),
    'choices', jsonb_build_object(
      'groups', coalesce((SELECT jsonb_agg(jsonb_build_object('id', g.batch_id,
                                                              'subject', g.subject)
                                           ORDER BY g.group_key)
                            FROM groups g), '[]'::jsonb),
      'documents', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title) ORDER BY d.title, d.id)
          FROM public.documents d
         WHERE d.id IN (SELECT s.doc FROM public.proposals a, unnest(a.src) AS s(doc)
                         WHERE a.status = 'pending')), '[]'::jsonb),
      'proposers', coalesce((SELECT jsonb_agg(DISTINCT h.proposer ORDER BY h.proposer)
                               FROM heads h), '[]'::jsonb)),
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
               'state', s.state,
               'faults', s.faults,
               'lane', s.lane,
               'said', public.unit_said(s.unit_id, s.rule, s.faults),
               'endRejected', ac.end_rejected,
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

-- PU1, THE ADDRESS OF A KNOWN UPLOAD. The same bytes are stored once, so a second upload of a file
-- reaches the row of the first one. An older upload can have no address, and the address makes
-- it a public document. This door gives the address to such a row, and it never changes an
-- address that a row holds. It answers what it found, so the caller can tell the operator:
--   filled       the row had no address, and it holds this one now;
--   same         the row holds this address already;
--   other        the row holds another address, and keeps it;
--   before_rule  the row held its address before the ruling of 9 October 2026 (migration 0066),
--                so the address is not public, and the row keeps it;
--   not_a_file   the row is not an upload, so its address does not come from an upload.
-- The row lock makes two uploads of the same bytes fill the address once.
CREATE OR REPLACE FUNCTION fill_document_uri(p_document text, p_uri text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_kind   text;
  v_uri    text;
  v_before boolean;
BEGIN
  IF btrim(coalesce(p_uri, ''), E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'the address is blank' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT d.kind, d.uri, d.uri_before_pu1 INTO v_kind, v_uri, v_before
    FROM public.documents d WHERE d.id = p_document::doc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document % does not exist', p_document
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_kind <> 'file' THEN
    RETURN 'not_a_file';
  END IF;
  IF btrim(coalesce(v_uri, ''), E' \t\n\r\f\v') = '' THEN
    UPDATE public.documents SET uri = p_uri WHERE id = p_document::doc_id;
    RETURN 'filled';
  END IF;
  IF v_before THEN
    RETURN 'before_rule';
  END IF;
  IF v_uri = p_uri THEN
    RETURN 'same';
  END IF;
  RETURN 'other';
END $$;

-- THE TITLE OF A DOCUMENT THAT IS READ AGAIN. Before PR #416 the fetch tool read each HTML page as
-- UTF-8, so a page in another charset got a garbled title. The command that reads the stored
-- bytes again gives the title that it read before (p_from) and the corrected one (p_to). The door
-- changes the title only when the row still holds p_from, so a title that the operator or a later
-- run changed stays. It answers whether it changed the title. It changes no other column.
CREATE OR REPLACE FUNCTION correct_document_title(p_document text, p_from text, p_to text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_to IS NULL OR btrim(p_to, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'the corrected title is blank' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.documents SET title = p_to
   WHERE id = p_document::doc_id AND title = p_from AND title <> p_to;
  RETURN FOUND;
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
--
-- A JOB THAT ENDS WELL AT A STOP GIVES THE REASON OF THE STOP. A deepening search ends at its token
-- budget, and that is a good end. The row keeps the reason, so the operator sees that the budget
-- stopped the search and that the model did not end it. A job that ends with no stop has no reason.
-- The door returns the status that it wrote. The earlier signatures are dropped first.
DROP FUNCTION IF EXISTS complete_job(uuid);
DROP FUNCTION IF EXISTS complete_job(uuid, int, int, text);
CREATE OR REPLACE FUNCTION complete_job(p_id uuid, p_parts int DEFAULT 0, p_refused int DEFAULT 0,
                                        p_refusal text DEFAULT NULL, p_stop text DEFAULT NULL)
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
                               THEN public.refused_parts_said(p_refused, p_refusal)
                               ELSE p_stop END,
         finished_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running, and only a running job completes', p_id;
  END IF;
  PERFORM public.run_rules(public.units_of_job(p_id));
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

-- ===================================================================== THE LETTER OF AN AUTHOR ==
-- A letter, a name and a check are written once. The owner and the superuser ignore a grant, so a
-- trigger holds it.
CREATE OR REPLACE FUNCTION author_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'a row of % is never %', TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
END $$;

-- THE AUTHOR OF A NAME, or NULL when no worker answer has resolved the name. A reference author is
-- no author until the operator approves the reference set. Inside the doors only, so no role holds
-- EXECUTE on it.
CREATE OR REPLACE FUNCTION author_of(p_name text) RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT n.author_id
    FROM public.author_name n JOIN public.author a ON a.id = n.author_id
   WHERE n.name_key = public.name_key(p_name)
     AND (NOT a.reference_set
          OR EXISTS (SELECT 1 FROM public.reference_approval r WHERE r.author_id = a.id))
$$;

-- THE AUTHOR OF A NAME, FOR THE WRITES. Unlike author_of() it sees a reference author that the
-- operator did not approve yet, because the name key of a name is unique over all authors. It gives
-- the row of the author and whether that row is in the reference set. Inside the doors only.
CREATE OR REPLACE FUNCTION held_name(p_name text, OUT held boolean, OUT in_reference_set boolean)
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT true, a.reference_set
    FROM public.author_name n JOIN public.author a ON a.id = n.author_id
   WHERE n.name_key = public.name_key(p_name)
  UNION ALL SELECT false, false
  LIMIT 1
$$;

-- THE WRITE OF A NEW AUTHOR, for the two doors below. It refuses a blank field, a name that has an
-- author already, and a party with no controller. The letter and the reference names are the
-- business of the door.
CREATE OR REPLACE FUNCTION new_author(p_name text, p_letter text, p_model text, p_reason text,
                                      p_references text[], p_controller text, p_party boolean,
                                      p_reference_set boolean)
RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_blank constant text := E' \t\n\r\f\v';
  v_key text := public.name_key(coalesce(p_name, ''));
  v_held record;
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'a letter names its author' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO v_held FROM public.held_name(v_key);
  IF v_held.held THEN
    -- The reference build leaves a name that a worker rated: the rated author stands.
    IF p_reference_set AND NOT v_held.in_reference_set THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'the name "%" already has an author', v_key
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF btrim(coalesce(p_model, ''), v_blank) = '' THEN
    RAISE EXCEPTION 'a letter names the model that gave it'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF btrim(coalesce(p_reason, ''), v_blank) = '' THEN
    RAISE EXCEPTION 'a letter gives its reason' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_references IS NULL OR array_position(p_references, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(p_references) AS r(name) WHERE btrim(r.name, v_blank) = '')
  THEN
    RAISE EXCEPTION 'a reference author is a name' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT p_reference_set AND cardinality(p_references) = 0 THEN
    RAISE EXCEPTION 'a letter names at least one reference author that the model compared with'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce(p_party, false) AND btrim(coalesce(p_controller, ''), v_blank) = '' THEN
    RAISE EXCEPTION 'a party to the conflict names its controller'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.author
    (name_key, letter, model, reason, reference_authors, controller, party, reference_set)
  VALUES (v_key, p_letter, btrim(p_model, v_blank), btrim(p_reason, v_blank), p_references,
          nullif(btrim(coalesce(p_controller, ''), v_blank), ''), coalesce(p_party, false),
          p_reference_set)
  RETURNING id INTO v_id;
  INSERT INTO public.author_name (name_key, author_id) VALUES (v_key, v_id);
  PERFORM public.run_rules(public.units_of_author(v_id));
  RETURN v_id;
END $$;

-- THE DOOR OF THE WORKER FOR A NEW AUTHOR. The model gives a letter from C to F, the reason, the
-- reference authors that it compared with, and the controller when the author has one. The door
-- writes an input of the rules and never a decision.
CREATE OR REPLACE FUNCTION store_author_letter(p_name text, p_letter text, p_model text,
                                               p_reason text, p_references text[],
                                               p_controller text DEFAULT NULL,
                                               p_party boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF coalesce(p_letter, '') NOT IN ('C','D','E','F') THEN
    RAISE EXCEPTION 'the worker stores a letter from C to F. A and B come from the reference set'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Each reference author is an approved author of the reference set. A blank name is no author.
  IF EXISTS (
    SELECT 1 FROM unnest(p_references) AS r(name)
     WHERE r.name IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.author_name n
         JOIN public.author a ON a.id = n.author_id
         JOIN public.reference_approval x ON x.author_id = a.id
        WHERE n.name_key = public.name_key(r.name) AND a.reference_set))
  THEN
    RAISE EXCEPTION 'a reference author is an approved author of the reference set'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN public.new_author(p_name, p_letter, p_model, p_reason, p_references, p_controller,
                           p_party, false);
END $$;

-- THE DOOR OF THE OPERATOR FOR THE REFERENCE SET. The operator reads and approves the set once.
-- Only here an author gets A or B.
CREATE OR REPLACE FUNCTION store_reference_author(p_name text, p_letter text, p_model text,
                                                  p_reason text, p_references text[],
                                                  p_controller text DEFAULT NULL,
                                                  p_party boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF coalesce(p_letter, '') NOT IN ('A','B','C','D','E','F') THEN
    RAISE EXCEPTION 'a letter is one of A to F' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN public.new_author(p_name, p_letter, p_model, p_reason, p_references, p_controller,
                           p_party, true);
END $$;

-- WHY A NAME CAN JOIN NO AUTHOR, or NULL when it can. A name that holds two authors ("OFAC;
-- Reuters", "Reuters, Tass") is no name of one author. A generic name (a country, or a role with
-- no body, such as "the secretary of state") names no author that a reader can find. Such a name
-- goes to the rater as a new author. Inside the doors only.
CREATE OR REPLACE FUNCTION name_joins_no_author(p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE
    WHEN p_key ~ '[^[:space:];,][[:space:]]*;[[:space:]]*[^[:space:];,]'
      OR (p_key ~ '[^[:space:];,][[:space:]]*,[[:space:]]*[^[:space:];,]'
          -- A legal form after a comma is a part of the name of one company.
          AND regexp_replace(p_key, ',[[:space:]]*(inc|ltd|llc|plc|pjsc|pao|jsc|oao|ooo|zao|co|'
                                    'corp|ag|gmbh|sa|s\.a|nv|bv|limited)\.?(?=$|[[:space:],])',
                             '', 'g') ~ '[^[:space:];,][[:space:]]*,[[:space:]]*[^[:space:];,]')
      THEN format('the name "%s" holds two authors and joins no author', p_key)
    WHEN regexp_replace(replace(p_key, '.', ''), '^the ', '') = ANY (ARRAY[
           'uk', 'us', 'usa', 'eu', 'un', 'russia', 'russian federation', 'ukraine', 'china',
           'india', 'iran', 'united kingdom', 'united states', 'european union', 'government',
           'secretary of state', 'minister', 'ministry', 'authorities', 'officials', 'official',
           'court', 'company', 'president', 'police', 'state', 'department', 'prosecutor',
           'spokesperson', 'spokesman', 'source', 'sources', 'media', 'press', 'report',
           'reports', 'author', 'unknown'])
      THEN format('the name "%s" is generic and joins no author', p_key)
  END
$$;

-- THE DOOR OF THE WORKER FOR A NAME OF A KNOWN AUTHOR. A model words one author in more than one
-- way. A join into an author A or B is a doubt, because it raises the letter of every act of the
-- name. A name of two authors and a generic name join no author.
CREATE OR REPLACE FUNCTION join_author_name(p_name text, p_known_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_key text := public.name_key(coalesce(p_name, ''));
  v_author uuid := public.author_of(p_known_name);
  v_no_join text := public.name_joins_no_author(v_key);
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'a join names the new name' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'the name "%" is the name of no known author',
      public.name_key(coalesce(p_known_name, '')) USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (public.held_name(v_key)).held THEN
    RAISE EXCEPTION 'the name "%" already has an author', v_key
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_no_join IS NOT NULL THEN
    RAISE EXCEPTION '%', v_no_join USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.author_name (name_key, author_id, doubt)
  VALUES (v_key, v_author,
          (SELECT a.letter IN ('A','B') FROM public.author a WHERE a.id = v_author));
  PERFORM public.run_rules(public.units_of_author(v_author));
END $$;

-- THE LETTER OF AN AUTHOR, for the operator. A name that no worker answer has resolved reads as
-- F. A party to the conflict reads as C at most on every fact, because the graph holds no side
-- yet (decisions.md S1). The digit of a fact never calls this function.
CREATE OR REPLACE FUNCTION letter_of(p_name text) RETURNS char(1)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(
    (SELECT CASE WHEN a.party AND a.letter IN ('A','B') THEN 'C' ELSE a.letter END
       FROM public.author_name n JOIN public.author a ON a.id = n.author_id
      WHERE n.name_key = public.name_key(p_name)
        AND (NOT a.reference_set
             OR EXISTS (SELECT 1 FROM public.reference_approval r WHERE r.author_id = a.id))),
    'F')::char(1)
$$;

-- THE APPROVAL OF THE REFERENCE SET, by the operator. It approves each reference author that has
-- no approval yet, and it gives their number. A set with nothing to approve is no fault: it gives 0.
CREATE OR REPLACE FUNCTION approve_reference_set() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_new uuid[];
BEGIN
  WITH approved AS (
    INSERT INTO public.reference_approval (author_id)
    SELECT a.id FROM public.author a
     WHERE a.reference_set
       AND NOT EXISTS (SELECT 1 FROM public.reference_approval r WHERE r.author_id = a.id)
    RETURNING author_id
  )
  SELECT coalesce(array_agg(author_id), '{}') INTO v_new FROM approved;
  -- An approval gives a letter to an author, so the units of these authors go through the rules.
  PERFORM public.run_rules(ARRAY(SELECT DISTINCT u FROM unnest(v_new) AS n(a),
                                 LATERAL unnest(public.units_of_author(n.a)) AS x(u)));
  RETURN cardinality(v_new);
END $$;

-- THE REFERENCE SET, for the operator to read before the approval. Each author comes with its
-- letter, its reason and the state of its approval.
CREATE OR REPLACE FUNCTION reference_set()
RETURNS TABLE (name_key text, letter char(1), reason text, controller text, party boolean,
               approved boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT a.name_key, a.letter, a.reason, a.controller, a.party,
         EXISTS (SELECT 1 FROM public.reference_approval r WHERE r.author_id = a.id)
    FROM public.author a
   WHERE a.reference_set
   ORDER BY a.letter, a.name_key
$$;

-- WHAT THE WORKER READS TO RATE ONE NAME. When the name has an author, the answer says so and holds
-- nothing else, because the job has nothing to do. Else it holds the known authors, with the
-- reference set once the operator approved it. The worker reads no other letter than these.
CREATE OR REPLACE FUNCTION rating_context(p_name text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN public.author_of(p_name) IS NOT NULL
              THEN jsonb_build_object('resolved', true)
              ELSE jsonb_build_object('resolved', false, 'authors', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                         'name', a.name_key, 'letter', a.letter, 'reason', a.reason,
                         'controller', a.controller, 'party', a.party,
                         'reference', a.reference_set,
                         'names', (SELECT coalesce(jsonb_agg(n.name_key ORDER BY n.name_key),
                                                   '[]'::jsonb)
                                     FROM public.author_name n
                                    WHERE n.author_id = a.id AND n.name_key <> a.name_key))
                       ORDER BY a.reference_set DESC, a.letter, a.name_key)
                  FROM public.author a
                 WHERE NOT a.reference_set
                    OR EXISTS (SELECT 1 FROM public.reference_approval r
                                WHERE r.author_id = a.id)), '[]'::jsonb))
         END
$$;

-- THE JOB THAT RATES A NEW NAME. Each act that names an originator with no author queues one job
-- for that name, and the unique index of the jobs keeps it to one. No click of the operator.
CREATE OR REPLACE FUNCTION enqueue_author_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_key text := public.name_key(coalesce(NEW.originator, ''));
BEGIN
  IF v_key <> '' AND public.author_of(v_key) IS NULL THEN
    INSERT INTO public.jobs (kind, author) VALUES ('rate_author', v_key)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

-- ========================================================================= INDEPENDENCE ==
-- THE SITE OF AN ADDRESS: the host, and for a network of channels the channel too. A channel is a
-- voice of its own, so two channels of one network are two sites. An address with no host has no
-- site. The site only joins two authors and never names one.
CREATE OR REPLACE FUNCTION site_of(p_uri text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE
    WHEN public.uri_host(p_uri) IS NULL THEN NULL
    WHEN public.uri_host(p_uri) IN ('t.me', 'telegram.me', 'vk.com', 'x.com', 'twitter.com',
                                    'facebook.com', 'instagram.com', 'tiktok.com')
    THEN public.uri_host(p_uri) || coalesce('/' || lower(
           substring(p_uri FROM '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]+/(?:s/)?@?([^/?#]+)')), '')
    ELSE public.uri_host(p_uri)
  END
$$;

-- THE WORDS OF A PASSAGE, in lower case, with no mark. The offsets of a citation count code points
-- of the stored page.
CREATE OR REPLACE FUNCTION passage_words(p_doc text, p_extractor text, p_page int, p_start int,
                                         p_end int)
RETURNS text[]
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(array(
    SELECT w FROM regexp_split_to_table(
      lower(regexp_replace(substr(t.text, p_start + 1, p_end - p_start), '[^[:alnum:]]+', ' ', 'g')),
      ' ') AS w
    WHERE w <> ''), '{}'::text[])
    FROM public.document_text t
   WHERE t.document_id = p_doc AND t.extractor = p_extractor AND t.page = p_page
$$;

-- TWO PASSAGES THAT SHARE A LONG RUN OF THE SAME WORDS. The length of the run is the parameter
-- `independence_shared_run_words`. A passage shorter than the run is compared whole, and a
-- passage with no word shares everything: when code is not sure, the two are one.
CREATE OR REPLACE FUNCTION passages_share_run(p_one text[], p_two text[]) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_run int;
BEGIN
  SELECT p.value::int INTO v_run FROM public.parameter p
   WHERE p.key = 'independence_shared_run_words';
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'the parameter independence_shared_run_words is absent, and no default stands';
  END IF;
  v_run := least(v_run, coalesce(cardinality(p_one), 0), coalesce(cardinality(p_two), 0));
  IF v_run = 0 THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
      FROM generate_series(1, cardinality(p_one) - v_run + 1) AS i
      JOIN generate_series(1, cardinality(p_two) - v_run + 1) AS j
        ON p_one[i:i + v_run - 1] = p_two[j:j + v_run - 1]);
END $$;

-- WHAT THE PROOF OF INDEPENDENCE READS IN A CITATION. The author is NULL when no worker answer
-- has resolved the name of the originator. The control is the controller of the author, or the
-- author itself when it has none, so an author and its controller share one control. Only an act
-- that states or enacts the fact counts as a source of it.
CREATE OR REPLACE FUNCTION citation_source(p_citation uuid)
RETURNS TABLE (author uuid, control text, site text, words text[], stating boolean)
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT a.id,
         coalesce(public.name_key(a.controller), a.name_key),
         public.site_of(d.uri),
         -- The words that the AI read from an image are the passage of that citation.
         CASE WHEN c.transcription IS NOT NULL
              THEN coalesce(array(
                     SELECT w FROM regexp_split_to_table(
                       lower(regexp_replace(c.transcription, '[^[:alnum:]]+', ' ', 'g')), ' ') AS w
                     WHERE w <> ''), '{}'::text[])
              ELSE public.passage_words(c.doc_id, c.text_extractor, c.page, c.start, c."end")
         END,
         c.modality IN ('enacts', 'asserts')
    FROM public.citation c
    JOIN public.proposals p ON p.id = c.claim_id
    JOIN public.documents d ON d.id = c.doc_id
    LEFT JOIN public.author a ON a.id = public.author_of(p.originator)
   WHERE c.id = p_citation
$$;

-- TWO CITATIONS OF ONE FACT ARE INDEPENDENT only when each one states or enacts the fact, and
-- they have different authors, different controllers, different sites, and passages that share
-- no long run of the same words. A citation that reports what another party says never counts.
-- WHEN CODE IS NOT SURE, THE TWO COUNT AS ONE AUTHOR: an author that no worker answer resolved, an
-- address with no site, or a passage that code cannot read all make the answer false. The digit
-- of a fact reads this answer, and no letter.
CREATE OR REPLACE FUNCTION citations_independent(p_one uuid, p_two uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce((
    SELECT coalesce(
             one.stating AND two.stating
             AND one.author IS NOT NULL AND two.author IS NOT NULL AND one.author <> two.author
             AND one.control <> two.control
             AND one.site IS NOT NULL AND two.site IS NOT NULL AND one.site <> two.site
             AND one.words IS NOT NULL AND two.words IS NOT NULL
             AND NOT public.passages_share_run(one.words, two.words),
             false)
      FROM public.citation_source(p_one) one, public.citation_source(p_two) two), false)
$$;

-- ================================================================== THE CHECK AND THE DIGIT ==
-- THE DOORS FOR THE CHECK BY A SECOND MODEL FAMILY. The check proves that the passage says the
-- fact, and never that the fact is true. The row names the family of the reader and the family of
-- the checker: a check by the same family does not pass. A check is written once for an act: a
-- second check of the same act changes nothing, and the first one stays. So a process that writes
-- the check again after a stop or a retry is safe. The row keeps the reason of a verdict that is
-- not `supported`, cut to the length that the table keeps.
--
-- EACH DOOR CHECKS THE ACTS OF ONE AUTHOR ROLE. The worker checks the acts of gabriel_agent, and
-- gabriel_checker checks the acts of gabriel_research. So the worker cannot check a research act,
-- and the research AI, which holds the research password, writes no check. The roles
-- give both family names, so the rules trust the processes (ADR 0012, trust boundary). The common
-- step holds no grant.
DROP FUNCTION IF EXISTS record_act_check(uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION store_act_check(p_act uuid, p_author_role text, p_checker_model text,
                                           p_checker_family text, p_reader_family text,
                                           p_verdict text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = p_act AND p.originator IS NOT NULL
                    AND p.author_role = p_author_role) THEN
    RAISE EXCEPTION 'a check of this door belongs to an act of a machine that % wrote', p_author_role
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.act_check (proposal_id, checker_model, checker_family, reader_family, verdict,
                                reason)
  VALUES (p_act, p_checker_model, p_checker_family, p_reader_family, p_verdict,
          CASE WHEN p_verdict = 'supported' OR btrim(coalesce(p_reason, '')) = '' THEN NULL
               ELSE left(p_reason, 1000) END)
  ON CONFLICT (proposal_id) DO NOTHING;
  -- The end of the check makes the units that share the fact go through the rules again.
  PERFORM public.run_rules(ARRAY(
    SELECT DISTINCT q.unit_id FROM public.proposals q
     WHERE q.status = 'pending'
       AND q.claim_key = (SELECT a.claim_key FROM public.proposals a WHERE a.id = p_act)));
END $$;

CREATE OR REPLACE FUNCTION record_act_check(p_act uuid, p_checker_model text,
                                            p_checker_family text, p_reader_family text,
                                            p_verdict text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.store_act_check(p_act, 'gabriel_agent', p_checker_model, p_checker_family,
                                p_reader_family, p_verdict, p_reason);
$$;

CREATE OR REPLACE FUNCTION record_research_check(p_act uuid, p_checker_model text,
                                                 p_checker_family text, p_reader_family text,
                                                 p_verdict text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.store_act_check(p_act, 'gabriel_research', p_checker_model, p_checker_family,
                                p_reader_family, p_verdict, p_reason);
$$;

-- THE TARGET OF THE VALUES OF AN ACT: the claim key of the entity that a new entity or a change of
-- attributes is about. Two acts with one target and one key with two values disagree. An act of
-- another operation gives no value.
CREATE OR REPLACE FUNCTION value_target(p_op text, p_claim_key text, p_target_id uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE p_op
           WHEN 'create_entity' THEN p_claim_key
           WHEN 'update_attrs' THEN public.claim_end_key(p_target_id::text)
         END
$$;

-- THE DIGIT OF A FACT, FROM ITS CITATIONS, ON EACH READ. A fact is a claim: the acts of a machine
-- with one claim key. A rejected act is no source. THE DIGIT READS NO LETTER (decisions.md S1):
-- it comes from the citations, the independence of their authors, controllers, sites and passages,
-- the conflicts between values, and the checks of the second model family. Code tries 5, 4, 1, 2,
-- 3 and 6.
--
--   none  no act of the fact has a passed check of a second model family;
--   5     a checker disputed an act of the fact (verdict not_supported; unclear is no dispute),
--         or a party to the conflict denies it;
--   4     another pending act gives a different value for the same attribute of the same target;
--   1     two citations are independent, and no conflict stands;
--   2     two known authors or more, and no pair of citations is proved independent;
--   3     one known author, even with many citations;
--   6     no citation has a known author.
--
-- Departure from ADR 0012: the check gates the digit before the rule 5, because a fact that no
-- check passed has no digit. A fact whose only check disputes it shows no digit, and its act is
-- disputed in the review queue already. The digit is not stored, so it never goes stale.
CREATE OR REPLACE FUNCTION fact_digit(p_claim_key text) RETURNS smallint
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_acts uuid[];
  v_stating uuid[];
  v_known int;
BEGIN
  SELECT array_agg(p.id) INTO v_acts
    FROM public.proposals p
   WHERE p.claim_key = p_claim_key AND p.status <> 'rejected' AND p.originator IS NOT NULL;
  IF v_acts IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.act_check k WHERE k.proposal_id = ANY (v_acts) AND k.passed)
  THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.act_check k
              WHERE k.proposal_id = ANY (v_acts) AND k.verdict = 'not_supported')
     OR EXISTS (SELECT 1
                  FROM public.citation c
                  JOIN public.proposals p ON p.id = c.claim_id
                  JOIN public.author a ON a.id = public.author_of(p.originator)
                 WHERE c.claim_id = ANY (v_acts) AND c.modality = 'denies' AND a.party)
  THEN
    RETURN 5;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.proposals a
      JOIN public.proposals q
        ON q.status = 'pending' AND q.id <> a.id
       AND public.value_target(a.op, a.claim_key, a.target_id) =
           public.value_target(q.op, q.claim_key, q.target_id)
      CROSS JOIN LATERAL jsonb_each(coalesce(a.payload->'attrs', '{}'::jsonb)) AS av
      CROSS JOIN LATERAL jsonb_each(coalesce(q.payload->'attrs', '{}'::jsonb)) AS qv
     WHERE a.id = ANY (v_acts) AND av.key = qv.key
       AND av.value->'v' IS DISTINCT FROM qv.value->'v')
  THEN
    RETURN 4;
  END IF;

  SELECT array_agg(c.id) INTO v_stating
    FROM public.citation c
   WHERE c.claim_id = ANY (v_acts) AND c.modality IN ('enacts', 'asserts');
  v_stating := coalesce(v_stating, '{}'::uuid[]);
  SELECT count(DISTINCT x.author) INTO v_known
    FROM unnest(v_stating) AS s(id)
   CROSS JOIN LATERAL public.citation_source(s.id) x
   WHERE x.author IS NOT NULL;

  IF EXISTS (SELECT 1 FROM unnest(v_stating) AS one(id), unnest(v_stating) AS two(id)
              WHERE one.id < two.id AND public.citations_independent(one.id, two.id)) THEN
    RETURN 1;
  END IF;
  IF v_known >= 2 THEN
    RETURN 2;
  END IF;
  IF v_known >= 1 THEN
    RETURN 3;
  END IF;
  RETURN 6;
END $$;

-- ============================================================================== THE NAMED RULES ==
-- THE UNITS WHOSE FACTS HAVE A SOURCE FROM ONE AUTHOR, pending ones only. A new letter of the
-- author, or a new name that joins it, makes these units go through the rules again. No role
-- holds this step.
CREATE OR REPLACE FUNCTION units_of_author(p_author uuid) RETURNS uuid[]
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT q.unit_id), '{}')
    FROM public.proposals q
   WHERE q.status = 'pending'
     AND q.claim_key IN (SELECT a.claim_key FROM public.proposals a
                          WHERE a.originator IS NOT NULL
                            AND public.author_of(a.originator) = p_author)
$$;

-- DOES A FACT HAVE ENOUGH SOURCE? Only an act with a passed check of a second model family is a
-- source here, because the check proves that its passage says the fact. The fact needs one source
-- with a letter as good as "single" and a known author, or two citations that code proves
-- independent (citations_independent), one with a letter as good as "pair" and the other as good
-- as "other". A letter is as good as another when it comes before it in the alphabet. The
-- independence is the proof of the digit: this function never compares two authors by itself. A
-- source counts only when it states or enacts the fact: one that denies it, or only reports what
-- another party says, is no support. The author of a source is the issuer of the record that it
-- cites, so a source A is a source A on its own record. No role holds this step.
CREATE OR REPLACE FUNCTION fact_is_strong(p_claim_key text, p_single text, p_pair text,
                                          p_other text)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH support AS (
    SELECT p.id, public.author_of(p.originator) AS author, public.letter_of(p.originator) AS letter
      FROM public.proposals p
     WHERE p.claim_key = p_claim_key AND p.status <> 'rejected' AND p.originator IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.act_check k WHERE k.proposal_id = p.id AND k.passed)
       AND EXISTS (SELECT 1 FROM public.citation c
                    WHERE c.claim_id = p.id AND c.modality IN ('enacts', 'asserts'))
       -- The checker reads only the words that the AI wrote from an image, and not the image. So
       -- such an act supports no fact until the operator compares the words with the image.
       AND NOT (p.status = 'pending'
                AND EXISTS (SELECT 1 FROM public.citation c
                             WHERE c.claim_id = p.id AND c.transcription IS NOT NULL))
  ), cited AS (
    SELECT c.id, s.letter FROM support s JOIN public.citation c ON c.claim_id = s.id
     WHERE s.author IS NOT NULL
  )
  SELECT EXISTS (SELECT 1 FROM support WHERE author IS NOT NULL AND letter <= p_single)
         OR EXISTS (SELECT 1 FROM cited one JOIN cited two ON one.id <> two.id
                     WHERE one.letter <= p_pair AND two.letter <= p_other
                       AND public.citations_independent(one.id, two.id))
$$;

-- THE UNITS THAT A JOB CAN FREE. The end of a deepening search, or the end of the extraction of a
-- page that a search stored, lets the rule judge the unit of that search again. The list is empty
-- for any other job. No role holds this step.
CREATE OR REPLACE FUNCTION units_of_job(p_job uuid) RETURNS uuid[]
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT d.unit_id), '{}')
    FROM public.deepening d
   WHERE d.job_id = p_job
      OR d.job_id IN (SELECT l.job_id FROM public.lead_document l
                        JOIN public.jobs j ON j.document_id = l.document_id
                       WHERE j.id = p_job)
$$;

-- THE DEEPENING SEARCH OF A UNIT. A unit with weak sources starts at most one lead, and only when
-- the operator has set a budget: at zero, nothing runs. The unit waits until each act of a machine
-- has its check, because a source is weak or strong only after the check. The lead carries the
-- budget as it stands now, and it states the acts that wait. No role holds this step; the unit is
-- locked by the caller, so two callers never start two searches.
CREATE OR REPLACE FUNCTION start_deepening(p_unit uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_tokens integer;
  v_lead   text;
  v_job    uuid;
BEGIN
  SELECT (c.settings->>'deepening_tokens')::integer INTO v_tokens
    FROM public.rule_config c WHERE c.rule = 'weak_sources';
  IF coalesce(v_tokens, 0) <= 0 OR EXISTS (SELECT 1 FROM public.deepening WHERE unit_id = p_unit)
  THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.proposals a
              WHERE a.unit_id = p_unit AND a.status = 'pending' AND a.originator IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM public.act_check k WHERE k.proposal_id = a.id)) THEN
    RETURN;
  END IF;
  SELECT left('Find a better source for these acts: ' ||
              string_agg(a.op || ' ' || a.payload::text, '; ' ORDER BY a.id), 1900)
    INTO v_lead
    FROM public.proposals a WHERE a.unit_id = p_unit AND a.status = 'pending';
  INSERT INTO public.jobs (kind, lead, lead_by, token_budget)
  VALUES ('research_lead', v_lead, 'rule weak_sources', v_tokens)
  RETURNING id INTO v_job;
  INSERT INTO public.deepening (unit_id, job_id) VALUES (p_unit, v_job);
END $$;

-- IS THE SEARCH OVER AND THE UNIT STILL WEAK? The search is over when its lead ended well (done)
-- and no extraction of a page that it stored is open. A search that stops at its budget ends well:
-- the budget is its one stop, so it counts as a search that found no new source. A lead that failed
-- for another reason did not finish its search, so it never rejects. The unit is weak when it has
-- sources, and each one has a letter D or E. A source whose check did not pass is no source here.
-- An author with no letter counts as F, so such a unit is kept, because a letter can come later. A
-- fact with no passed check is not judged, so a unit with such a fact is kept. A claim that a rule
-- rejected is not "rejected before": a later source can change a weak verdict. No role holds this
-- step.
CREATE OR REPLACE FUNCTION rejected_after_search(p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.deepening d JOIN public.jobs j ON j.id = d.job_id
                  WHERE d.unit_id = p_unit AND j.status = 'done')
     AND NOT EXISTS (SELECT 1 FROM public.deepening d
                       JOIN public.lead_document l ON l.job_id = d.job_id
                       JOIN public.jobs e ON e.document_id = l.document_id
                      WHERE d.unit_id = p_unit AND e.status IN ('queued', 'running'))
     AND NOT EXISTS (SELECT 1 FROM public.proposals a
                      WHERE a.unit_id = p_unit AND a.status = 'pending' AND a.claim_key IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM public.proposals f
                                          JOIN public.act_check k ON k.proposal_id = f.id AND k.passed
                                         WHERE f.claim_key = a.claim_key AND f.status <> 'rejected'
                                           AND f.originator IS NOT NULL))
     AND coalesce((
       SELECT bool_and(s.letter IN ('D', 'E'))
         FROM (SELECT DISTINCT public.letter_of(f.originator) AS letter
                 FROM public.proposals a
                 JOIN public.proposals f ON f.claim_key = a.claim_key AND f.status <> 'rejected'
                                        AND f.originator IS NOT NULL
                WHERE a.unit_id = p_unit AND a.status = 'pending' AND a.claim_key IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.act_check k
                               WHERE k.proposal_id = f.id AND k.passed)) AS s),
       false)
$$;

-- THE DECISION OF A RULE ON ONE UNIT. The impossible rule rejects the unit, and the strong rule
-- writes it. The weak rule rejects a unit only after its deepening search, when every source is
-- D or E. Any other case leaves the unit as it is. It gives the name of the rule that
-- decided, or NULL. The origin of the decision names the rule, its version and the inputs that it
-- read: the digit of each fact. A write that the record refuses leaves the unit as it is, so a
-- rule never stops the act that called it. No role holds this step: only the doors that write an
-- act, a letter or a check call it, so no machine can decide in place of a rule.
CREATE OR REPLACE FUNCTION apply_rules(p_unit uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_rule   text;
  v_by     text;
  v_digits text;
  v_origin text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE unit_id = p_unit AND status = 'pending') THEN
    RETURN NULL;
  END IF;
  PERFORM public.pending_unit(p_unit);
  v_rule := public.unit_rule(p_unit);
  -- A unit with weak sources starts its one deepening search. It is rejected only after that
  -- search, and only when every source is D or E. Any other unit waits.
  IF v_rule = 'weak_sources' AND NOT public.rejected_after_search(p_unit) THEN
    PERFORM public.start_deepening(p_unit);
    RETURN NULL;
  END IF;
  IF v_rule NOT IN ('impossible', 'strong_sources', 'weak_sources') THEN
    RETURN NULL;
  END IF;
  SELECT 'rule ' || c.rule || ' v' || c.version INTO v_by
    FROM public.rule_config c WHERE c.rule = v_rule;
  SELECT string_agg(d.digit, ', ' ORDER BY d.digit) INTO v_digits
    FROM (SELECT DISTINCT coalesce(public.fact_digit(a.claim_key)::text, 'none') AS digit
            FROM public.proposals a
           WHERE a.unit_id = p_unit AND a.status = 'pending' AND a.claim_key IS NOT NULL) AS d;
  v_origin := v_by || ' (fact digits: ' || coalesce(v_digits, 'no fact') || ')';
  IF v_rule IN ('impossible', 'weak_sources') THEN
    UPDATE public.proposals p
       SET status = 'rejected', decided_at = now(), decided_by = v_by, decided_as = 'rule',
           decision_origin = v_origin,
           reject_reason = CASE WHEN v_rule = 'impossible' AND public.end_was_rejected(p.op, p.payload)
                                THEN 'end_rejected' ELSE 'other' END,
           reject_note = CASE WHEN v_rule = 'weak_sources'
                              THEN 'weak sources: after a deepening search, every source of the '
                                   'facts is rated D or E'
                              WHEN public.end_was_rejected(p.op, p.payload) THEN NULL
                              ELSE 'impossible: the unit links an element to itself, or to an '
                                   'element that was rejected' END
     WHERE p.unit_id = p_unit AND p.status = 'pending';
    RETURN v_rule;
  END IF;
  BEGIN
    PERFORM public.write_unit_as(p_unit, v_by, 'rule', v_origin);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'the record refused the unit %, and it waits: %', p_unit, SQLERRM;
    RETURN NULL;
  END;
  RETURN v_rule;
END $$;

-- THE RULES ON A LIST OF UNITS. A unit that a rule decides can free a unit that waited for it, such
-- as a child that waited for its parent, so the list goes again with the pending units of the same
-- groups until a pass decides nothing. No role holds this step.
CREATE OR REPLACE FUNCTION run_rules(p_units uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_todo uuid[] := ARRAY(SELECT DISTINCT u FROM unnest(p_units) AS t(u) WHERE u IS NOT NULL);
  v_done uuid[];
  v_unit uuid;
BEGIN
  LOOP
    v_done := '{}';
    FOREACH v_unit IN ARRAY v_todo LOOP
      IF public.apply_rules(v_unit) IS NOT NULL THEN
        v_done := v_done || v_unit;
      END IF;
    END LOOP;
    EXIT WHEN cardinality(v_done) = 0;
    v_todo := ARRAY(
      SELECT x FROM unnest(v_todo) AS t(x) WHERE NOT x = ANY (v_done)
      UNION
      SELECT q.unit_id FROM public.proposals q
       WHERE q.status = 'pending'
         AND q.batch_id IN (SELECT w.batch_id FROM public.proposals w
                             WHERE w.unit_id = ANY (v_done) AND w.batch_id IS NOT NULL));
  END LOOP;
END $$;

-- A BUDGET THAT RISES FROM ZERO FREES THE UNITS THAT WAIT. At zero no search ran, so every unit with
-- weak sources waited without one. When the operator sets a budget, each pending unit goes
-- through the rules again, and a weak one starts its search. A change from one budget to another
-- starts nothing by itself: the searches that ran stay, and a new unit uses the new budget. No
-- role holds this step: the update of the setting fires it.
CREATE OR REPLACE FUNCTION rerun_on_budget() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF coalesce((OLD.settings->>'deepening_tokens')::integer, 0) <= 0
     AND coalesce((NEW.settings->>'deepening_tokens')::integer, 0) > 0
  THEN
    PERFORM public.run_rules(ARRAY(
      SELECT DISTINCT q.unit_id FROM public.proposals q WHERE q.status = 'pending'));
  END IF;
  RETURN NULL;
END $$;

RESET ROLE;
