// PU1: each public claim carries its label in fixed words, and the label is part of the public
// data and not only of the screen. The words tell who decided the claim and the day. They show no
// NATO letter and no rating digit (S1), also when the origin that the record keeps holds them.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../probe.ts';

const PROPOSED = 'Proposed — not checked';
const MANUAL = 'Validated manually by the operator';
const AI = 'Accepted by an AI reviewer — no person read it';

// The four fixed words, then the day of the decision. A candidate has no decision, so no day.
const FIXED =
  /^(Proposed — not checked|(Accepted by rule [a-z_]+ v[1-9][0-9]* — no person read it|Accepted by an AI reviewer — no person read it|Validated manually by the operator), on \d{4}-\d{2}-\d{2})$/u;

// A NATO letter with its digit (B2), a letter alone in brackets, or the inputs of a rule.
const RATING = /\b[A-F][1-6]\b|\([A-F]\)|digits?:/u;

const labels = z.array(z.object({ label: z.string().nullable() }));

const asApp = async (ask: Ask, text: string, values: readonly unknown[] = []) => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  try {
    return await ask(text, values);
  } finally {
    await ask('RESET SESSION AUTHORIZATION');
  }
};

const asRead = async (ask: Ask, text: string, values: readonly unknown[] = []) => {
  await ask('SET LOCAL ROLE gabriel_read');
  try {
    return await ask(text, values);
  } finally {
    await ask('RESET ROLE');
  }
};

const proposed = async (ask: Ask, op: string, payload: unknown, target?: string) => {
  const [made] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      await asApp(
        ask,
        target === undefined
          ? `SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`
          : `SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[], 'entity', $3::uuid) AS id`,
        target === undefined
          ? [op, JSON.stringify(payload)]
          : [op, JSON.stringify(payload), target],
      ),
    );
  if (made === undefined) throw new Error('the act was not written');
  return made.id;
};

// The doors refuse a decision in the transaction that proposed the act, and the record refuses a
// delete, so the test writes the decision as a door writes it, and the rollback removes it.
const decided = async (ask: Ask, id: string, as: string, origin: string, reason?: string) => {
  await ask(
    `UPDATE public.proposals
        SET status = 'accepted', decided_at = '2026-10-08T23:30:00Z', decided_by = 'a test',
            decided_as = $2, decision_origin = $3, decision_reason = $4
      WHERE id = $1`,
    [id, as, origin, reason ?? null],
  );
};

const labelOf = async (ask: Ask, id: string): Promise<string | null> => {
  const [row] = labels.parse(
    await asRead(ask, 'SELECT origin_label AS label FROM api.proposal WHERE id = $1', [id]),
  );
  return row?.label ?? null;
};

const ENTITY = { type: 'vessel', label: 'A labelled test vessel' };

test('a candidate that nobody decided reads "Proposed — not checked"', async () => {
  const label = await rolledBack('superuser', async (ask) =>
    labelOf(ask, await proposed(ask, 'create_entity', ENTITY)),
  );
  expect(label).toBe(PROPOSED);
});

test('a named rule gives its name and version, with no letter and no digit of a rating', async () => {
  const label = await rolledBack('superuser', async (ask) => {
    const id = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, id, 'rule', 'rule strong_sources v1 (fact digits: 1, letters: B, C)');
    return labelOf(ask, id);
  });
  expect(label).toBe('Accepted by rule strong_sources v1 — no person read it, on 2026-10-08');
});

test('an AI reviewer reads as an AI reviewer that no person checked', async () => {
  const label = await rolledBack('superuser', async (ask) => {
    const id = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, id, 'unit', 'decided by an AI reviewer', 'The passage states it.');
    return labelOf(ask, id);
  });
  expect(label).toBe(`${AI}, on 2026-10-08`);
});

test('a decision of the operator reads as validated manually', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const manual = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, manual, 'unit', 'validated manually by the operator');
    return labelOf(ask, manual);
  });
  expect(found).toBe(`${MANUAL}, on 2026-10-08`);
});

const ATTRS = (value: string) => ({ flag: { v: value, src: ['manual'] } });

// An attribute is a claim of its own: a later act can change one value, and a different decider
// can decide that act. Each value then carries the label of the act that last set it.
test('an entity row and each of its values carry the label of the act that set them', async () => {
  const row = await rolledBack('superuser', async (ask) => {
    const made = await proposed(ask, 'create_entity', {
      ...ENTITY,
      attrs: { ...ATTRS('Panama'), owner: { v: 'A test owner', src: ['manual'] } },
    });
    await decided(ask, made, 'unit', 'validated manually by the operator');
    await ask(
      `INSERT INTO public.entities (id, type, label, attrs, sources, promoted_from)
       SELECT p.id, 'vessel', p.payload->>'label', p.payload->'attrs', p.src, p.id
         FROM public.proposals p WHERE p.id = $1`,
      [made],
    );
    const changed = await proposed(ask, 'update_attrs', { attrs: ATTRS('Liberia') }, made);
    await decided(ask, changed, 'unit', 'decided by an AI reviewer', 'The passage states it.');
    await ask(`UPDATE public.entities SET attrs = attrs || $2::jsonb WHERE id = $1`, [
      made,
      JSON.stringify(ATTRS('Liberia')),
    ]);
    return asRead(ask, 'SELECT origin_label, attr_labels FROM api.entity WHERE id = $1', [made]);
  });
  expect(row).toStrictEqual([
    {
      origin_label: `${MANUAL}, on 2026-10-08`,
      attr_labels: { flag: `${AI}, on 2026-10-08`, owner: `${MANUAL}, on 2026-10-08` },
    },
  ]);
});

const everyLabel = z.array(z.object({ seen: z.string(), label: z.string().nullable() }));

// Every row that the public read role can read, from the committed fixture: no public claim
// lacks its label, and no label holds a word outside the fixed words.
const ALL = `
  SELECT 'proposal ' || id AS seen, origin_label AS label FROM api.proposal
  UNION ALL SELECT 'entity ' || id, origin_label FROM api.entity
  UNION ALL SELECT 'relation ' || id, origin_label FROM api.relation
  UNION ALL SELECT 'map entity ' || id, origin_label FROM api.full_map
  UNION ALL SELECT 'entity value ' || e.id || ' ' || k.key, k.value
              FROM api.entity e, jsonb_each_text(e.attr_labels) k
  UNION ALL SELECT 'relation value ' || r.id || ' ' || k.key, k.value
              FROM api.relation r, jsonb_each_text(r.attr_labels) k`;

test('each public claim carries its label in the fixed words, with no letter and no digit', async () => {
  const rows = await probe('read', async (ask) => everyLabel.parse(await ask(ALL)));
  expect(rows.length).toBeGreaterThan(0);
  const wrong = rows.filter(
    (row) => row.label === null || !FIXED.test(row.label) || RATING.test(row.label),
  );
  expect(wrong).toStrictEqual([]);
});

// The label of a value is a string in the fixed words, never a null: jsonb_object_agg keeps a key
// with a null label, so a count of the keys cannot see a missing label.
test('each value of an entity and of a relation carries a label', async () => {
  const missing = await probe('read', (ask) =>
    ask(`SELECT e.id FROM api.entity e, jsonb_each(e.attr_labels) k
          WHERE jsonb_typeof(k.value) <> 'string'
         UNION ALL
         SELECT r.id FROM api.relation r, jsonb_each(r.attr_labels) k
          WHERE jsonb_typeof(k.value) <> 'string'`),
  );
  expect(missing).toStrictEqual([]);
});

// S1: the label hides the digits, and the origin column must not give them back. The public read
// role sees the name and the version of the rule only, in each column of the row.
test('the public row of a rule decision holds no rating digit in any column', async () => {
  const text = await rolledBack('superuser', async (ask) => {
    const id = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, id, 'rule', 'rule strong_sources v1 (fact digits: 1, letters: B)');
    return z
      .array(z.object({ row: z.string(), origin: z.string().nullable() }))
      .parse(
        await asRead(
          ask,
          'SELECT to_jsonb(p)::text AS row, p.decision_origin AS origin FROM api.proposal p WHERE p.id = $1',
          [id],
        ),
      );
  });
  expect(text).toHaveLength(1);
  expect(text[0]?.origin).toBe('rule strong_sources v1');
  expect(RATING.test(text[0]?.row ?? '')).toBe(false);
});

// The name, the type and the row sources of an entity come from the last act that set them. An
// AI reviewer that accepts a change of the name must not read as a check of the operator.
test('the row label of an entity follows the last accepted change of its name or type', async () => {
  const row = await rolledBack('superuser', async (ask) => {
    const made = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, made, 'unit', 'validated manually by the operator');
    await ask(
      `INSERT INTO public.entities (id, type, label, attrs, sources, promoted_from)
       SELECT p.id, 'vessel', p.payload->>'label', '{}'::jsonb, p.src, p.id
         FROM public.proposals p WHERE p.id = $1`,
      [made],
    );
    const renamed = await proposed(ask, 'update_entity', { label: 'A new test name' }, made);
    await decided(ask, renamed, 'unit', 'decided by an AI reviewer', 'The passage states it.');
    return asRead(ask, 'SELECT origin_label FROM api.entity WHERE id = $1', [made]);
  });
  expect(row).toStrictEqual([{ origin_label: `${AI}, on 2026-10-08` }]);
});

// A decider that the view does not know must never read as a person. It gets the cautious words.
test('an accepted act with an unknown origin reads as not checked, and never as the operator', async () => {
  const label = await rolledBack('superuser', async (ask) => {
    const id = await proposed(ask, 'create_entity', ENTITY);
    await decided(ask, id, 'unit', 'decided by a new machine');
    return labelOf(ask, id);
  });
  expect(label).toBe(PROPOSED);
});
