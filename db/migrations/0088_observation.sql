-- =============================================================================================
-- 0088 — an aggregated figure is an observation, outside the graph                    ORDERED
--
-- THE RECORD HELD NO PLACE FOR A FIGURE. A monthly gas import volume or a trade total between two
-- countries is no entity and no relation. The operator decided on #929, after the expert panel:
-- a figure is one row of a table of its own, and not an entity, and not a unit of decision (P11).
-- ADR 0030 holds the reason and the cost.
--
-- A FIGURE ENTERS ONLY THROUGH A PROMOTED MAPPING (P6). The operator promotes the mapping of one
-- stored table once, and code then writes each row. The promotion of the mapping is the promotion
-- of each figure (ADR 0030 extends P1). The row of the stored text is the excerpt (P9): each
-- observation names its page and the span of its row, and the door checks that the span holds the
-- value and the period as the file writes them.
--
-- THE REPORTER AND THE PARTNER ARE CODES OF A FIXED LIST, NOT ENTITIES. A country of ISO 3166-1 or
-- a group (the EU, the world, a partner that the source does not state) is a row of `area_code`.
-- db/apply/95_seed.sql writes the list. A code outside the list is refused by the foreign key.
--
-- EACH FIGURE CARRIES ITS LICENCE. The words are the closed list of the document providers. The
-- public read shows a figure only when its licence is open: UN Comtrade is internal, and the
-- report shows it only as an aggregate.
--
-- THE SUBJECT IS AN ENTITY OF THE RECORD, FOR EXAMPLE A PIPELINE, AND IT HAS NO FOREIGN KEY. A
-- merge or a delete of an entity is an act of the operator, and a figure must not stop it. The
-- read resolves a merged entity through its alias.
--
-- NO ROLE UPDATES OR DELETES A FIGURE. A new edition of a table is a new document, and its rows
-- are new figures. The read gives the figure of the newest edition for each key.
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE area_code (
  system  text NOT NULL CONSTRAINT area_code_system CHECK (system IN ('iso3166', 'group')),
  code    text NOT NULL CONSTRAINT area_code_shape CHECK (code ~ '^[A-Z][A-Z0-9_]{1,19}$'),
  label   text NOT NULL CONSTRAINT area_code_label CHECK (btrim(label, E' \t\n\r\f\v') <> ''),
  PRIMARY KEY (system, code)
);

CREATE TABLE observation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measure         text NOT NULL
                  CONSTRAINT observation_measure_key
                  CHECK (measure ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$' AND char_length(measure) <= 100),
  value           numeric NOT NULL,
  unit            text NOT NULL
                  CONSTRAINT observation_unit_named
                  CHECK (btrim(unit, E' \t\n\r\f\v') = unit AND unit <> ''
                         AND char_length(unit) <= 40),
  -- A year, a quarter, a month or an ISO week.
  period          text NOT NULL
                  CONSTRAINT observation_period_shape
                  CHECK (period ~ '^[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4]|-W(0[1-9]|[1-4][0-9]|5[0-3]))?$'),
  method          text NOT NULL
                  CONSTRAINT observation_method_named
                  CHECK (btrim(method, E' \t\n\r\f\v') <> '' AND char_length(method) <= 200),
  reporter_system text NOT NULL,
  reporter        text NOT NULL,
  partner_system  text,
  partner         text,
  product_system  text
                  CONSTRAINT observation_product_system CHECK (product_system IN ('siec', 'hs', 'chpl')),
  product         text
                  CONSTRAINT observation_product_code
                  CHECK (btrim(product, E' \t\n\r\f\v') = product AND product <> ''
                         AND char_length(product) <= 40),
  subject_id      uuid,
  licence         text NOT NULL
                  CONSTRAINT observation_licence_closed
                  CHECK (licence IN ('public-domain', 'eu-reuse', 'ogl-v3', 'cc0', 'cc-by-4.0',
                                     'cc-by-nc-4.0', 'odbl', 'copernicus', 'paid-filing',
                                     'registration-terms', 'restricted',
                                     'commercial-no-redistribution', 'own')),
  -- The mark that the source writes beside the value, for example `p` for a provisional value.
  flag            text
                  CONSTRAINT observation_flag_named
                  CHECK (btrim(flag, E' \t\n\r\f\v') = flag AND flag <> ''
                         AND char_length(flag) <= 20),
  document_id     doc_id NOT NULL,
  text_extractor  text NOT NULL,
  page            int NOT NULL,
  span_start      int NOT NULL,
  span_end        int NOT NULL,
  mapping_id      uuid NOT NULL
                  CONSTRAINT observation_mapping_fkey REFERENCES proposals(id)
                  ON UPDATE RESTRICT ON DELETE RESTRICT,
  job_id          uuid NOT NULL
                  CONSTRAINT observation_job_fkey REFERENCES jobs(id)
                  ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT observation_reporter_fkey FOREIGN KEY (reporter_system, reporter)
    REFERENCES area_code (system, code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT observation_partner_fkey FOREIGN KEY (partner_system, partner)
    REFERENCES area_code (system, code) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT observation_partner_pair CHECK ((partner_system IS NULL) = (partner IS NULL)),
  CONSTRAINT observation_product_pair CHECK ((product_system IS NULL) = (product IS NULL)),
  CONSTRAINT observation_text_fkey FOREIGN KEY (document_id, text_extractor, page)
    REFERENCES document_text (document_id, extractor, page) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT observation_span CHECK (span_start >= 0 AND span_start < span_end),
  -- One figure for each key in one edition. The unit is part of the key: a table gives the same
  -- flow in million cubic metres and in terajoules.
  CONSTRAINT observation_key UNIQUE NULLS NOT DISTINCT
    (document_id, measure, unit, period, reporter_system, reporter, partner_system, partner,
     product_system, product, method, subject_id)
);

-- The read finds the other editions of a key.
CREATE INDEX observation_series ON observation (measure, reporter, period);

RESET ROLE;
