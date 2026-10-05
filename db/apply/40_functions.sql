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

-- Departure: no table describes a key. `api.key_usage` counts each key in use, and that view is
-- the whole of M11's mitigation: it shows the drift, and it does not prevent it. The cost is
-- that `coal_stock`, `coal_stock_t` and `coal_stock_tonnes` can stand on one type, all valid.

-- External constraint: this file runs again at each apply, so the drop below removes the old
-- vocabulary functions from a database that still holds them.
DROP FUNCTION IF EXISTS attrs_gate() CASCADE;
DROP FUNCTION IF EXISTS proposals_vocabulary_gate() CASCADE;
DROP FUNCTION IF EXISTS attrs_declared(jsonb);


-- ============================================================================== THE WITNESS ==
-- current_user inside a SECURITY DEFINER function is the OWNER, never the caller. session_user
-- is the caller. It separates gabriel_agent from gabriel_app, and it CANNOT separate the
-- operator from the backend, because both hold the name gabriel_app.
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
      NEW.confidence, NEW.dissent, NEW.author_role, NEW.xact, NEW.created_at,
      NEW.model_call_id, NEW.idempotency_key)
     IS DISTINCT FROM
     (OLD.id, OLD.op, OLD.target_kind, OLD.target_id, OLD.payload, OLD.src, OLD.names,
      OLD.confidence, OLD.dissent, OLD.author_role, OLD.xact, OLD.created_at,
      OLD.model_call_id, OLD.idempotency_key) THEN
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

-- A MESSAGE ROW IS A FACT AND NOT A STATE: it is written once. The owner and the superuser
-- ignore a grant, so a trigger holds it.
CREATE OR REPLACE FUNCTION chat_message_append_only_fn() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'a row of % is never %. It is the record of what was said',
    TG_TABLE_NAME, CASE TG_OP WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
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
    RAISE EXCEPTION 'src % (%) does not exist', NEW.src_id, NEW.src_kind
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.dst_kind = 'entity'
    THEN PERFORM 1 FROM public.entities  WHERE id = NEW.dst_id FOR KEY SHARE;
    ELSE PERFORM 1 FROM public.relations WHERE id = NEW.dst_id FOR KEY SHARE;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dst % (%) does not exist', NEW.dst_id, NEW.dst_kind
      USING ERRCODE = 'foreign_key_violation';
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
    RAISE EXCEPTION 'a relation of type % takes no interval', NEW.type
      USING ERRCODE = 'check_violation', CONSTRAINT = 'rel_dates_scope',
            TABLE = 'relations', SCHEMA = 'public';
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
-- The earlier signature is dropped here: a re-runnable file that only replaces would leave the
-- two side by side, and a call with nine arguments would then be ambiguous.
DROP FUNCTION IF EXISTS put_document(text,text,text,text,text,text,text,text,date);
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
  p_provider_id  text DEFAULT NULL)
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
    (id, kind, title, s3_key, uri, archive_uri, sha256, mime, retrieved_at, provider_id)
  VALUES
    (p_id::doc_id, p_kind, p_title, p_s3_key, p_uri, p_archive_uri, p_sha256, p_mime,
     p_retrieved_at, p_provider_id)
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
  -- It writes NO rating, and no role can write those columns. The scoring write path is decided,
  -- a rate_document act, and it is built with the first caller that scores a document.
END $$;

-- The candidate layer. gabriel_agent and gabriel_app may call it. The author role is stamped by
-- a trigger and is never a parameter. The call id is the last parameter and it is optional: a
-- proposal of gabriel_agent must carry one and a proposal of gabriel_app must carry none, and
-- the database holds both rules, so this door states neither.
--
-- The earlier signatures are dropped here: a re-runnable file that only replaces would leave them
-- side by side, and a call with fewer arguments would then be ambiguous.
--
-- THE KEY MAKES A SECOND WRITE OF ONE ACT RETURN THE FIRST. A job that runs again after its lease
-- ended writes the same act with the same key, and the door then returns the proposal that stands
-- and writes nothing.
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean);
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid);
DROP FUNCTION IF EXISTS propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text,uuid);
CREATE OR REPLACE FUNCTION propose_change(
  p_op              text,
  p_payload         jsonb,
  p_src             text[],
  p_target_kind     text    DEFAULT NULL,
  p_target_id       uuid    DEFAULT NULL,
  p_names           uuid[]  DEFAULT '{}',
  p_confidence      numeric DEFAULT NULL,
  p_dissent         boolean DEFAULT false,
  p_model_call_id   uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.proposals
    (op, target_kind, target_id, payload, src, names, confidence, dissent, author_role,
     model_call_id, idempotency_key)
  VALUES
    (p_op, p_target_kind, p_target_id, p_payload, p_src::doc_id[],
     coalesce(p_names, '{}'::uuid[]), p_confidence, coalesce(p_dissent, false),
     session_user,          -- overwritten by the stamp trigger; a value is needed for NOT NULL
     p_model_call_id, p_idempotency_key)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  -- The conflict is the only way to get no row, so the key is set here.
  IF v_id IS NULL THEN
    SELECT p.id INTO STRICT v_id FROM public.proposals p WHERE p.idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
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

-- THE TWO DOORS INTO THE CONVERSATION STORE. gabriel_app alone holds them, and no role writes
-- the three tables by hand. A blank title or a blank text is refused by the table, and a missing
-- anchor row is refused by its foreign key.
CREATE OR REPLACE FUNCTION open_conversation(
  p_title        text,
  p_anchor_kind  text DEFAULT NULL,
  p_anchor_id    uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF (p_anchor_kind IS NULL) <> (p_anchor_id IS NULL)
     OR p_anchor_kind NOT IN ('entity','relation') THEN
    RAISE EXCEPTION 'an anchor is a kind, entity or relation, with its id, or it is neither'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.conversation (title, anchor_entity_id, anchor_relation_id)
  VALUES (p_title,
          CASE p_anchor_kind WHEN 'entity'   THEN p_anchor_id END,
          CASE p_anchor_kind WHEN 'relation' THEN p_anchor_id END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- A message and its citations are one write. p_citations is a jsonb array of objects with the
-- keys kind, id and excerpt, and no other key. The kind is document, entity, relation or
-- proposal. The door sets the one foreign key that matches the kind, so a row that does not
-- exist refuses the whole message.
CREATE OR REPLACE FUNCTION append_chat_message(
  p_conversation_id uuid,
  p_role            text,
  p_text            text,
  p_model_call_id   uuid  DEFAULT NULL,
  p_citations       jsonb DEFAULT '[]')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id    uuid;
  v_cite  jsonb;
  v_kind  text;
  v_key   text;
BEGIN
  p_citations := coalesce(p_citations, '[]'::jsonb);
  IF jsonb_typeof(p_citations) <> 'array' THEN
    RAISE EXCEPTION 'the citations are an array' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.chat_message (conversation_id, role, text, model_call_id)
  VALUES (p_conversation_id, p_role, p_text, p_model_call_id)
  RETURNING id INTO v_id;

  FOR v_cite IN SELECT value FROM jsonb_array_elements(p_citations) LOOP
    IF jsonb_typeof(v_cite) <> 'object' THEN
      RAISE EXCEPTION 'a citation is an object' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(v_cite) LOOP
      IF v_key NOT IN ('kind','id','excerpt') THEN
        RAISE EXCEPTION 'a citation holds the keys kind, id and excerpt, and not %', v_key
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END LOOP;
    IF jsonb_typeof(v_cite -> 'kind') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_cite -> 'id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(coalesce(v_cite -> 'excerpt', '""'::jsonb)) <> 'string' THEN
      RAISE EXCEPTION 'a citation names a kind and an id, and its excerpt is text'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_kind := v_cite ->> 'kind';
    IF v_kind NOT IN ('document','entity','relation','proposal') THEN
      RAISE EXCEPTION 'a citation kind is document, entity, relation or proposal, and not %',
        v_kind USING ERRCODE = 'invalid_parameter_value';
    END IF;

    INSERT INTO public.chat_citation
      (message_id, document_id, entity_id, relation_id, proposal_id, excerpt)
    VALUES
      (v_id,
       CASE v_kind WHEN 'document' THEN v_cite ->> 'id' END,
       CASE v_kind WHEN 'entity'   THEN (v_cite ->> 'id')::uuid END,
       CASE v_kind WHEN 'relation' THEN (v_cite ->> 'id')::uuid END,
       CASE v_kind WHEN 'proposal' THEN (v_cite ->> 'id')::uuid END,
       v_cite ->> 'excerpt');
  END LOOP;
  RETURN v_id;
END $$;

-- THE ONE DOOR INTO THE EVIDENTIARY LAYER. It encodes no rule about WHO may call it, so this
-- file stays neutral on #42.
CREATE OR REPLACE FUNCTION promote_proposal(p_id uuid, p_decided_by text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  p       public.proposals%ROWTYPE;
  v_id    uuid;
  v_old   jsonb;
  v_prior jsonb;
  v_lost  text;
  v_type  text;
BEGIN
  IF p_decided_by IS NULL OR btrim(p_decided_by, E' \t\n\r\f\v') = '' THEN
    RAISE EXCEPTION 'a decision names who took it';
  END IF;

  -- FOR UPDATE closes the concurrent replay; the status test closes the serial one. #17 (a).
  SELECT * INTO p FROM public.proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal % does not exist', p_id;
  END IF;
  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'proposal % is %, and only a pending proposal is applied', p_id, p.status;
  END IF;

  -- The measured forgery: propose and accept inside one transaction. Refused by a stored
  -- column, so the legitimate shape — proposed now, decided later — still passes.
  IF p.xact = pg_current_xact_id() THEN
    RAISE EXCEPTION 'proposal % was written by this transaction, and an act is not decided by '
                    'the transaction that proposed it', p_id
      USING ERRCODE = 'insufficient_privilege';
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
    INSERT INTO public.entities
      (type, proposed_type, label, geom, attrs, sources, promoted_from)
    VALUES (
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
      (type, proposed_type, src_kind, src_id, dst_kind, dst_id, valid_from, valid_to, attrs,
       sources, promoted_from)
    VALUES (
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
      RAISE EXCEPTION 'the target % no longer exists, and nothing was applied', p.target_id;
    END IF;

    -- S2: the src of an attribute backs that one value alone. A changed value may cite new
    -- sources alone, and prior_value keeps the old claim. A kept value that dropped a document
    -- would lose corroboration, so it is refused. jsonb equality reads 41200.0 as 41200.
    SELECT string_agg(n.k, ', ' ORDER BY n.k) INTO v_lost
      FROM jsonb_each(coalesce(p.payload->'attrs','{}'::jsonb)) AS n(k, val)
     WHERE v_old ? n.k
       AND v_old->n.k->'v' = n.val->'v'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_old->n.k->'src') AS o(doc)
                    WHERE NOT ((n.val->'src') @> to_jsonb(o.doc)));
    IF v_lost IS NOT NULL THEN
      RAISE EXCEPTION 'the write keeps the value of % and drops a document from the sources of '
                      'that value', v_lost;
    END IF;

    -- ONLY THE KEYS THE ACT NAMED. A whole-row copy would freeze and republish every other
    -- key, and api.proposal publishes the copy.
    SELECT jsonb_object_agg(ok.k, v_old -> ok.k) INTO v_prior
      FROM jsonb_object_keys(coalesce(p.payload->'attrs','{}'::jsonb)) AS ok(k)
     WHERE v_old ? ok.k;

    IF p.target_kind = 'entity' THEN
      UPDATE public.entities
         SET attrs = attrs || coalesce(p.payload->'attrs','{}'::jsonb), updated_at = now()
       WHERE id = p.target_id;
    ELSE
      UPDATE public.relations
         SET attrs = attrs || coalesce(p.payload->'attrs','{}'::jsonb), updated_at = now()
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
      RAISE EXCEPTION 'the target % no longer exists, and nothing was applied', p.target_id;
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
      RAISE EXCEPTION 'the act changes neither the name nor the type of %, and nothing was '
                      'applied', p.target_id;
    END IF;
    v_id := p.target_id;

  -- ------------------------------------------------------------------------------ deletes --
  ELSIF p.op IN ('delete_entity','delete_relation') THEN
    IF p.target_kind = 'entity' THEN
      SELECT to_jsonb(e) INTO v_prior FROM public.entities e WHERE id = p.target_id FOR UPDATE;
      IF v_prior IS NULL THEN
        RAISE EXCEPTION 'the target % no longer exists, and nothing was applied', p.target_id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.relations r
                  WHERE (r.src_kind = 'entity' AND r.src_id = p.target_id)
                     OR (r.dst_kind = 'entity' AND r.dst_id = p.target_id)) THEN
        RAISE EXCEPTION 'entity % is an endpoint of a relation, and it is not deleted',
                        p.target_id;
      END IF;
      DELETE FROM public.entities WHERE id = p.target_id;
    ELSE
      SELECT to_jsonb(r) INTO v_prior FROM public.relations r WHERE id = p.target_id FOR UPDATE;
      IF v_prior IS NULL THEN
        RAISE EXCEPTION 'the target % no longer exists, and nothing was applied', p.target_id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.relations r
                  WHERE (r.src_kind = 'relation' AND r.src_id = p.target_id)
                     OR (r.dst_kind = 'relation' AND r.dst_id = p.target_id)) THEN
        RAISE EXCEPTION 'relation % is an endpoint of a relation, and it is not deleted',
                        p.target_id;
      END IF;
      DELETE FROM public.relations WHERE id = p.target_id;
    END IF;
    v_id := p.target_id;

  ELSE
    -- M12 makes a merge reversible through an alias table and a full snapshot. Neither table
    -- exists, so a merge cannot land, and it must not half-land.
    RAISE EXCEPTION 'the operation % has no write path yet. M12 needs an alias table and a '
                    'snapshot before a merge can be undone', p.op;
  END IF;

  UPDATE public.proposals
     SET status      = 'accepted',
         decided_at  = now(),
         decided_by  = p_decided_by,
         prior_value = v_prior
   WHERE id = p_id AND status = 'pending';

  RETURN v_id;
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
    RAISE EXCEPTION 'a decision names who took it';
  END IF;
  UPDATE public.proposals
     SET status = 'rejected', decided_at = now(), decided_by = p_decided_by
   WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_id) THEN
      RAISE EXCEPTION 'proposal % does not exist', p_id;
    END IF;
    RAISE EXCEPTION 'proposal % is not pending, and a decided act is frozen', p_id;
  END IF;
END $$;


-- THE CLAIM. It is a door and not a table write, because no role holds UPDATE on any table, and
-- a worker that could write `jobs` directly could also write it into a state no claim produced.
--
-- SKIP LOCKED IS THE WHOLE MECHANISM. The row is locked for the length of the caller's
-- transaction, so a second worker walks past it instead of waiting behind it. Ordinary FOR
-- UPDATE would serialise every worker on the oldest row and give one queue with one throat.
--
-- IT COUNTS THE ATTEMPT AND ENFORCES NO LIMIT. The caller that ends a failed job reads the count,
-- so this door refuses no claim on a count.
--
-- IT TAKES A WORK KIND AND NEVER A `store_only` ROW. The kind goes back to the caller, because
-- the runner that routes the row has to know which path it takes.
--
-- IT TAKES NO NAME. The taker is stamped from session_user by a trigger, because a label the
-- caller supplies proves nothing about who holds the row. The earlier signature is dropped
-- here: a re-runnable file that only replaces would leave the two side by side.
DROP FUNCTION IF EXISTS claim_job(text);
DROP FUNCTION IF EXISTS claim_job();
CREATE OR REPLACE FUNCTION claim_job()
RETURNS TABLE (job_id uuid, job_document doc_id, job_attempts int, job_kind text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT j.id INTO v_id
    FROM public.jobs j
   WHERE j.status = 'queued' AND j.kind IN ('extract_text','map_structured')
   ORDER BY j.created_at, j.id
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- An empty queue is not a failure. The caller gets no row and waits.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.jobs j
     SET status     = 'running',
         attempts   = j.attempts + 1,
         claimed_at = now(),
         updated_at = now()
   WHERE j.id = v_id
  RETURNING j.id, j.document_id, j.attempts, j.kind
       INTO job_id, job_document, job_attempts, job_kind;

  RETURN NEXT;
END $$;


-- THE WAY BACK. Without it a worker that stops between the claim and the work holds its row for
-- ever, and the queue delivers at most once.
--
-- THE ATTEMPT IS SPENT. The claim counted it at the hour it took the row, and nothing here
-- rewrites a count that is already written.
--
-- THE LEASE IS A ROW AND NOT A NUMBER IN THIS FILE, and STRICT is the point: an absent lease
-- stops the release loudly instead of releasing every running row or none of them.
CREATE OR REPLACE FUNCTION release_expired_claims()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_lease    interval;
  v_released int;
BEGIN
  SELECT make_interval(secs => p.value::double precision) INTO STRICT v_lease
    FROM public.parameter p WHERE p.key = 'job_claim_lease_seconds';

  UPDATE public.jobs j
     SET status     = 'queued',
         claimed_at = NULL,
         updated_at = now()
   WHERE j.status = 'running'
     AND j.claimed_at + v_lease < now();

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END $$;


-- THE WAY BACK FOR A QUOTA THAT IS SPENT. A quota pause fails no job and spends no attempt, so the
-- row returns to `queued` with the count it had before the claim, and the next claim counts the
-- attempt again.
--
-- THE COUNT NEVER FALLS BELOW THE FAILURES THE ROW HOLDS. jobs_failures_within_attempts says that
-- the failures never pass the attempts, and a row that already holds a failure of each claim
-- would break it. GREATEST keeps the check true, and the attempt is then not given back: the
-- failures are a record of claims that ran, so those claims did spend their attempts.
--
-- ONLY A RUNNING ROW GOES BACK. A row that ended or never ran has no claim to release.
CREATE OR REPLACE FUNCTION release_job_for_quota(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.jobs j
     SET status     = 'queued',
         attempts   = GREATEST(j.attempts - 1, j.network_failures + j.rejected_failures),
         claimed_at = NULL,
         updated_at = now()
   WHERE j.id = p_id AND j.status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running, and only a running job goes back for quota', p_id;
  END IF;
END $$;

-- THE THREE NUMBERS THAT THE RUNNER READS, AS ONE STRICT READ. The lease, the wait on a spent quota
-- and the wait on an empty queue are rows, and a row that is absent stops the runner loudly. A
-- default here would let a runner start with a lease that nobody chose. The door returns these
-- three and no other row of the table.
CREATE OR REPLACE FUNCTION runner_settings()
RETURNS TABLE (lease_seconds double precision, quota_wait_seconds double precision,
               empty_wait_seconds double precision)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_key text;
  v_value double precision;
BEGIN
  FOREACH v_key IN ARRAY ARRAY['job_claim_lease_seconds','runner_quota_wait_seconds',
                               'runner_empty_wait_seconds'] LOOP
    SELECT p.value::double precision INTO v_value FROM public.parameter p WHERE p.key = v_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'the parameter % is absent, and the runner reads no default', v_key;
    END IF;
    IF v_key = 'job_claim_lease_seconds' THEN lease_seconds := v_value;
    ELSIF v_key = 'runner_quota_wait_seconds' THEN quota_wait_seconds := v_value;
    ELSE empty_wait_seconds := v_value;
    END IF;
  END LOOP;
  RETURN NEXT;
END $$;

-- THE END OF A JOB THAT FAILED. Without it a job that fails on each claim returns to the queue
-- for ever, and the operator sees no reason.
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
-- callers at one instant, which a check made here could not.
CREATE OR REPLACE FUNCTION enqueue_job(p_document text, p_kind text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_id    uuid;
  v_bytes text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('extract_text','map_structured') THEN
    RAISE EXCEPTION 'a job asks for extract_text or map_structured, and this one asked for %',
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

  INSERT INTO public.jobs (document_id, kind) VALUES (p_document::doc_id, p_kind)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

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

-- THE END OF A JOB THAT SUCCEEDED. Only a running row ends, so a row that nobody claimed cannot
-- be marked done by hand.
CREATE OR REPLACE FUNCTION complete_job(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.jobs
     SET status = 'done', finished_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % is not running, and only a running job completes', p_id;
  END IF;
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
-- T4 and docs/spec.md §4: complex read logic lives in a SQL function and never in the client.
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
