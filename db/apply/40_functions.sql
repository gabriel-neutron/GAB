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
  IF session_user NOT IN ('gabriel_agent','gabriel_app') THEN
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
      NEW.confidence, NEW.dissent, NEW.author_role, NEW.xact, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.op, OLD.target_kind, OLD.target_id, OLD.payload, OLD.src, OLD.names,
      OLD.confidence, OLD.dissent, OLD.author_role, OLD.xact, OLD.created_at) THEN
    RAISE EXCEPTION 'a proposal is frozen at the insert';
  END IF;
  RETURN NEW;
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


-- ================================================================================ THE DOORS ==
-- Eight functions, and no role holds INSERT, UPDATE or DELETE on any table.

-- P6, one ingestion door. The object goes to the store first, the row records it, and the job
-- is queued IN THE SAME TRANSACTION: a document row with no queued work is invisible to search,
-- to the agents and to the interface, and a queued job with no document row names nothing.
CREATE OR REPLACE FUNCTION put_document(
  p_id           text,
  p_kind         text,
  p_title        text,
  p_s3_key       text DEFAULT NULL,
  p_uri          text DEFAULT NULL,
  p_archive_uri  text DEFAULT NULL,
  p_sha256       text DEFAULT NULL,
  p_mime         text DEFAULT NULL,
  p_retrieved_at date DEFAULT NULL)
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
    (id, kind, title, s3_key, uri, archive_uri, sha256, mime, retrieved_at)
  VALUES
    (p_id::doc_id, p_kind, p_title, p_s3_key, p_uri, p_archive_uri, p_sha256, p_mime,
     p_retrieved_at)
  RETURNING id INTO v_id;

  -- The queue takes the identifier and nothing else. What the work IS stays undecided: P6 puts
  -- two paths behind this door, and no rule says which file takes which one.
  --
  -- A HAND-ENTERED SOURCE IS THE ONE EXCEPTION, and it is a rule of this line alone. A `manual`
  -- row carries no file and no address, so an agent would have nothing to read and the queue
  -- holds no row for it. The queue is therefore not the whole record of what passed the door.
  --
  -- THE DATE IS NOT WHAT DECIDES IT. Since migration 0011 the retrieval date is demanded of the
  -- BYTES and not of the kind (doc_retrieved_with_bytes), so a `url` row with no date is a
  -- lawful row that names an address nobody has read yet. Such a row DOES earn a job.
  INSERT INTO public.jobs (document_id)
  SELECT v_id::doc_id WHERE p_kind <> 'manual';

  RETURN v_id;
  -- It writes NO rating, and no role can write those columns. The scoring write path is decided,
  -- a rate_document act, and it is built with the first caller that scores a document.
END $$;

-- The candidate layer. gabriel_agent and gabriel_app may call it. The author role is stamped by
-- a trigger and is never a parameter.
CREATE OR REPLACE FUNCTION propose_change(
  p_op          text,
  p_payload     jsonb,
  p_src         text[],
  p_target_kind text    DEFAULT NULL,
  p_target_id   uuid    DEFAULT NULL,
  p_names       uuid[]  DEFAULT '{}',
  p_confidence  numeric DEFAULT NULL,
  p_dissent     boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.proposals
    (op, target_kind, target_id, payload, src, names, confidence, dissent, author_role)
  VALUES
    (p_op, p_target_kind, p_target_id, p_payload, p_src::doc_id[],
     coalesce(p_names, '{}'::uuid[]), p_confidence, coalesce(p_dissent, false),
     session_user)          -- overwritten by the stamp trigger; a value is needed for NOT NULL
  RETURNING id INTO v_id;
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
    INSERT INTO public.entities
      (type, proposed_type, label, geom, attrs, sources, promoted_from)
    VALUES (
      coalesce(v_type, 'unknown'),
      CASE WHEN v_type IS NULL THEN p.payload->>'type' END,
      p.payload->>'label',
      CASE WHEN p.payload ? 'geom'
           THEN public.ST_SetSRID(public.ST_GeomFromGeoJSON(p.payload->'geom'), 4326) END,
      coalesce(p.payload->'attrs', '{}'::jsonb),
      p.src,
      p.id)
    RETURNING id INTO v_id;

  ELSIF p.op = 'create_relation' THEN
    INSERT INTO public.relations
      (type, src_kind, src_id, dst_kind, dst_id, valid_from, valid_to, attrs, sources,
       promoted_from)
    VALUES (
      p.payload->>'type',
      coalesce(p.payload->>'src_kind','entity'), (p.payload->>'src_id')::uuid,
      coalesce(p.payload->>'dst_kind','entity'), (p.payload->>'dst_id')::uuid,
      (p.payload->>'valid_from')::date, (p.payload->>'valid_to')::date,
      coalesce(p.payload->'attrs', '{}'::jsonb),
      p.src,
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
    -- The row-level `sources` list is NOT extended here. It is the evidence that the thing is
    -- real, written by the creating act. #86 is open on what the two lists assert.
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
-- IT TAKES NO NAME. The taker is stamped from session_user by a trigger, because a label the
-- caller supplies proves nothing about who holds the row. The earlier signature is dropped
-- here: a re-runnable file that only replaces would leave the two side by side.
DROP FUNCTION IF EXISTS claim_job(text);
CREATE OR REPLACE FUNCTION claim_job()
RETURNS TABLE (job_id uuid, job_document doc_id, job_attempts int)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  SELECT j.id INTO v_id
    FROM public.jobs j
   WHERE j.status = 'queued'
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
  RETURNING j.id, j.document_id, j.attempts
       INTO job_id, job_document, job_attempts;

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
