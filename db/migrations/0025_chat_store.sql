-- =============================================================================================
-- 0025 — a conversation, its messages and their citations are stored                   ORDERED
--
-- A CHAT ANSWER WITH NO STORED CITATION IS THE ONE SURFACE WITH NO PROVENANCE. The analyst asks
-- which registries a firm used, the answer cites two documents and one relation, and a week
-- later the same answer must show the same citations. These three tables hold that. They add no
-- column to a core table, and they carry no project_id.
--
-- THE CONVERSATIONS ARE PRIVATE, AND THE RESULTS ARE PUBLIC. The tables are in public, and the
-- read role holds no USAGE on public, so the public API cannot reach them. No api view shows
-- them. The writer reads them as gabriel_app, which holds SELECT on the three tables and no
-- write grant. A second schema would break the audit arms, which read public.
--
-- NO ROLE WRITES THESE TABLES. open_conversation and append_chat_message are the two doors, and
-- gabriel_app alone holds them. The append door writes a message and its citations in one
-- transaction, so a citation that names no row refuses the whole message.
--
-- A MESSAGE ROW IS A FACT AND IS NEVER UPDATED OR DELETED. A trigger holds it, because the owner
-- and the superuser ignore a grant. Every foreign key is RESTRICT.
--
-- AN ASSISTANT MESSAGE NAMES THE MODEL CALL THAT MADE IT, AND NO OTHER MESSAGE DOES. The check
-- is an equality of two booleans, so a NULL cannot pass it.
--
-- A CITATION NAMES ONE REAL ROW. It has four nullable foreign keys, and exactly one is set. The
-- kind is the key that is set, so the table holds no kind column that could disagree with it.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE conversation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A project chat has no anchor. At most one of the two keys is set.
  anchor_entity_id    uuid
                      CONSTRAINT conversation_anchor_entity_fkey REFERENCES entities(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  anchor_relation_id  uuid
                      CONSTRAINT conversation_anchor_relation_fkey REFERENCES relations(id)
                      ON UPDATE RESTRICT ON DELETE RESTRICT,
  title               text NOT NULL CHECK (btrim(title, E' \t\n\r\f\v') <> ''),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_one_anchor
    CHECK (num_nonnulls(anchor_entity_id, anchor_relation_id) <= 1)
);

CREATE TABLE chat_message (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL
                   CONSTRAINT chat_message_conversation_fkey REFERENCES conversation(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  role             text NOT NULL CHECK (role IN ('user','assistant','tool')),
  body             text NOT NULL CHECK (btrim(body, E' \t\n\r\f\v') <> ''),
  model_call_id    uuid
                   CONSTRAINT chat_message_model_call_fkey REFERENCES model_call(id)
                   ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_call_iff_assistant
    CHECK ((role = 'assistant') = (model_call_id IS NOT NULL))
);

CREATE TABLE chat_citation (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL
               CONSTRAINT chat_citation_message_fkey REFERENCES chat_message(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  -- The order of the citations in the answer.
  position     int NOT NULL CHECK (position >= 0),
  -- Plain text and not doc_id: the domain refuses a NULL, so a citation of another kind could
  -- never leave this column empty. The foreign key is the check, and it holds the same rule.
  document_id  text
               CONSTRAINT chat_citation_document_fkey REFERENCES documents(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  entity_id    uuid
               CONSTRAINT chat_citation_entity_fkey REFERENCES entities(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  relation_id  uuid
               CONSTRAINT chat_citation_relation_fkey REFERENCES relations(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  proposal_id  uuid
               CONSTRAINT chat_citation_proposal_fkey REFERENCES proposals(id)
               ON UPDATE RESTRICT ON DELETE RESTRICT,
  excerpt      text CHECK (excerpt IS NULL OR btrim(excerpt, E' \t\n\r\f\v') <> ''),
  CONSTRAINT chat_citation_one_target
    CHECK (num_nonnulls(document_id, entity_id, relation_id, proposal_id) = 1),
  CONSTRAINT chat_citation_position_key UNIQUE (message_id, position)
);

-- A foreign key builds no index on the referencing side. Each index below serves the read of the
-- rows that point at one parent, and the RESTRICT probe on each delete of a parent. The unique
-- key above covers message_id.
CREATE INDEX conversation_anchor_entity_idx   ON conversation (anchor_entity_id)
  WHERE anchor_entity_id IS NOT NULL;
CREATE INDEX conversation_anchor_relation_idx ON conversation (anchor_relation_id)
  WHERE anchor_relation_id IS NOT NULL;
CREATE INDEX chat_message_conversation_idx    ON chat_message (conversation_id, created_at);
CREATE INDEX chat_message_model_call_idx      ON chat_message (model_call_id)
  WHERE model_call_id IS NOT NULL;
CREATE INDEX chat_citation_document_idx       ON chat_citation (document_id)
  WHERE document_id IS NOT NULL;
CREATE INDEX chat_citation_entity_idx         ON chat_citation (entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX chat_citation_relation_idx       ON chat_citation (relation_id)
  WHERE relation_id IS NOT NULL;
CREATE INDEX chat_citation_proposal_idx       ON chat_citation (proposal_id)
  WHERE proposal_id IS NOT NULL;

RESET ROLE;
