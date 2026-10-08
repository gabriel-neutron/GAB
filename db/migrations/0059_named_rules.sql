-- =============================================================================================
-- 0059 — the named rules, their configuration and the origin of a decision             ORDERED
--
-- THE RULES RUN IN THE DATABASE, AS ONE FUNCTION. This file holds what the function reads and
-- what it writes. It adds a table of configuration and the origin of each decision.
--
-- THE THRESHOLD IS A ROW. Each rule has a row with its version. The strong rule keeps three
-- settings. "single" is the best letter for a lone source. "pair" is the least letter of the
-- better source of two independent citations. "other" is the least letter of the second source.
-- Code proves the independence (citations_independent).
--
-- The row starts at the strict value. One source A is enough. Or two independent citations are
-- enough, one B or better and one C or better. A change of a setting needs a new version in the
-- same statement. So the origin of a decision names the rule as it ran. No role reads or writes
-- the table. The function in the re-runnable files does.
--
-- THE ORIGIN OF A DECISION IS A COLUMN. A rule writes its name and its version. A decision of
-- the operator gets "validated manually by the operator" from the freeze trigger. So no door of
-- the operator needs a change. An old decision has no origin: nothing recorded it, and the
-- ledger is never rewritten.
--
-- A RULE IS A MODE OF DECISION. The mode of the decision of a rule is "rule".
-- =============================================================================================

SET LOCAL ROLE gabriel_owner;

CREATE TABLE rule_config (
  rule     text PRIMARY KEY
           CONSTRAINT rule_config_rule
           CHECK (rule IN ('impossible', 'doubt', 'strong_sources', 'weak_sources')),
  version  smallint NOT NULL CONSTRAINT rule_config_version CHECK (version >= 1),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
           CONSTRAINT rule_config_settings CHECK (jsonb_typeof(settings) = 'object')
);

INSERT INTO rule_config (rule, version, settings) VALUES
  ('impossible',     1, '{}'),
  ('doubt',          1, '{}'),
  ('strong_sources', 1, '{"single": "A", "pair": "B", "other": "C"}'),
  ('weak_sources',   1, '{}');

ALTER TABLE proposals
  ADD COLUMN decision_origin text,
  ADD CONSTRAINT proposals_decision_origin
      CHECK (decision_origin IS NULL OR (status <> 'pending' AND btrim(decision_origin) <> '')),
  DROP CONSTRAINT proposals_decided_as,
  ADD CONSTRAINT proposals_decided_as
      CHECK (decided_as IS NULL
             OR (status <> 'pending' AND decided_as IN ('unit', 'relation', 'group', 'rule')));

RESET ROLE;
