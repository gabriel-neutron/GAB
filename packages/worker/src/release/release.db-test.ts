// The release against the disposable database: the superuser writes a small record in one
// transaction that rolls back, and the release reads it as the operator role and writes its folder
// in a temporary folder. The test reads the files that the release wrote.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readCsv } from '@gab/tools/csv';
import { Pool } from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { Queryable } from '../queryable.ts';
import { natoCoverageReport } from './nato-coverage.ts';
import { releaseCommand } from './release-command.ts';
import { readReleaseRecord } from './release-record.ts';
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
  iriBase: 'https://data.example.org/gab/',
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
const TWO = 'doc_release_two';
const ONLY_HIDDEN = 'doc_release_only_hidden';

const TEXT: Record<string, string> = {
  [SDN]:
    'The vessel TEST TANKER, IMO 9123456, is designated. TEST PERSON is designated. TEST OLD STAR has the call sign 5LAB2.',
  [TWO]: 'TEST SECOND TANKER, former name OLD STAR, IMO 9999999, is listed.',
  [GFW]: 'TEST TANKER sails under the flag of Panama.',
  [SHIPS]: 'TEST TANKER makes 12 knots. TEST OWNER LTD owns TEST TANKER. It holds 51 percent.',
  [PAGE]: 'TEST PERSON and TEST OTHER PERSON work for TEST OWNER LTD.',
  [BOUGHT]: 'TEST TANKER is insured by a secret club.',
  [ONLY_HIDDEN]: 'TEST PERSON OF A PERSON lives here.',
};

const VESSEL = '00000000-0000-4000-8000-00000000e001';
const OWNER = '00000000-0000-4000-8000-00000000e002';
const HIDDEN_OWNER = '00000000-0000-4000-8000-00000000e003';
const LIST = '00000000-0000-4000-8000-00000000e004';
const PERSON = '00000000-0000-4000-8000-00000000e005';
const OTHER_PERSON = '00000000-0000-4000-8000-00000000e006';
const SECOND = '00000000-0000-4000-8000-00000000e007';
const LISTED_BY_BOUGHT = '00000000-0000-4000-8000-00000000e008';
const LISTED_BY_PERSON = '00000000-0000-4000-8000-00000000e009';
const ABSORBED = '00000000-0000-4000-8000-00000000e00a';
const UNDONE = '00000000-0000-4000-8000-00000000e00b';
const BOUGHT_SHIP = '00000000-0000-4000-8000-00000000e00c';
const BOUGHT_TWIN = '00000000-0000-4000-8000-00000000e00d';

const documents = async (ask: Ask) => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, cost_eur, provider_id) VALUES
       ($1, 'url', 'OFAC SDN list', 'https://example.org/sdn.csv', '2026-10-01', NULL, 'ofac_sdn'),
       ($2, 'api', 'GFW answer', 'https://example.org/gfw', '2026-10-02', NULL, 'gfw'),
       ($3, 'api', 'Ship register answer', 'https://example.org/ships', '2026-10-03', NULL,
        'datalastic'),
       ($4, 'url', 'A news page', 'https://example.org/news', '2026-10-04', NULL, NULL),
       ($5, 'url', 'A bought filing', 'https://example.org/filing', '2026-10-05', 25.00, NULL),
       ($6, 'url', 'A second list', 'https://example.org/two', '2026-10-06', NULL, 'ofac_sdn'),
       ($7, 'url', 'A page on a hidden person', 'https://example.org/hidden', '2026-10-07', NULL,
        NULL)`,
    [SDN, GFW, SHIPS, PAGE, BOUGHT, TWO, ONLY_HIDDEN],
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
  status: 'accepted' | 'rejected' = 'accepted',
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
        SET status = $4, decided_at = $2::date + time '12:00', decided_by = 'a test',
            decided_as = 'unit', decision_origin = $3,
            reject_reason = CASE WHEN $4 = 'rejected' THEN 'wrong_value' END,
            decision_reason = CASE WHEN $3 = 'decided by an AI reviewer'
                                   THEN 'The passage states it.' END
      WHERE id = $1`,
    [id, day, origin, status],
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
  attrs: Record<string, unknown> = {},
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
      `INSERT INTO public.relations (type, src_id, dst_id, sources, attrs, promoted_from)
         VALUES ($1, $2, $3, $4::doc_id[], $5::jsonb, $6) RETURNING id`,
      [type, src, dst, sources, JSON.stringify(attrs), act],
    ),
  );
  if (made === undefined) throw new Error('the relation was not written');
  return { id: made.id, act };
};

// A small record: a vessel with four values, its owner, an owner known from a bought filing only,
// a sanctions list, a designated person and three persons that no release may hold, and a second
// vessel whose one act cites one document for each of its values.
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
  // The vessel has a position: longitude 32.5 east, latitude 46.6 north.
  await ask(
    'UPDATE public.entities SET geom = public.ST_SetSRID(public.ST_MakePoint(32.5, 46.6), 4326) WHERE id = $1',
    [VESSEL],
  );
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
  // The operator rejected a later value of the flag. The record keeps the accepted one.
  const rejected = await decidedAct(
    held,
    'update_attrs',
    { attrs: { flag: value('Liberia', ['manual']) } },
    { kind: 'entity', id: VESSEL },
    'validated manually by the operator',
    '2026-10-10',
    ['manual'],
    'rejected',
  );
  await cite(ask, rejected, SDN, 'The vessel TEST TANKER');

  const secondAct = await entity(held, SECOND, 'vessel', 'TEST SECOND TANKER', [TWO], {
    former_name: value('OLD STAR', [TWO]),
    imo: value('9999999', [TWO]),
    built: value('2001', [TWO]),
  });
  await cite(ask, secondAct, TWO, 'former name OLD STAR');
  await cite(ask, secondAct, TWO, 'IMO 9999999');

  await entity(held, OWNER, 'company', 'TEST OWNER LTD', [SHIPS]);
  // The site of the owner, with its ring in the clockwise order.
  await ask(
    `UPDATE public.entities
        SET geom = public.ST_SetSRID(public.ST_GeomFromText(
                     'POLYGON((30 46, 30 47, 31 47, 30 46))'), 4326)
      WHERE id = $1`,
    [OWNER],
  );
  await entity(held, HIDDEN_OWNER, 'company', 'TEST HIDDEN OWNER', [BOUGHT]);
  await entity(held, LIST, 'legal_act', 'TEST SANCTIONS LIST', [SDN]);
  await entity(held, PERSON, 'person', 'TEST PERSON', [PAGE], {
    nationality: value('Narnia', [BOUGHT]),
  });
  await entity(held, OTHER_PERSON, 'person', 'TEST OTHER PERSON', [PAGE]);
  await entity(held, LISTED_BY_BOUGHT, 'person', 'TEST BOUGHT PERSON', [PAGE]);
  // A public document that only a person out of the release cites is not in the release.
  await entity(held, LISTED_BY_PERSON, 'person', 'TEST PERSON OF A PERSON', [ONLY_HIDDEN]);

  const owns = await relation(held, 'owns', OWNER, VESSEL, [SHIPS]);
  await cite(ask, owns.act, SHIPS, 'TEST OWNER LTD owns TEST TANKER');
  const shareAct = await decidedAct(
    held,
    'update_relation',
    { attrs: { share_percent: value('51', ['manual']) } },
    { kind: 'relation', id: owns.id },
    'decided by an AI reviewer',
    '2026-10-09',
  );
  await cite(ask, shareAct, SHIPS, 'It holds 51 percent');
  await held.ask(`UPDATE public.relations SET attrs = $2::jsonb WHERE id = $1`, [
    owns.id,
    JSON.stringify({ share_percent: value('51', [SHIPS]) }),
  ]);
  const designated = await relation(held, 'designated_by', PERSON, LIST, [SDN]);
  await cite(ask, designated.act, SDN, 'TEST PERSON is designated');
  const vesselListed = await relation(held, 'designated_by', VESSEL, LIST, [SDN]);
  const hiddenOwns = await relation(held, 'operates', HIDDEN_OWNER, VESSEL, [SHIPS]);
  const otherWorks = await relation(held, 'associated_with', OTHER_PERSON, OWNER, [PAGE]);
  // A designation that only a bought filing holds up, and a designation by a person, make no
  // person public.
  await relation(held, 'designated_by', LISTED_BY_BOUGHT, LIST, [BOUGHT]);
  await relation(held, 'designated_by', LISTED_BY_PERSON, PERSON, [SDN]);
  // A candidate that nobody decided is not part of the record.
  await held
    .as('gabriel_app')
    .query(`SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[])`, [
      JSON.stringify({ type: 'vessel', label: 'TEST CANDIDATE VESSEL' }),
    ]);
  return { owns, designated, vesselListed, hiddenOwns, otherWorks, vesselAct, imoAct, shareAct };
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

const OURS = new Set([
  VESSEL,
  OWNER,
  HIDDEN_OWNER,
  LIST,
  PERSON,
  OTHER_PERSON,
  SECOND,
  LISTED_BY_BOUGHT,
  LISTED_BY_PERSON,
]);

test('a release writes the public entities, relations and claims, each row with its label and licence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const made = await inTransaction(async (held) => {
    const ids = await record(held);
    const written = await writeRelease(held.as('gabriel_app'), MANIFEST, root);
    const read = await readReleaseRecord(held.as('gabriel_app'), { natoPair: false });
    return { ids, written, read };
  });
  const folder = join(root, 'gab-release-2026-11-08');
  expect(made.written.folder).toBe(folder);
  expect((await readdir(folder)).sort()).toStrictEqual([
    'alignment-matrix.csv',
    'claims.csv',
    'dataset.jsonld',
    'entities.csv',
    'entities.geojson',
    'manifest.json',
    'merges.csv',
    'relations.csv',
  ]);

  const text = async (name: string) => readFile(join(folder, name), 'utf8');
  const [entitiesText, relationsText, claimsText, geojsonText, jsonldText] = await Promise.all(
    ['entities.csv', 'relations.csv', 'claims.csv', 'entities.geojson', 'dataset.jsonld'].map(text),
  );
  if (
    entitiesText === undefined ||
    relationsText === undefined ||
    claimsText === undefined ||
    geojsonText === undefined ||
    jsonldText === undefined
  )
    throw new Error('a file is missing');

  for (const one of [entitiesText, relationsText, claimsText])
    expect(one).toContain('# GAB dataset, version 0.1-test of 08/11/2026.');
  // Each file holds the version, the day and the disclaimer with the two contact addresses.
  const matrixText = await text('alignment-matrix.csv');
  for (const one of [
    entitiesText,
    relationsText,
    claimsText,
    geojsonText,
    jsonldText,
    matrixText,
  ]) {
    expect(one).toContain('GAB dataset, version 0.1-test of 08/11/2026.');
    expect(one).toContain('**About this data.**');
    expect(one).toContain('Report an error: https://example.org/report-an-error');
    expect(one).toContain('Right of reply: mailto:reply@example.org');
    expect(one).not.toContain('<link>');
    // No bought file is named, and no rating shows (S1).
    expect(one).not.toContain(BOUGHT);
    expect(one).not.toContain(ONLY_HIDDEN);
    expect(one).not.toContain('a secret club');
    expect(one).not.toContain('Narnia');
    expect(one).not.toContain('Liberia');
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
    'merges.csv',
    'alignment-matrix.csv',
    'entities.geojson',
    'dataset.jsonld',
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
    {
      id: SECOND,
      type: 'vessel',
      label: 'TEST SECOND TANKER',
      origin_label: MANUAL,
      licence: CC_BY,
      document_ids: TWO,
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
  const claims = tableOf(claimsText).filter(
    (row) => OURS.has(row['subject_id'] ?? '') || row['subject_id'] === owns.id,
  );
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
      modality: 'asserts',
      transcribed: 'false',
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
      modality: 'asserts',
      transcribed: 'false',
    },
  ]);
  // A public document with no cited passage still names the source of the claim.
  expect(of(vesselListed.id)).toMatchObject([
    { document_id: SDN, page: '', excerpt: '', modality: '', transcribed: '' },
  ]);
  // A value of a relation is a claim of its own, with the label of the act that set it.
  expect(of(`${owns.id}/share_percent`)).toMatchObject([
    {
      claim_kind: 'attribute',
      subject_kind: 'relation',
      subject_id: owns.id,
      subject_label: 'TEST OWNER LTD owns TEST TANKER',
      attribute: 'share_percent',
      value: '51',
      origin_label: 'Accepted by an AI reviewer — no person read it, on 2026-10-09',
      licence: DERIVED,
      excerpt: 'It holds 51 percent',
    },
  ]);
  // One act cites one document for each value: each value keeps the passage that holds it, and a
  // value that no passage holds keeps each passage of its act in that document.
  expect(of(`${SECOND}/former_name`).map((row) => row['excerpt'])).toStrictEqual([
    'former name OLD STAR',
  ]);
  expect(of(`${SECOND}/imo`).map((row) => row['excerpt'])).toStrictEqual(['IMO 9999999']);
  expect(
    of(`${SECOND}/built`)
      .map((row) => row['excerpt'])
      .sort(),
  ).toStrictEqual(['IMO 9999999', 'former name OLD STAR']);
  // A later rejected act changes nothing: the value, the label and the passage are the accepted ones.
  expect(of(`${VESSEL}/flag`)).toMatchObject([{ value: 'Panama', origin_label: MANUAL }]);
  const claimOf = (id: string) => made.read.claims.find((one) => one.claim_id === id);
  expect(claimOf(`${VESSEL}/flag`)?.act_id).toBe(made.ids.vesselAct);
  expect(claimOf(`${VESSEL}/imo`)?.act_id).toBe(made.ids.imoAct);
  expect(claimOf(`${owns.id}/share_percent`)?.act_id).toBe(made.ids.shareAct);
  // A person with a designation keeps no value that a public document does not hold up.
  expect(of(`${PERSON}/nationality`)).toStrictEqual([]);
  expect(claims.some((row) => row['claim_id'] === made.ids.hiddenOwns.id)).toBe(false);
  expect(claims.some((row) => row['claim_id'] === made.ids.otherWorks.id)).toBe(false);

  // The GeoJSON holds the entity with a position, with the columns of the CSV, and the longitude
  // before the latitude.
  const geojson = z
    .object({
      type: z.literal('FeatureCollection'),
      name: z.string(),
      disclaimer: z.string(),
      features: z.array(
        z.object({
          type: z.literal('Feature'),
          id: z.string(),
          geometry: z.unknown(),
          properties: z.record(z.string(), z.string()),
        }),
      ),
    })
    .parse(JSON.parse(geojsonText));
  const features = geojson.features.filter((one) => OURS.has(one.id));
  expect(features.map((one) => one.id)).toStrictEqual([VESSEL, OWNER]);
  expect(features[0]).toStrictEqual({
    type: 'Feature',
    id: VESSEL,
    geometry: { type: 'Point', coordinates: [32.5, 46.6] },
    properties: entities.find((row) => row['id'] === VESSEL),
  });
  // RFC 7946: the outer ring of a polygon turns counter-clockwise.
  const ring =
    z
      .object({ coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) })
      .parse(features[1]?.geometry).coordinates[0] ?? [];
  const area = ring
    .slice(1)
    .reduce((sum, [x, y], at) => sum + (ring[at]?.[0] ?? 0) * y - x * (ring[at]?.[1] ?? 0), 0);
  expect(area).toBeGreaterThan(0);
  // An entity with no position has no feature, and no entity out of the release is in the file.
  for (const hidden of [LIST, HIDDEN_OWNER, OTHER_PERSON, LISTED_BY_BOUGHT, LISTED_BY_PERSON])
    expect(geojsonText).not.toContain(hidden);

  // The JSON-LD keeps the sources, the passages, the label and the licence of each claim, and
  // holds no entity that the release leaves out.
  const graph = z
    .object({ '@graph': z.array(z.record(z.string(), z.unknown())) })
    .parse(JSON.parse(jsonldText))['@graph'];
  const nodeOf = (id: string) => graph.find((one) => one['@id'] === id);
  expect(nodeOf(`claim/${VESSEL}/imo`)).toStrictEqual({
    '@id': `claim/${VESSEL}/imo`,
    '@type': 'Claim',
    claimId: `${VESSEL}/imo`,
    claimKind: 'attribute',
    about: `entity/${VESSEL}`,
    attribute: 'imo',
    value: '9123456',
    originLabel: RULE,
    licenceText: CC_BY,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    sources: [`document/${SDN}`],
    passages: [
      {
        '@type': 'Passage',
        document: `document/${SDN}`,
        page: 1,
        excerpt: 'IMO 9123456',
        modality: 'asserts',
        transcribed: false,
      },
    ],
  });
  expect(nodeOf(`claim/${owns.id}`)).toMatchObject({
    claimKind: 'relation',
    about: `relation/${owns.id}`,
    originLabel: MANUAL,
    licenceText: DERIVED,
    sources: [`document/${SHIPS}`],
  });
  expect(nodeOf(`entity/${VESSEL}`)).toMatchObject({ name: 'TEST TANKER', licenceText: CC_BY });
  expect(nodeOf(`document/${SDN}`)).toMatchObject({ title: 'OFAC SDN list' });
  for (const hidden of [HIDDEN_OWNER, OTHER_PERSON, LISTED_BY_BOUGHT, LISTED_BY_PERSON])
    expect(jsonldText).not.toContain(hidden);
  expect(jsonldText).not.toContain(made.ids.hiddenOwns.id);
});

const mergeDoor = async (db: Queryable, text: string, values: readonly unknown[]) => {
  const { rows } = await db.query(text, [...values]);
  const id = z.array(z.object({ proposal_id: z.uuid() })).parse(rows)[0]?.proposal_id;
  if (id === undefined) throw new Error('the door wrote no act');
  return id;
};

test('a release writes the log of the merges, and a moved value keeps the label of its act', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const made = await inTransaction(async (held) => {
    await record(held);
    // A rule set the call sign of the absorbed vessel, and the merge moves it to the survivor.
    const absorbedAct = await entity(held, ABSORBED, 'vessel', 'TEST OLD STAR', [TWO]);
    const callSignAct = await decidedAct(
      held,
      'update_attrs',
      { attrs: { call_sign: value('5LAB2', [SDN]) } },
      { kind: 'entity', id: ABSORBED },
      'rule strong_sources v1 (fact digits: 1, letters: B)',
      '2026-10-09',
      [SDN],
    );
    await cite(held.ask, callSignAct, SDN, 'call sign 5LAB2');
    await held.ask(`UPDATE public.entities SET attrs = $2::jsonb WHERE id = $1`, [
      ABSORBED,
      JSON.stringify({ call_sign: value('5LAB2', [SDN]) }),
    ]);
    await entity(held, UNDONE, 'vessel', 'TEST UNDONE TANKER', [TWO]);
    const app = held.as('gabriel_app');
    const MERGE = `SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`;
    const merged = await mergeDoor(app, MERGE, [SECOND, ABSORBED]);
    const undoneMerge = await mergeDoor(app, MERGE, [SECOND, UNDONE]);
    const undo = await mergeDoor(app, `SELECT * FROM public.undo_merge('a test', $1::uuid)`, [
      UNDONE,
    ]);
    // A merge of two persons is not in the log of a release.
    await mergeDoor(app, MERGE, [PERSON, OTHER_PERSON]);
    // Two vessels that only a bought filing holds up are not in the release, nor is their merge.
    await entity(held, BOUGHT_SHIP, 'vessel', 'TEST BOUGHT SHIP', [BOUGHT]);
    await entity(held, BOUGHT_TWIN, 'vessel', 'TEST BOUGHT TWIN', [BOUGHT]);
    await mergeDoor(app, MERGE, [BOUGHT_SHIP, BOUGHT_TWIN]);
    await writeRelease(app, MANIFEST, root);
    return {
      absorbedAct,
      callSignAct,
      merged,
      undoneMerge,
      undo,
      read: await readReleaseRecord(app, { natoPair: false }),
    };
  });
  const folder = join(root, 'gab-release-2026-11-08');
  const merges = tableOf(await readFile(join(folder, 'merges.csv'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const label = `Validated manually by the operator, on ${today}`;
  const mergesText = await readFile(join(folder, 'merges.csv'), 'utf8');
  expect(mergesText).not.toContain(BOUGHT_SHIP);
  expect(mergesText).not.toContain(BOUGHT_TWIN);
  expect(merges.filter((row) => [SECOND, PERSON].includes(row['survivor_id'] ?? ''))).toStrictEqual(
    [
      {
        act_id: made.merged,
        action: 'merge',
        day: today,
        absorbed_id: ABSORBED,
        survivor_id: SECOND,
        resolves_to: SECOND,
        origin_label: label,
      },
      {
        act_id: made.undoneMerge,
        action: 'merge',
        day: today,
        absorbed_id: UNDONE,
        survivor_id: SECOND,
        resolves_to: '',
        origin_label: label,
      },
      {
        act_id: made.undo,
        action: 'undo',
        day: today,
        absorbed_id: UNDONE,
        survivor_id: SECOND,
        resolves_to: '',
        origin_label: label,
      },
    ].sort((one, two) => one.act_id.localeCompare(two.act_id)),
  );

  // The value that the merge moved keeps the label, the act and the passage of the rule.
  const claims = tableOf(await readFile(join(folder, 'claims.csv'), 'utf8'));
  expect(claims.filter((row) => row['claim_id'] === `${SECOND}/call_sign`)).toMatchObject([
    { value: '5LAB2', origin_label: RULE, document_id: SDN, excerpt: 'call sign 5LAB2' },
  ]);
  expect(made.read.claims.find((one) => one.claim_id === `${SECOND}/call_sign`)?.act_id).toBe(
    made.callSignAct,
  );
  const entities = tableOf(await readFile(join(folder, 'entities.csv'), 'utf8'));
  expect(entities.map((row) => row['id'])).not.toContain(ABSORBED);
  expect(entities.map((row) => row['id'])).toContain(UNDONE);

  // In the JSON-LD, the absorbed entity is replaced by the survivor while the merge stands.
  const jsonld = await readFile(join(folder, 'dataset.jsonld'), 'utf8');
  const graph = z
    .object({ '@graph': z.array(z.record(z.string(), z.unknown())) })
    .parse(JSON.parse(jsonld))['@graph'];
  expect(graph.find((one) => one['@id'] === `entity/${ABSORBED}`)).toStrictEqual({
    '@id': `entity/${ABSORBED}`,
    isReplacedBy: `entity/${SECOND}`,
  });
  expect(graph.find((one) => one['@id'] === `entity/${UNDONE}`)).toMatchObject({
    '@type': 'Entity',
  });
  expect(jsonld).not.toContain(BOUGHT_TWIN);
});

// The research AI wrote the act that set the IMO number, from the list of an issuer A on its own
// record, and a second model family checked it. So its claim has the pair A3: one known author.
const PAIRED_AUTHOR = 'TEST SANCTIONS ISSUER';
const pairTheImo = async (ask: Ask, imoAct: string) => {
  await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await ask(
    `UPDATE public.proposals
        SET author_role = 'gabriel_research', originator = $2, src = ARRAY[$3]::doc_id[],
            payload = jsonb_build_object('attrs', jsonb_build_object(
                        'imo', jsonb_build_object('v', '9123456', 'src', jsonb_build_array($3))))
      WHERE id = $1`,
    [imoAct, PAIRED_AUTHOR, SDN],
  );
  await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
  await ask(
    `WITH made AS (
       INSERT INTO public.author (name_key, letter, model, reason, reference_set)
       VALUES (public.name_key($1), 'A', 'a-seed-model', 'the issuer of the list', true)
       RETURNING id, name_key
     ), named AS (
       INSERT INTO public.author_name (name_key, author_id) SELECT name_key, id FROM made
     )
     INSERT INTO public.reference_approval (author_id) SELECT id FROM made`,
    [PAIRED_AUTHOR],
  );
  await ask(
    `INSERT INTO public.act_check (proposal_id, checker_model, checker_family, reader_family,
                                   verdict)
     VALUES ($1, 'a-checker', 'openai', 'anthropic', 'supported')`,
    [imoAct],
  );
};

test('a release shows the NATO pair only when its manifest asks for it', async () => {
  const off = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const on = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const report = await inTransaction(async (held) => {
    const ids = await record(held);
    await pairTheImo(held.ask, ids.imoAct);
    await writeRelease(held.as('gabriel_app'), MANIFEST, off);
    await writeRelease(held.as('gabriel_app'), { ...MANIFEST, showNatoPair: true }, on);
    return natoCoverageReport(held.as('gabriel_app'));
  });
  const folderOf = (root: string) => join(root, 'gab-release-2026-11-08');
  const files = (await readdir(folderOf(off))).sort();
  expect(files).toStrictEqual((await readdir(folderOf(on))).sort());

  // Off: no file holds a letter, a digit or a term of the pair.
  for (const name of files) {
    const text = await readFile(join(folderOf(off), name), 'utf8');
    expect(text).not.toMatch(/nato_|natoLetter|natoDigit|NATO/u);
    expect(text).not.toMatch(/\b[A-F][1-6]\b|digits?:|letters?:/u);
  }
  const manifestOf = async (root: string) =>
    z
      .object({ showNatoPair: z.boolean() })
      .parse(JSON.parse(await readFile(join(folderOf(root), 'manifest.json'), 'utf8')));
  expect(await manifestOf(off)).toMatchObject({ showNatoPair: false });

  // On: the manifest says so, and each claim row that has a pair gives it.
  expect(await manifestOf(on)).toMatchObject({ showNatoPair: true });
  const claims = tableOf(await readFile(join(folderOf(on), 'claims.csv'), 'utf8'));
  const paired = claims.filter((row) => row['nato_letter'] !== '');
  expect(
    paired.map((row) => [row['claim_id'], row['nato_letter'], row['nato_digit']]),
  ).toStrictEqual([[`${VESSEL}/imo`, 'A', '3']]);
  expect(claims.filter((row) => row['nato_digit'] !== '')).toHaveLength(1);
  const graph = z
    .object({ '@graph': z.array(z.record(z.string(), z.unknown())) })
    .parse(JSON.parse(await readFile(join(folderOf(on), 'dataset.jsonld'), 'utf8')))['@graph'];
  expect(graph.find((one) => one['@id'] === `claim/${VESSEL}/imo`)).toMatchObject({
    natoLetter: 'A',
    natoDigit: 3,
  });
  expect(graph.filter((one) => 'natoLetter' in one)).toHaveLength(1);
  // Only the claims show the pair.
  for (const name of ['entities.csv', 'relations.csv', 'merges.csv', 'entities.geojson'])
    expect(await readFile(join(folderOf(on), name), 'utf8')).not.toMatch(/nato/iu);

  // The report counts the public claims of the release and those with a full pair.
  const claimCount = new Set(claims.map((row) => row['claim_id'])).size;
  expect(report[0]).toBe('group\twith a full pair\tpublic claims\tshare');
  expect(report[1]?.split('\t').slice(0, 3)).toStrictEqual(['all', '1', String(claimCount)]);
  expect(report.find((line) => line.startsWith('entity vessel\t'))?.split('\t')[1]).toBe('1');
  expect(report.find((line) => line.startsWith('relation owns\t'))?.split('\t')[1]).toBe('0');
});

// The three official lists, each stored by its tool with its provider.
const EU_ACT_DOC = 'doc_release_eu_act';
const EU_AMENDMENT_DOC = 'doc_release_eu_amendment';
const SDN_FILE = 'doc_release_sdn_file';
const UK_FILE = 'doc_release_uk_file';
const MATRIX_SHIP = '00000000-0000-4000-8000-00000000f001';
const MATRIX_RENAMED = '00000000-0000-4000-8000-00000000f002';
const MATRIX_EU_ONLY = '00000000-0000-4000-8000-00000000f003';
const MATRIX_NO_IMO = '00000000-0000-4000-8000-00000000f004';
const MATRIX_EU_ACT = '00000000-0000-4000-8000-00000000f005';
const MATRIX_EU_AMENDMENT = '00000000-0000-4000-8000-00000000f006';
const MATRIX_SDN = '00000000-0000-4000-8000-00000000f007';
const MATRIX_UK = '00000000-0000-4000-8000-00000000f008';
const MATRIX_BOUGHT_SHIP = '00000000-0000-4000-8000-00000000f009';

const dated = async (ask: Ask, made: { id: string }, day: string | null) => {
  await ask('UPDATE public.relations SET valid_from = $2::date WHERE id = $1', [made.id, day]);
  return made.id;
};

test('a release writes the alignment matrix of the EU, OFAC and UK lists, one row for each IMO number', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const ids = await inTransaction(async (held) => {
    const { ask } = held;
    await documents(ask);
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, provider_id) VALUES
         ($1, 'url', 'Council Regulation', 'https://example.org/eu-act', '2026-10-01', 'eu_eurlex'),
         ($2, 'url', 'Council Implementing Regulation', 'https://example.org/eu-amendment',
          '2026-10-01', 'eu_eurlex'),
         ($3, 'url', 'SDN list', 'https://example.org/sdn-file', '2026-10-01', 'ofac_sdn'),
         ($4, 'url', 'UK Sanctions List', 'https://example.org/uk-file', '2026-10-01',
          'uk_sanctions_list')`,
      [EU_ACT_DOC, EU_AMENDMENT_DOC, SDN_FILE, UK_FILE],
    );
    // One vessel and its renamed twin carry one IMO number. The record has not merged them yet.
    await entity(held, MATRIX_SHIP, 'vessel', 'TEST MATRIX TANKER', [SDN_FILE], {
      imo: value('9811000', [SDN_FILE]),
    });
    await entity(held, MATRIX_RENAMED, 'vessel', 'TEST MATRIX NEW NAME', [UK_FILE], {
      imo: value('IMO 9811000', [UK_FILE]),
    });
    await entity(held, MATRIX_EU_ONLY, 'vessel', 'TEST MATRIX EU SHIP', [EU_AMENDMENT_DOC], {
      imo: value('9822000', [EU_AMENDMENT_DOC]),
    });
    await entity(held, MATRIX_NO_IMO, 'vessel', 'TEST MATRIX NO IMO', [EU_ACT_DOC]);
    // A vessel that only a bought filing holds up is not public, so its IMO number is not either.
    await entity(held, MATRIX_BOUGHT_SHIP, 'vessel', 'TEST MATRIX BOUGHT SHIP', [BOUGHT], {
      imo: value('9833000', [BOUGHT]),
    });
    await entity(held, MATRIX_EU_ACT, 'legal_act', 'TEST COUNCIL REGULATION', [EU_ACT_DOC]);
    // The amendment states its entry into force, and its designation has no start date.
    await entity(
      held,
      MATRIX_EU_AMENDMENT,
      'legal_act',
      'TEST IMPLEMENTING REGULATION',
      [EU_AMENDMENT_DOC],
      { entry_into_force: value('2025-05-20', [EU_AMENDMENT_DOC]) },
    );
    await entity(held, MATRIX_SDN, 'legal_act', 'TEST SDN LIST', [SDN_FILE]);
    await entity(held, MATRIX_UK, 'legal_act', 'TEST UK LIST', [UK_FILE]);

    const relationOf = (src: string, dst: string, sources: readonly string[]) =>
      relation(held, 'designated_by', src, dst, sources);
    return {
      eu: await dated(
        ask,
        await relationOf(MATRIX_SHIP, MATRIX_EU_ACT, [EU_ACT_DOC]),
        '2024-06-24',
      ),
      ofac: await dated(ask, await relationOf(MATRIX_SHIP, MATRIX_SDN, [SDN_FILE]), '2024-02-23'),
      uk: await dated(ask, await relationOf(MATRIX_RENAMED, MATRIX_UK, [UK_FILE]), '2024-05-09'),
      euOnly: await dated(
        ask,
        await relationOf(MATRIX_EU_ONLY, MATRIX_EU_AMENDMENT, [EU_AMENDMENT_DOC]),
        null,
      ),
      noImo: await dated(
        ask,
        await relationOf(MATRIX_NO_IMO, MATRIX_EU_ACT, [EU_ACT_DOC]),
        '2024-06-24',
      ),
      bought: await dated(
        ask,
        await relationOf(MATRIX_BOUGHT_SHIP, MATRIX_SDN, [SDN_FILE]),
        '2024-02-23',
      ),
      written: await writeRelease(held.as('gabriel_app'), MANIFEST, root),
    };
  });
  const folder = join(root, 'gab-release-2026-11-08');
  const matrixText = await readFile(join(folder, 'alignment-matrix.csv'), 'utf8');
  const ours = new Set([MATRIX_SHIP, MATRIX_RENAMED, MATRIX_EU_ONLY, MATRIX_NO_IMO]);
  const rows = tableOf(matrixText).filter((row) =>
    (row['vessel_ids'] ?? '').split(' ').some((one) => ours.has(one)),
  );

  // The vessel and its renamed twin give one row. The vessel with no IMO number is not in the
  // matrix, and the vessel that only a bought filing holds up is not either.
  expect(rows).toStrictEqual([
    {
      imo: '9811000',
      vessel_ids: `${MATRIX_SHIP} ${MATRIX_RENAMED}`,
      vessel_labels: 'TEST MATRIX TANKER; TEST MATRIX NEW NAME',
      imo_claim_ids: `${MATRIX_SHIP}/imo ${MATRIX_RENAMED}/imo`,
      eu_listed_on: '2024-06-24',
      eu_date_from: 'designation_start',
      eu_date_claim_id: ids.eu,
      eu_act_id: MATRIX_EU_ACT,
      eu_act_label: 'TEST COUNCIL REGULATION',
      eu_document_ids: EU_ACT_DOC,
      eu_claim_id: ids.eu,
      ofac_listed_on: '2024-02-23',
      ofac_date_from: 'designation_start',
      ofac_date_claim_id: ids.ofac,
      ofac_act_id: MATRIX_SDN,
      ofac_act_label: 'TEST SDN LIST',
      ofac_document_ids: SDN_FILE,
      ofac_claim_id: ids.ofac,
      uk_listed_on: '2024-05-09',
      uk_date_from: 'designation_start',
      uk_date_claim_id: ids.uk,
      uk_act_id: MATRIX_UK,
      uk_act_label: 'TEST UK LIST',
      uk_document_ids: UK_FILE,
      uk_claim_id: ids.uk,
      days_eu_after_ofac: '122',
      days_eu_after_uk: '46',
      days_uk_after_ofac: '76',
      ofac_or_uk_not_eu: 'false',
      eu_not_ofac: 'false',
    },
    // The EU lists this vessel and OFAC does not. Its designation has no start date, so the date
    // is the entry into force of the act.
    expect.objectContaining({
      imo: '9822000',
      eu_listed_on: '2025-05-20',
      eu_date_from: 'act_entry_into_force',
      eu_date_claim_id: `${MATRIX_EU_AMENDMENT}/entry_into_force`,
      eu_claim_id: ids.euOnly,
      ofac_claim_id: '',
      days_eu_after_ofac: '',
      ofac_or_uk_not_eu: 'false',
      eu_not_ofac: 'true',
    }),
  ]);
  expect(matrixText).not.toContain('9833000');
  expect(matrixText).not.toContain(ids.noImo);
  expect(matrixText).not.toContain(ids.bought);

  // Each claim that a row names is a claim of the release.
  const claimIds = new Set(
    tableOf(await readFile(join(folder, 'claims.csv'), 'utf8')).map((row) => row['claim_id']),
  );
  const named = rows.flatMap((row) =>
    [
      ...(row['imo_claim_ids'] ?? '').split(' '),
      ...['eu', 'ofac', 'uk'].flatMap((regime) => [
        row[`${regime}_claim_id`],
        row[`${regime}_date_claim_id`],
      ]),
    ].filter((one) => one !== undefined && one !== ''),
  );
  expect(named.length).toBeGreaterThan(0);
  for (const one of named) expect(claimIds).toContain(one);

  // The file states the date rule of each regime and holds the disclaimer, and the file manifest
  // gives the rules and the checksum of the file.
  expect(matrixText).toContain('# GAB dataset, version 0.1-test of 08/11/2026.');
  expect(matrixText).toContain('Right of reply: mailto:reply@example.org');
  expect(matrixText).toContain(
    'EU: the date of entry into force. OFAC: the date of the Recent Actions notice. UK: the date designated.',
  );
  const manifest = z
    .object({
      dateRules: z.record(z.string(), z.string()),
      files: z.array(z.object({ path: z.string(), sha256: z.string() })),
    })
    .parse(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')));
  expect(manifest.dateRules).toStrictEqual(MANIFEST.dateRules);
  expect(manifest.files.find((file) => file.path === 'alignment-matrix.csv')?.sha256).toBe(
    createHash('sha256').update(Buffer.from(matrixText, 'utf8')).digest('hex'),
  );
});

test('the command refuses a release of a date that the folder holds already', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  await mkdir(join(root, 'gab-release-2026-11-08'));
  const manifest = join(root, 'release.json');
  await writeFile(manifest, JSON.stringify({ date: '2026-11-08', contacts: MANIFEST.contacts }));
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  try {
    expect(await releaseCommand(['--manifest', manifest, '--out', root])).toBe(2);
  } finally {
    spy.mockRestore();
  }
  expect(lines.join('\n')).toContain('exists already');
  expect(lines.join('\n')).not.toContain(' at ');
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
  'release_merges()',
])('the public read role cannot execute %s', async (call) => {
  await inTransaction(async ({ ask }) => {
    await ask('SET LOCAL ROLE gabriel_read');
    await expect(ask(`SELECT * FROM public.${call}`)).rejects.toThrow(/permission denied/u);
  });
});
