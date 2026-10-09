// PU1, the rulings of 9 October 2026: a fact about a person is public only when at least one of
// its cited sources is a public document. A public document is one that anyone can open at a
// public address: a web page, a public registry or API, or a file that the operator uploaded with
// the address where it comes from. An old upload with no address and a bought file are not
// public. The public read role hides the fact. The roles that run a tool and the review doors of
// the operator still read it.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../probe.ts';

const PUBLIC_PAGE = 'doc_pu1_public_page';
const PUBLIC_API = 'doc_pu1_public_api';
const UPLOADED = 'doc_pu1_upload_no_address';
const ADDRESSED = 'doc_pu1_upload_with_address';
const BOUGHT_FILE = 'doc_pu1_bought_upload';
const BOUGHT = 'doc_pu1_bought_filing';
const PAID_FILING = 'doc_pu1_paid_filing_no_price';
const OLD_ADDRESSED = 'doc_pu1_upload_before_rule';

const VESSEL = '00000000-0000-4000-8000-0000000a0001';
const NAMED = '00000000-0000-4000-8000-0000000a0002';
const HIDDEN = '00000000-0000-4000-8000-0000000a0003';

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const asApp = async (ask: Ask, text: string, values: readonly unknown[] = []) => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  try {
    return await ask(text, values);
  } finally {
    await ask('RESET SESSION AUTHORIZATION');
  }
};

const readAs = async (ask: Ask, role: string, text: string, values: readonly unknown[] = []) => {
  await ask(`SET LOCAL ROLE ${role}`);
  try {
    return await ask(text, values);
  } finally {
    await ask('RESET ROLE');
  }
};

const ids = z.array(z.object({ id: z.uuid() }));

// An act of the operator that cites the given documents. It stays pending.
const act = async (
  ask: Ask,
  op: string,
  payload: object,
  src: readonly string[],
  target: string | null = null,
) => {
  const [made] = ids.parse(
    await asApp(
      ask,
      `SELECT public.propose_change($1, $2::jsonb, $3::text[], $4, $5::uuid) AS id`,
      [op, JSON.stringify(payload), src, target === null ? null : 'entity', target],
    ),
  );
  if (made === undefined) throw new Error('the act was not written');
  return made.id;
};

const cited = (v: string, src: readonly string[]) => ({ v, src });

// Two public documents, an old upload of the operator with no address, an upload with the
// address where it comes from, a bought upload, a bought file with a price, and a filing of a
// paid provider with no recorded price.
const documents = async (ask: Ask) => {
  await ask(
    `INSERT INTO public.document_provider (id, name, licence)
     VALUES ('pu1_paid_registry', 'A paid registry of the PU1 test', 'paid-filing')`,
  );
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, cost_eur, provider_id) VALUES
       ($1, 'url',  'A public page',     'https://example.org/page',   current_date, NULL, NULL),
       ($2, 'api',  'A public registry', 'https://example.org/api',    current_date, NULL, NULL),
       ($3, 'file', 'An old upload',     NULL,                         current_date, NULL, NULL),
       ($4, 'url',  'A bought filing',   'https://example.org/paid',   current_date, 12.50, NULL),
       ($5, 'url',  'A paid filing',     'https://example.org/filing', current_date, NULL,
        'pu1_paid_registry'),
       ($6, 'file', 'An upload',         'https://example.org/upload', current_date, NULL, NULL),
       ($7, 'file', 'A bought upload',   'https://example.org/bought', current_date, 40.00, NULL)`,
    [PUBLIC_PAGE, PUBLIC_API, UPLOADED, BOUGHT, PAID_FILING, ADDRESSED, BOUGHT_FILE],
  );
  // An upload from before the address rule: its address can be the page where it was bought,
  // and its cost is not known. The migration of the rule marks it.
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, cost_eur, uri_before_pu1)
     VALUES ($1, 'file', 'An older upload', 'https://example.org/purchase', current_date, NULL,
             true)`,
    [OLD_ADDRESSED],
  );
};

const entity = async (
  ask: Ask,
  id: string,
  type: string,
  label: string,
  sources: readonly string[],
  attrs: object = {},
) => {
  const from = await act(ask, 'create_entity', { type, label }, ['manual']);
  await ask(
    `INSERT INTO public.entities (id, type, label, sources, attrs, promoted_from)
     VALUES ($1, $2, $3, $4::doc_id[], $5::jsonb, $6)`,
    [id, type, label, sources, JSON.stringify(attrs), from],
  );
};

// Each relation takes its own type, because two open relations of one dated type and one pair
// of ends are refused.
const relation = async (
  ask: Ask,
  type: string,
  src: string,
  dst: string,
  sources: readonly string[],
  attrs: object = {},
): Promise<string> => {
  const from = await act(ask, 'create_relation', { type, src_id: src, dst_id: dst }, ['manual']);
  const [made] = ids.parse(
    await ask(
      `INSERT INTO public.relations (type, src_id, dst_id, sources, attrs, promoted_from)
       VALUES ($1, $2, $3, $4::doc_id[], $5::jsonb, $6) RETURNING id`,
      [type, src, dst, sources, JSON.stringify(attrs), from],
    ),
  );
  if (made === undefined) throw new Error('the relation was not written');
  return made.id;
};

// A vessel, a person that a public page names, and a person that only an old upload names.
const graph = async (ask: Ask) => {
  await documents(ask);
  await entity(ask, VESSEL, 'vessel', 'A vessel', [UPLOADED], {
    flag_state: cited('Panama', [UPLOADED]),
  });
  await entity(ask, NAMED, 'person', 'A named person', [PUBLIC_PAGE], {
    rank: cited('captain', [PUBLIC_PAGE]),
    birth_year: cited('1970', [UPLOADED]),
    home_town: cited('Somewhere', [BOUGHT]),
    employer: cited('A company', [PAID_FILING]),
    nationality: cited('Nowhere', [UPLOADED, PUBLIC_API]),
  });
  await entity(ask, HIDDEN, 'person', 'A hidden person', [UPLOADED, BOUGHT]);
};

const attrsOf = z.array(z.object({ attrs: z.record(z.string(), z.unknown()) }));
const labelsOf = z.array(z.object({ attr_labels: z.record(z.string(), z.unknown()) }));

const keysAs = async (ask: Ask, role: string, id: string) =>
  attrsOf
    .parse(await readAs(ask, role, 'SELECT attrs FROM api.entity WHERE id = $1', [id]))
    .map((row) => Object.keys(row.attrs).sort());

test('an attribute of a person that cites only a private file is not public', async () => {
  const keys = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    return {
      read: await keysAs(ask, 'gabriel_read', NAMED),
      labels: labelsOf
        .parse(
          await readAs(ask, 'gabriel_read', 'SELECT attr_labels FROM api.entity WHERE id = $1', [
            NAMED,
          ]),
        )
        .map((row) => Object.keys(row.attr_labels).sort()),
      app: await keysAs(ask, 'gabriel_app', NAMED),
      vessel: await keysAs(ask, 'gabriel_read', VESSEL),
    };
  });
  expect(keys.read).toStrictEqual([['nationality', 'rank']]);
  // A hidden value has no label either, so its key does not show.
  expect(keys.labels).toStrictEqual([['nationality', 'rank']]);
  expect(keys.app).toStrictEqual([['birth_year', 'employer', 'home_town', 'nationality', 'rank']]);
  // The rule is for a person only.
  expect(keys.vessel).toStrictEqual([['flag_state']]);
});

const SEEN = `SELECT
    (SELECT count(*)::int FROM api.entity   WHERE id = $1)        AS entity,
    (SELECT count(*)::int FROM api.layout   WHERE entity_id = $1) AS layout,
    (SELECT count(*)::int FROM api.full_map WHERE id = $1)        AS map`;

const seen = z.array(z.object({ entity: z.number(), layout: z.number(), map: z.number() }));

const SOURCED = '00000000-0000-4000-8000-0000000a0004';
const UNSOURCED = '00000000-0000-4000-8000-0000000a0005';
const BOUGHT_ONLY = '00000000-0000-4000-8000-0000000a0006';

test('a person fact that cites only an upload with its address shows in the public read', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    await entity(ask, SOURCED, 'person', 'A person of an upload', [ADDRESSED], {
      rank: cited('colonel', [ADDRESSED]),
    });
    return {
      keys: await keysAs(ask, 'gabriel_read', SOURCED),
      seen: seen.parse(await readAs(ask, 'gabriel_read', SEEN, [SOURCED])),
    };
  });
  expect(shown.keys).toStrictEqual([['rank']]);
  expect(shown.seen).toStrictEqual([{ entity: 1, layout: 1, map: 1 }]);
});

test('an upload with no address, a bought upload and an upload from before the rule do not make a person fact public', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    await entity(ask, UNSOURCED, 'person', 'A person of an old upload', [UPLOADED, ADDRESSED], {
      rank: cited('major', [ADDRESSED]),
      birth_year: cited('1960', [UPLOADED]),
      home_town: cited('Elsewhere', [BOUGHT_FILE]),
      employer: cited('A shipyard', [OLD_ADDRESSED]),
    });
    await entity(ask, BOUGHT_ONLY, 'person', 'A person of a bought upload', [
      BOUGHT_FILE,
      UPLOADED,
      OLD_ADDRESSED,
    ]);
    return {
      keys: await keysAs(ask, 'gabriel_read', UNSOURCED),
      bought: seen.parse(await readAs(ask, 'gabriel_read', SEEN, [BOUGHT_ONLY])),
    };
  });
  expect(shown.keys).toStrictEqual([['rank']]);
  expect(shown.bought).toStrictEqual([{ entity: 0, layout: 0, map: 0 }]);
});

test('a person with no public source is not public, and a tool role still reads it', async () => {
  const counts = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    return {
      hidden: seen.parse(await readAs(ask, 'gabriel_read', SEEN, [HIDDEN])),
      named: seen.parse(await readAs(ask, 'gabriel_read', SEEN, [NAMED])),
      app: await keysAs(ask, 'gabriel_app', HIDDEN),
    };
  });
  expect(counts.hidden).toStrictEqual([{ entity: 0, layout: 0, map: 0 }]);
  expect(counts.named).toStrictEqual([{ entity: 1, layout: 1, map: 1 }]);
  expect(counts.app).toStrictEqual([[]]);
});

const relationRows = z.array(z.object({ id: z.uuid(), attrs: z.record(z.string(), z.unknown()) }));

test('a relation that names a person is public only with a public source', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    const privateOnly = await relation(ask, 'owns', NAMED, VESSEL, [UPLOADED]);
    const withPublic = await relation(ask, 'operates', NAMED, VESSEL, [UPLOADED, PUBLIC_PAGE], {
      share: cited('51%', [UPLOADED]),
      role: cited('owner', [PUBLIC_PAGE]),
    });
    const toHidden = await relation(ask, 'owns', HIDDEN, VESSEL, [PUBLIC_PAGE]);
    const read = relationRows.parse(
      await readAs(ask, 'gabriel_read', 'SELECT id, attrs FROM api.relation WHERE id = ANY ($1)', [
        [privateOnly, withPublic, toHidden],
      ]),
    );
    const app = relationRows.parse(
      await readAs(ask, 'gabriel_app', 'SELECT id, attrs FROM api.relation WHERE id = ANY ($1)', [
        [privateOnly, withPublic, toHidden],
      ]),
    );
    return {
      read: read.map((row) => ({
        public: row.id === withPublic,
        keys: Object.keys(row.attrs).sort(),
      })),
      app: app.length,
    };
  });
  expect(shown.read).toStrictEqual([{ public: true, keys: ['role'] }]);
  expect(shown.app).toBe(3);
});

const statuses = z.array(z.object({ id: z.uuid(), payload: z.unknown() }));

test('an act about a person that cites only a private file is not public', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    const privateOnly = await act(ask, 'create_entity', { type: 'person', label: 'A new person' }, [
      UPLOADED,
    ]);
    const withPublic = await act(
      ask,
      'update_attrs',
      {
        attrs: {
          rank: cited('major', [PUBLIC_PAGE]),
          birth_year: cited('1971', [UPLOADED]),
        },
      },
      [PUBLIC_PAGE, UPLOADED],
      NAMED,
    );
    const onPerson = await act(
      ask,
      'update_attrs',
      { attrs: { rank: cited('x', [UPLOADED]) } },
      [UPLOADED],
      NAMED,
    );
    const onVessel = await act(
      ask,
      'update_attrs',
      { attrs: { flag_state: cited('Liberia', [UPLOADED]) } },
      [UPLOADED],
      VESSEL,
    );
    const asked = [privateOnly, withPublic, onPerson, onVessel];
    const read = statuses.parse(
      await readAs(
        ask,
        'gabriel_read',
        'SELECT id, payload FROM api.proposal WHERE id = ANY ($1)',
        [asked],
      ),
    );
    const app = statuses.parse(
      await readAs(ask, 'gabriel_app', 'SELECT id, payload FROM api.proposal WHERE id = ANY ($1)', [
        asked,
      ]),
    );
    const names = new Map<string, string>([
      [privateOnly, 'private'],
      [withPublic, 'public'],
      [onPerson, 'person'],
      [onVessel, 'vessel'],
    ]);
    return {
      read: Object.fromEntries(
        read.map((row): [string, unknown] => [names.get(row.id) ?? row.id, row.payload]),
      ),
      app: app.length,
    };
  });
  expect(shown.read).toStrictEqual({
    public: { attrs: { rank: { v: 'major', src: [PUBLIC_PAGE] } } },
    vessel: { attrs: { flag_state: { v: 'Liberia', src: [UPLOADED] } } },
  });
  expect(shown.app).toBe(4);
});

const unitOf = z.array(z.object({ unit_id: z.uuid() }));

// The citation of the row that an act makes is payload.sources when the act gives it, and not
// the wider list of the act.
test('an act that makes a person fact from a private file only is not public', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    const person = await act(
      ask,
      'create_entity',
      { type: 'person', label: 'A person of an upload', sources: [UPLOADED] },
      [PUBLIC_PAGE, UPLOADED],
    );
    const link = await act(
      ask,
      'create_relation',
      { type: 'owns', src_id: NAMED, dst_id: VESSEL, sources: [UPLOADED] },
      [PUBLIC_PAGE, UPLOADED],
    );
    const toHidden = await act(
      ask,
      'create_relation',
      { type: 'operates', src_id: HIDDEN, dst_id: VESSEL, sources: [PUBLIC_PAGE] },
      [PUBLIC_PAGE],
    );
    const shownLink = await act(
      ask,
      'create_relation',
      { type: 'commands', src_id: NAMED, dst_id: VESSEL, sources: [PUBLIC_PAGE] },
      [PUBLIC_PAGE, UPLOADED],
    );
    const asked = [person, link, toHidden, shownLink];
    const read = ids.parse(
      await readAs(ask, 'gabriel_read', 'SELECT id FROM api.proposal WHERE id = ANY ($1)', [asked]),
    );
    const app = ids.parse(
      await readAs(ask, 'gabriel_app', 'SELECT id FROM api.proposal WHERE id = ANY ($1)', [asked]),
    );
    return { read: read.map((row) => row.id === shownLink), app: app.length };
  });
  expect(shown.read).toStrictEqual([true]);
  expect(shown.app).toBe(4);
});

// A person that an accepted act retyped is still a person for each older act about it.
test('an act about a person that an accepted act retyped keeps the rule', async () => {
  const shown = await rolledBack('superuser', async (ask) => {
    await graph(ask);
    const rename = await act(ask, 'update_entity', { label: 'A private name' }, [UPLOADED], NAMED);
    const retype = await act(ask, 'update_entity', { type: 'vessel' }, [PUBLIC_PAGE], NAMED);
    // External constraint: a transaction does not decide the act it proposed, so the test writes
    // what the promotion writes.
    await ask(
      `UPDATE public.proposals SET status = 'accepted', decided_at = now(), decided_by = 'a test',
         decided_as = 'unit', prior_value = $2::jsonb WHERE id = $1`,
      [retype, JSON.stringify({ sources: [PUBLIC_PAGE], type: 'person', proposed_type: null })],
    );
    await ask(`UPDATE public.entities SET type = 'vessel' WHERE id = $1`, [NAMED]);
    const read = await readAs(ask, 'gabriel_read', 'SELECT id FROM api.proposal WHERE id = $1', [
      rename,
    ]);
    return read.length;
  });
  expect(shown).toBe(0);
});

const reviewed = z.array(z.object({ text: z.string() }));

test('the review of the operator still shows a person fact that the public read hides', async () => {
  const text = await rolledBack('superuser', async (ask) => {
    await documents(ask);
    const id = await act(ask, 'create_entity', { type: 'person', label: 'A private person' }, [
      UPLOADED,
    ]);
    const [unit] = unitOf.parse(
      await ask('SELECT unit_id FROM public.proposals WHERE id = $1', [id]),
    );
    if (unit === undefined) throw new Error('the act has no unit');
    const public_ = await readAs(ask, 'gabriel_read', 'SELECT id FROM api.proposal WHERE id = $1', [
      id,
    ]);
    const [review] = reviewed.parse(
      await asApp(ask, 'SELECT public.review_units(NULL, 50, p_unit => $1)::text AS text', [
        unit.unit_id,
      ]),
    );
    return { public: public_.length, review: review?.text ?? '' };
  });
  expect(text.public).toBe(0);
  expect(text.review).toContain('A private person');
});
