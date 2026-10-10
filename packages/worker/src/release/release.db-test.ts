// The release against the disposable database: the superuser writes a small record in one
// transaction that rolls back, and the release reads it as the operator role and writes its folder
// in a temporary folder. The test reads the files that the release wrote.

import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readCsv } from '@gab/tools/csv';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { Queryable } from '../queryable.ts';
import { writeRelease } from './release.ts';
import type { ReleaseManifest } from './release-manifest.ts';

z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

type Ask = (text: string, values?: unknown[]) => Promise<Record<string, unknown>[]>;

const inTransaction = async <T>(
  work: (held: { as: (role: string) => Queryable; ask: Ask }) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return await work({
      as: (role) => ({
        query: async (text, values) => {
          await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
          try {
            return await client.query(text, values);
          } finally {
            await client.query('RESET SESSION AUTHORIZATION');
          }
        },
      }),
      ask: async (text, values) => (await client.query<Record<string, unknown>>(text, values)).rows,
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const MANIFEST: ReleaseManifest = {
  version: '0.1-test',
  date: '2026-11-08',
  showNatoPair: false,
  dateRules: { eu: 'entry_into_force', ofac: 'recent_actions_notice', uk: 'date_designated' },
  contacts: {
    reportError: 'https://example.org/report-an-error',
    rightOfReply: 'mailto:reply@example.org',
  },
  criticalNodes: null,
};

const CC_BY = 'CC-BY 4.0';
const CC_BY_NC = 'CC-BY-NC 4.0';
const DERIVED = 'derived fact; source under the provider licence, not redistributed';
const MANUAL = 'Validated manually by the operator, on 2026-10-08';
const RULE = 'Accepted by rule strong_sources v1 — no person read it, on 2026-10-09';

const EXTRACTOR = 'release-test@1';

// The documents: a list in the public domain, a public API under CC-BY-NC, a public API that
// forbids a copy, a web page with no provider, and a bought filing.
const SDN = 'doc_release_sdn';
const GFW = 'doc_release_gfw';
const SHIPS = 'doc_release_ships';
const PAGE = 'doc_release_page';
const BOUGHT = 'doc_release_bought';

const TEXT: Record<string, string> = {
  [SDN]: 'The vessel TEST TANKER, IMO 9123456, is designated. TEST PERSON is designated.',
  [GFW]: 'TEST TANKER sails under the flag of Panama.',
  [SHIPS]: 'TEST TANKER makes 12 knots. TEST OWNER LTD owns TEST TANKER.',
  [PAGE]: 'TEST PERSON and TEST OTHER PERSON work for TEST OWNER LTD.',
  [BOUGHT]: 'TEST TANKER is insured by a secret club.',
};

const VESSEL = '00000000-0000-4000-8000-00000000e001';
const OWNER = '00000000-0000-4000-8000-00000000e002';
const HIDDEN_OWNER = '00000000-0000-4000-8000-00000000e003';
const LIST = '00000000-0000-4000-8000-00000000e004';
const PERSON = '00000000-0000-4000-8000-00000000e005';
const OTHER_PERSON = '00000000-0000-4000-8000-00000000e006';

const documents = async (ask: Ask) => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, cost_eur, provider_id) VALUES
       ($1, 'url', 'OFAC SDN list', 'https://example.org/sdn.csv', '2026-10-01', NULL, 'ofac_sdn'),
       ($2, 'api', 'GFW answer', 'https://example.org/gfw', '2026-10-02', NULL, 'gfw'),
       ($3, 'api', 'Ship register answer', 'https://example.org/ships', '2026-10-03', NULL,
        'datalastic'),
       ($4, 'url', 'A news page', 'https://example.org/news', '2026-10-04', NULL, NULL),
       ($5, 'url', 'A bought filing', 'https://example.org/filing', '2026-10-05', 25.00, NULL)`,
    [SDN, GFW, SHIPS, PAGE, BOUGHT],
  );
  for (const [id, text] of Object.entries(TEXT))
    await ask(
      'INSERT INTO public.document_text (document_id, extractor, page, text) VALUES ($1, $2, 1, $3)',
      [id, EXTRACTOR, text],
    );
};

// An act of the operator, decided as a door decides it. The doors refuse a decision in the
// transaction that proposed the act, so the test writes the decision itself.
const decidedAct = async (
  held: { as: (role: string) => Queryable; ask: Ask },
  op: string,
  payload: object,
  target: { kind: string; id: string } | null,
  origin: string,
  day: string,
  src: readonly string[] = ['manual'],
): Promise<string> => {
  const { rows } = await held
    .as('gabriel_app')
    .query('SELECT public.propose_change($1, $2::jsonb, $3::text[], $4, $5::uuid) AS id', [
      op,
      JSON.stringify(payload),
      src,
      target?.kind ?? null,
      target?.id ?? null,
    ]);
  const id = z.array(z.object({ id: z.uuid() })).parse(rows)[0]?.id;
  if (id === undefined) throw new Error('the act was not written');
  await held.ask(
    `UPDATE public.proposals
        SET status = 'accepted', decided_at = $2::date + time '12:00', decided_by = 'a test',
            decided_as = 'unit', decision_origin = $3
      WHERE id = $1`,
    [id, day, origin],
  );
  return id;
};

// A citation of the act: the passage of the document that holds the words.
const cite = async (ask: Ask, act: string, document: string, words: string) => {
  const text = TEXT[document] ?? '';
  const start = text.indexOf(words);
  if (start < 0) throw new Error(`the document ${document} does not hold "${words}"`);
  await ask(
    `INSERT INTO public.citation (claim_id, doc_id, page, start, "end", modality, text_extractor)
     VALUES ($1, $2, 1, $3, $4, 'asserts', $5)`,
    [act, document, start, start + words.length, EXTRACTOR],
  );
};

const value = (v: string | number, src: readonly string[]) => ({ v, src });

const entity = async (
  held: { as: (role: string) => Queryable; ask: Ask },
  id: string,
  type: string,
  label: string,
  sources: readonly string[],
  attrs: Record<string, unknown> = {},
): Promise<string> => {
  const act = await decidedAct(
    held,
    'create_entity',
    { type, label },
    null,
    'validated manually by the operator',
    '2026-10-08',
    sources,
  );
  await held.ask(
    `INSERT INTO public.entities (id, type, label, sources, attrs, promoted_from)
     VALUES ($1, $2, $3, $4::doc_id[], $5::jsonb, $6)`,
    [id, type, label, sources, JSON.stringify(attrs), act],
  );
  return act;
};

const relation = async (
  held: { as: (role: string) => Queryable; ask: Ask },
  type: string,
  src: string,
  dst: string,
  sources: readonly string[],
): Promise<{ id: string; act: string }> => {
  const act = await decidedAct(
    held,
    'create_relation',
    { type, src_id: src, dst_id: dst },
    null,
    'validated manually by the operator',
    '2026-10-08',
    sources,
  );
  const [made] = z.array(z.object({ id: z.uuid() })).parse(
    await held.ask(
      `INSERT INTO public.relations (type, src_id, dst_id, sources, promoted_from)
         VALUES ($1, $2, $3, $4::doc_id[], $5) RETURNING id`,
      [type, src, dst, sources, act],
    ),
  );
  if (made === undefined) throw new Error('the relation was not written');
  return { id: made.id, act };
};

// A small record: a vessel with four values, its owner, an owner known from a bought filing only,
// a sanctions list, a designated person and a person with no designation.
const record = async (held: { as: (role: string) => Queryable; ask: Ask }) => {
  const { ask } = held;
  await documents(ask);
  const vesselAct = await entity(held, VESSEL, 'vessel', 'TEST TANKER', [SDN, GFW, BOUGHT], {
    imo: value('9123456', [SDN]),
    flag: value('Panama', [GFW, BOUGHT]),
    speed_knots: value(12, [SHIPS]),
    insurer_note: value('a secret club', [BOUGHT]),
  });
  await cite(ask, vesselAct, GFW, 'flag of Panama');
  await cite(ask, vesselAct, SHIPS, '12 knots');
  await cite(ask, vesselAct, BOUGHT, 'a secret club');
  // A rule set the IMO number later, and the value carries the label of that act.
  const imoAct = await decidedAct(
    held,
    'update_attrs',
    { attrs: { imo: value('9123456', ['manual']) } },
    { kind: 'entity', id: VESSEL },
    'rule strong_sources v1 (fact digits: 1, letters: B)',
    '2026-10-09',
  );
  await cite(ask, imoAct, SDN, 'IMO 9123456');

  await entity(held, OWNER, 'company', 'TEST OWNER LTD', [SHIPS]);
  await entity(held, HIDDEN_OWNER, 'company', 'TEST HIDDEN OWNER', [BOUGHT]);
  await entity(held, LIST, 'legal_act', 'TEST SANCTIONS LIST', [SDN]);
  await entity(held, PERSON, 'person', 'TEST PERSON', [PAGE]);
  await entity(held, OTHER_PERSON, 'person', 'TEST OTHER PERSON', [PAGE]);

  const owns = await relation(held, 'owns', OWNER, VESSEL, [SHIPS]);
  await cite(ask, owns.act, SHIPS, 'TEST OWNER LTD owns TEST TANKER');
  const designated = await relation(held, 'designated_by', PERSON, LIST, [SDN]);
  await cite(ask, designated.act, SDN, 'TEST PERSON is designated');
  const vesselListed = await relation(held, 'designated_by', VESSEL, LIST, [SDN]);
  const hiddenOwns = await relation(held, 'operates', HIDDEN_OWNER, VESSEL, [SHIPS]);
  const otherWorks = await relation(held, 'associated_with', OTHER_PERSON, OWNER, [PAGE]);
  // A candidate that nobody decided is not part of the record.
  await held
    .as('gabriel_app')
    .query(`SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[])`, [
      JSON.stringify({ type: 'vessel', label: 'TEST CANDIDATE VESSEL' }),
    ]);
  return { owns, designated, vesselListed, hiddenOwns, otherWorks };
};

// Each file starts with a byte order mark and comment lines; the CSV starts at the first line that
// is not one.
const tableOf = (text: string): Record<string, string>[] => {
  expect(text.codePointAt(0)).toBe(0xfeff);
  const body = text
    .slice(1)
    .split('\r\n')
    .filter((line) => !line.startsWith('#'))
    .join('\r\n');
  const [header, ...rows] = readCsv(body).map((record) => record.fields);
  return rows.map((row) =>
    Object.fromEntries((header ?? []).map((name, at) => [name, row[at] ?? ''])),
  );
};

const OURS = new Set([VESSEL, OWNER, HIDDEN_OWNER, LIST, PERSON, OTHER_PERSON]);

test('a release writes the public entities, relations and claims, each row with its label and licence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const made = await inTransaction(async (held) => {
    const ids = await record(held);
    const written = await writeRelease(held.as('gabriel_app'), MANIFEST, root);
    return { ids, written };
  });
  const folder = join(root, 'gab-release-2026-11-08');
  expect(made.written.folder).toBe(folder);
  expect((await readdir(folder)).sort()).toStrictEqual([
    'claims.csv',
    'entities.csv',
    'manifest.json',
    'relations.csv',
  ]);

  const text = async (name: string) => readFile(join(folder, name), 'utf8');
  const [entitiesText, relationsText, claimsText] = await Promise.all(
    ['entities.csv', 'relations.csv', 'claims.csv'].map(text),
  );
  if (entitiesText === undefined || relationsText === undefined || claimsText === undefined)
    throw new Error('a file is missing');

  // Each file holds the version, the day and the disclaimer with the two contact addresses.
  for (const one of [entitiesText, relationsText, claimsText]) {
    expect(one).toContain('# GAB dataset, version 0.1-test of 08/11/2026.');
    expect(one).toContain('# **About this data.**');
    expect(one).toContain('Report an error: https://example.org/report-an-error');
    expect(one).toContain('Right of reply: mailto:reply@example.org');
    expect(one).not.toContain('<link>');
    // No bought file is named, and no rating shows (S1).
    expect(one).not.toContain(BOUGHT);
    expect(one).not.toContain('a secret club');
    expect(one).not.toMatch(/\b[A-F][1-6]\b|digits?:|letters?:/u);
  }

  // The file manifest gives the checksum and the size of each file.
  const manifest = z
    .object({
      version: z.string(),
      date: z.string(),
      disclaimer: z.string(),
      files: z.array(z.object({ path: z.string(), bytes: z.number(), sha256: z.string() })),
    })
    .parse(JSON.parse(await text('manifest.json')));
  expect(manifest).toMatchObject({ version: '0.1-test', date: '2026-11-08' });
  expect(manifest.disclaimer).toContain('Right of reply: mailto:reply@example.org');
  expect(manifest.files.map((file) => file.path)).toStrictEqual([
    'entities.csv',
    'relations.csv',
    'claims.csv',
  ]);
  for (const file of manifest.files) {
    const bytes = await readFile(join(folder, file.path));
    expect(file).toStrictEqual({
      path: file.path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }

  // A company known from a bought filing only, and a person that no authority designates, are
  // not in the release. A candidate is not part of the record.
  const entities = tableOf(entitiesText).filter((row) => OURS.has(row['id'] ?? ''));
  expect(entities).toStrictEqual([
    {
      id: VESSEL,
      type: 'vessel',
      label: 'TEST TANKER',
      origin_label: MANUAL,
      licence: CC_BY,
      document_ids: `${GFW} ${SDN}`,
    },
    {
      id: OWNER,
      type: 'company',
      label: 'TEST OWNER LTD',
      origin_label: MANUAL,
      licence: DERIVED,
      document_ids: SHIPS,
    },
    {
      id: LIST,
      type: 'legal_act',
      label: 'TEST SANCTIONS LIST',
      origin_label: MANUAL,
      licence: CC_BY,
      document_ids: SDN,
    },
    {
      id: PERSON,
      type: 'person',
      label: 'TEST PERSON',
      origin_label: MANUAL,
      licence: DERIVED,
      document_ids: PAGE,
    },
  ]);
  expect(entitiesText).not.toContain('TEST CANDIDATE VESSEL');

  // A relation stays only when both of its ends are in the release.
  const relations = tableOf(relationsText).filter((row) => OURS.has(row['from_id'] ?? ''));
  const { owns, designated, vesselListed } = made.ids;
  expect(relations.map((row) => row['id']).sort()).toStrictEqual(
    [owns.id, designated.id, vesselListed.id].sort(),
  );
  expect(relations.find((row) => row['id'] === owns.id)).toStrictEqual({
    id: owns.id,
    type: 'owns',
    from_id: OWNER,
    from_label: 'TEST OWNER LTD',
    to_id: VESSEL,
    to_label: 'TEST TANKER',
    valid_from: '',
    valid_to: '',
    origin_label: MANUAL,
    licence: DERIVED,
    document_ids: SHIPS,
  });

  // One row for each claim and each cited passage of a public document.
  const claims = tableOf(claimsText).filter((row) => OURS.has(row['subject_id'] ?? ''));
  const of = (claim: string) => claims.filter((row) => row['claim_id'] === claim);
  expect(of(`${VESSEL}/imo`)).toStrictEqual([
    {
      claim_id: `${VESSEL}/imo`,
      claim_kind: 'attribute',
      subject_kind: 'entity',
      subject_id: VESSEL,
      subject_label: 'TEST TANKER',
      attribute: 'imo',
      value: '9123456',
      relation_type: '',
      object_id: '',
      object_label: '',
      valid_from: '',
      valid_to: '',
      origin_label: RULE,
      licence: CC_BY,
      document_id: SDN,
      document_title: 'OFAC SDN list',
      document_address: 'https://example.org/sdn.csv',
      document_read_on: '2026-10-01',
      page: '1',
      excerpt: 'IMO 9123456',
    },
  ]);
  // The value names its public document only, and takes the licence of that document.
  expect(of(`${VESSEL}/flag`)).toMatchObject([
    { licence: CC_BY_NC, document_id: GFW, page: '1', excerpt: 'flag of Panama' },
  ]);
  expect(of(`${VESSEL}/speed_knots`)).toMatchObject([
    { value: '12', licence: DERIVED, document_id: SHIPS, excerpt: '12 knots' },
  ]);
  // A value that only a bought filing holds up is not public.
  expect(of(`${VESSEL}/insurer_note`)).toStrictEqual([]);
  expect(of(owns.id)).toStrictEqual([
    {
      claim_id: owns.id,
      claim_kind: 'relation',
      subject_kind: 'entity',
      subject_id: OWNER,
      subject_label: 'TEST OWNER LTD',
      attribute: '',
      value: '',
      relation_type: 'owns',
      object_id: VESSEL,
      object_label: 'TEST TANKER',
      valid_from: '',
      valid_to: '',
      origin_label: MANUAL,
      licence: DERIVED,
      document_id: SHIPS,
      document_title: 'Ship register answer',
      document_address: 'https://example.org/ships',
      document_read_on: '2026-10-03',
      page: '1',
      excerpt: 'TEST OWNER LTD owns TEST TANKER',
    },
  ]);
  // A public document with no cited passage still names the source of the claim.
  expect(of(vesselListed.id)).toMatchObject([{ document_id: SDN, page: '', excerpt: '' }]);
  expect(claims.some((row) => row['claim_id'] === made.ids.hiddenOwns.id)).toBe(false);
  expect(claims.some((row) => row['claim_id'] === made.ids.otherWorks.id)).toBe(false);
});

test('a release never writes over a release of the same date', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  await inTransaction(async ({ as }) => {
    await writeRelease(as('gabriel_app'), MANIFEST, root);
    await expect(writeRelease(as('gabriel_app'), MANIFEST, root)).rejects.toThrow(/exists/u);
  });
  expect(await readdir(root)).toStrictEqual(['gab-release-2026-11-08']);
});

test.each([
  'release_entities()',
  'release_relations()',
  'release_claims()',
  'release_documents()',
  'release_disclaimer()',
])('the public read role cannot execute %s', async (call) => {
  await inTransaction(async ({ ask }) => {
    await ask('SET LOCAL ROLE gabriel_read');
    await expect(ask(`SELECT * FROM public.${call}`)).rejects.toThrow(/permission denied/u);
  });
});
