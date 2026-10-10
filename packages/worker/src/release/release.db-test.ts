// The release against the disposable database: the superuser writes a small record in one
// transaction that rolls back, and the release reads it as the operator role and writes its folder
// in a temporary folder. The test reads the files that the release wrote.

import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCsv } from '@gab/tools/csv';
import { Pool } from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { Queryable } from '../queryable.ts';
import { CriticalNodesSheetFault } from './critical-nodes-sheet.ts';
import { natoCoverageReport } from './nato-coverage.ts';
import { PreviousReleaseFault } from './previous-release.ts';
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
    // A test turns the freeze trigger off with ALTER TABLE, which takes a SHARE ROW EXCLUSIVE lock
    // on the proposals. Taken after an insert, that lock waits for each other writer, and two
    // test files that do so wait for each other (40P01). Each transaction takes it first.
    await client.query('LOCK TABLE public.proposals IN SHARE ROW EXCLUSIVE MODE');
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
  [SHIPS]:
    'TEST TANKER makes 12 knots. TEST OWNER LTD owns TEST TANKER. It holds 51 percent. ' +
    'It sold TEST TANKER on 30 November 2023.',
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
    'changelog.csv',
    'claims.csv',
    'critical-nodes.csv',
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
    'critical-nodes.csv',
    'entities.geojson',
    'dataset.jsonld',
    'changelog.csv',
  ]);
  // With no previous release, the changelog says so and lists no change.
  const changelogText = await text('changelog.csv');
  expect(changelogText).toContain('# First release: no earlier release to compare.');
  expect(tableOf(changelogText)).toStrictEqual([]);
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

test('an end date that a later act gave is a claim of its own, with the label and the passages of that act', async () => {
  const claims = await inTransaction(async (held) => {
    const { owns } = await record(held);
    const close = await decidedAct(
      held,
      'update_relation',
      { valid_to: '2023-11-30' },
      { kind: 'relation', id: owns.id },
      'rule strong_sources v1 (fact digits: 1, letters: B)',
      '2026-10-09',
      [SHIPS],
    );
    await cite(held.ask, close, SHIPS, 'It sold TEST TANKER on 30 November 2023.');
    await held.ask(`UPDATE public.relations SET valid_to = '2023-11-30' WHERE id = $1`, [owns.id]);
    const { rows } = await held.as('gabriel_app').query(
      `SELECT claim_id, attribute, value, origin_label, sources, act_id, passages
           FROM public.release_claims() WHERE subject_id = $1 AND attribute IS DISTINCT FROM
           'share_percent' ORDER BY claim_id`,
      [owns.id],
    );
    return { owns, close, rows };
  });
  expect(claims.rows).toStrictEqual([
    {
      claim_id: claims.owns.id,
      attribute: null,
      value: null,
      origin_label: MANUAL,
      sources: [SHIPS],
      act_id: claims.owns.act,
      passages: [
        {
          document: SHIPS,
          page: 1,
          excerpt: 'TEST OWNER LTD owns TEST TANKER',
          modality: 'asserts',
          transcribed: false,
        },
      ],
    },
    {
      claim_id: `${claims.owns.id}/valid_to`,
      attribute: 'valid_to',
      value: '2023-11-30',
      origin_label: RULE,
      sources: [SHIPS],
      act_id: claims.close,
      passages: [
        {
          document: SHIPS,
          page: 1,
          excerpt: 'It sold TEST TANKER on 30 November 2023.',
          modality: 'asserts',
          transcribed: false,
        },
      ],
    },
  ]);
});

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

test('a release writes the changelog since the previous release folder', async () => {
  const first = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const second = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const refused = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const previous = join(first, 'gab-release-2026-11-08');
  const tampered = join(refused, 'tampered');
  const ids = await inTransaction(async (held) => {
    const made = await record(held);
    // The previous release shows the NATO pair, and the new one does not.
    await pairTheImo(held.ask, made.imoAct);
    const callSignAct = await entity(held, ABSORBED, 'vessel', 'TEST OLD STAR', [TWO], {
      call_sign: value('5LAB2', [SDN]),
    });
    await cite(held.ask, callSignAct, SDN, 'call sign 5LAB2');
    await entity(held, UNDONE, 'vessel', 'TEST UNDONE TANKER', [TWO]);
    const app = held.as('gabriel_app');
    const MERGE = `SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`;
    await mergeDoor(app, MERGE, [SECOND, UNDONE]);
    await writeRelease(app, { ...MANIFEST, showNatoPair: true }, first);

    // Between the two releases: the merge is undone, the old star merges into the second
    // vessel, and the owner gets a new name.
    await mergeDoor(app, `SELECT * FROM public.undo_merge('a test', $1::uuid)`, [UNDONE]);
    await mergeDoor(app, MERGE, [SECOND, ABSORBED]);
    await held.ask(`UPDATE public.entities SET label = 'TEST OWNER RENAMED' WHERE id = $1`, [
      OWNER,
    ]);
    await writeRelease(app, { ...MANIFEST, date: '2026-12-01' }, second, previous);

    // A previous release that is not earlier, and a copy of it that changed, are refused, and
    // nothing is written.
    await expect(writeRelease(app, MANIFEST, refused, previous)).rejects.toThrow(
      /not before 2026-11-08/u,
    );
    await cp(previous, tampered, { recursive: true });
    const claims = join(tampered, 'claims.csv');
    await writeFile(claims, (await readFile(claims, 'utf8')).replace('9123456', '9123457'));
    await expect(
      writeRelease(app, { ...MANIFEST, date: '2026-12-01' }, refused, tampered),
    ).rejects.toThrow(PreviousReleaseFault);
    return made;
  });
  expect(await readdir(refused)).toStrictEqual(['tampered']);

  const folder = join(second, 'gab-release-2026-12-01');
  const text = await readFile(join(folder, 'changelog.csv'), 'utf8');
  expect(text).toContain('# GAB dataset, version 0.1-test of 01/12/2026.');
  expect(text).toContain('# Changes since version 0.1-test of 08/11/2026.');
  expect(text).toContain('Right of reply: mailto:reply@example.org');
  // S1: the new release does not show the pair, so the changelog copies no letter and no digit
  // of the previous release.
  expect(text).not.toMatch(/nato|\b[A-F][1-6]\b|digits?:|letters?:/iu);

  const ours = new Set([...OURS, ABSORBED, UNDONE, ids.owns.id]);
  const rows = tableOf(text).filter((row) => ours.has((row['id'] ?? '').split('/')[0] ?? ''));
  expect(rows).toStrictEqual([
    {
      kind: 'entity',
      id: OWNER,
      change: 'changed',
      changed_columns: 'label',
      label: 'TEST OWNER RENAMED',
      survivor_id: '',
    },
    {
      kind: 'entity',
      id: ABSORBED,
      change: 'merged',
      changed_columns: '',
      label: 'TEST OLD STAR',
      survivor_id: SECOND,
    },
    {
      kind: 'entity',
      id: UNDONE,
      change: 'unmerged',
      changed_columns: '',
      label: 'TEST UNDONE TANKER',
      survivor_id: SECOND,
    },
    {
      kind: 'claim',
      id: `${SECOND}/call_sign`,
      change: 'added',
      changed_columns: '',
      label: 'TEST SECOND TANKER: call_sign',
      survivor_id: '',
    },
    {
      kind: 'claim',
      id: `${ABSORBED}/call_sign`,
      change: 'merged',
      changed_columns: '',
      label: 'TEST OLD STAR: call_sign',
      survivor_id: SECOND,
    },
  ]);

  // The file manifest lists the changelog with its checksum, and gives a short summary.
  const manifest = z
    .object({
      changelog: z.object({
        path: z.string(),
        previous: z.object({ version: z.string(), date: z.string() }),
        entities: z.record(z.string(), z.number()),
      }),
      files: z.array(z.object({ path: z.string(), sha256: z.string() })),
    })
    .parse(JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')));
  expect(manifest.changelog).toMatchObject({
    path: 'changelog.csv',
    previous: { version: '0.1-test', date: '2026-11-08' },
    entities: { changed: 1, merged: 1, unmerged: 1 },
  });
  expect(manifest.files.find((file) => file.path === 'changelog.csv')?.sha256).toBe(
    createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'),
  );
});

test('the command refuses a previous release folder that changed after the release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const previous = join(root, 'previous');
  await mkdir(previous);
  await writeFile(join(previous, 'entities.csv'), 'id\r\n');
  await writeFile(
    join(previous, 'manifest.json'),
    JSON.stringify({
      version: '0.1',
      date: '2026-11-01',
      files: [{ path: 'entities.csv', bytes: 4, sha256: '0'.repeat(64) }],
    }),
  );
  const manifest = join(root, 'release.json');
  await writeFile(manifest, JSON.stringify({ date: '2026-11-08', contacts: MANIFEST.contacts }));
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  try {
    expect(
      await releaseCommand([
        '--manifest',
        manifest,
        '--out',
        join(root, 'out'),
        '--previous',
        previous,
      ]),
    ).toBe(2);
  } finally {
    spy.mockRestore();
  }
  expect(lines.join('\n')).toContain('entities.csv does not agree with its size and its checksum');
  expect(lines.join('\n')).not.toContain(' at ');
  expect((await readdir(root)).sort()).toStrictEqual(['previous', 'release.json']);
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

// The example sheet of the candidate nodes names the vessel, its owner and the second vessel.
const SHEET = fileURLToPath(new URL('../../fixtures/critical-nodes.csv', import.meta.url));

test('a release writes the critical nodes table from the sheet of the candidate nodes', async () => {
  const off = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const on = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const ids = await inTransaction(async (held) => {
    const made = await record(held);
    await pairTheImo(held.ask, made.imoAct);
    await writeRelease(held.as('gabriel_app'), { ...MANIFEST, criticalNodes: SHEET }, off);
    await writeRelease(
      held.as('gabriel_app'),
      { ...MANIFEST, criticalNodes: SHEET, showNatoPair: true },
      on,
    );
    return made;
  });
  const fileOf = (root: string) => join(root, 'gab-release-2026-11-08', 'critical-nodes.csv');
  const text = await readFile(fileOf(off), 'utf8');
  expect(text).toContain('# GAB dataset, version 0.1-test of 08/11/2026.');
  expect(text).toContain('Right of reply: mailto:reply@example.org');
  expect(text).toContain('# Candidate nodes: 3. Retained: 1.');
  // S1: with the pair off, no column and no word of the pair.
  expect(text).not.toMatch(/nato|NATO|\b[A-F][1-6]\b/u);

  // Condition (a) of the vessel is its designation in the record. The owner has a tick with no
  // public claim. The second vessel has no tick.
  const table = tableOf(text);
  expect(table.map((row) => [row['node_id'], row['ticks'], row['retained']])).toStrictEqual([
    [VESSEL, '3', 'true'],
    [OWNER, '1', 'false'],
    [SECOND, '0', 'false'],
  ]);
  expect(table[0]).toMatchObject({
    node_label: 'TEST TANKER',
    node_type: 'vessel',
    controller: 'TEST OWNER LTD',
    bypass_pattern: 'Ship-to-ship transfer off an invented port, then a new flag',
    a_sanctions_exposure: 'sourced',
    a_claim_ids: ids.vesselListed.id,
    b_production_or_throughput: 'sourced',
    b_claim_ids: `${VESSEL}/speed_knots`,
    c_bypass_routing: 'sourced',
    c_claim_ids: `${VESSEL}/flag ${VESSEL}/imo`,
    sourced_ticks: '3',
  });
  expect(table[1]).toMatchObject({
    controller: 'TEST HOLDING',
    a_sanctions_exposure: 'no tick',
    b_production_or_throughput: 'not sourced',
    b_claim_ids: '',
    sourced_ticks: '0',
  });
  // Each claim of the table is a claim of the release.
  const claims = new Set(
    tableOf(await readFile(join(off, 'gab-release-2026-11-08', 'claims.csv'), 'utf8')).map(
      (row) => row['claim_id'],
    ),
  );
  for (const row of table)
    for (const claim of ['a', 'b', 'c'].flatMap((one) =>
      (row[`${one}_claim_ids`] ?? '').split(' ').filter((id) => id !== ''),
    ))
      expect(claims).toContain(claim);

  // The file manifest gives the checksum of the table.
  const manifest = z
    .object({ files: z.array(z.object({ path: z.string(), sha256: z.string() })) })
    .parse(
      JSON.parse(await readFile(join(off, 'gab-release-2026-11-08', 'manifest.json'), 'utf8')),
    );
  expect(manifest.files.find((file) => file.path === 'critical-nodes.csv')?.sha256).toBe(
    createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'),
  );

  // With the pair on, each tick gives the pair of each of its claims.
  const paired = tableOf(await readFile(fileOf(on), 'utf8'))[0];
  expect(paired).toMatchObject({ c_nato_pairs: 'none A3', b_nato_pairs: 'none' });
});

test('a release refuses a sheet that cites a claim that is not public, and writes nothing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const sheet = join(root, 'nodes.csv');
  // The note of the insurer rests on a bought filing only, so it is not a public claim.
  await writeFile(
    sheet,
    `node_id,condition,claim_ids,controller,bypass_pattern\n${VESSEL},b,${VESSEL}/speed_knots,,\n${VESSEL},c,${VESSEL}/insurer_note,,\n`,
  );
  const out = join(root, 'out');
  await inTransaction(async (held) => {
    await record(held);
    const refused = writeRelease(
      held.as('gabriel_app'),
      { ...MANIFEST, criticalNodes: sheet },
      out,
    );
    await expect(refused).rejects.toThrow(CriticalNodesSheetFault);
    await expect(
      writeRelease(held.as('gabriel_app'), { ...MANIFEST, criticalNodes: sheet }, out),
    ).rejects.toThrow(`Line 3: the claim ${VESSEL}/insurer_note is not a public claim`);
  });
  expect(await readdir(root)).toStrictEqual(['nodes.csv']);
});

// A person that no authority designates is not in the release, so the sheet cannot name it as a
// node, nor cite the relation that names it.
test.each([
  [
    'the person as the node',
    () => `${OTHER_PERSON},,,,`,
    `the node ${OTHER_PERSON} is not a public entity`,
  ],
  ['a claim of the person', (works: string) => `${OWNER},b,${works},,`, 'is not a public claim'],
])('a release refuses a sheet that names a hidden person: %s', async (_, line, message) => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  const sheet = join(root, 'nodes.csv');
  await inTransaction(async (held) => {
    const { otherWorks } = await record(held);
    await writeFile(
      sheet,
      `node_id,condition,claim_ids,controller,bypass_pattern\n${line(otherWorks.id)}\n`,
    );
    await expect(
      writeRelease(
        held.as('gabriel_app'),
        { ...MANIFEST, criticalNodes: sheet },
        join(root, 'out'),
      ),
    ).rejects.toThrow(new RegExp(`Line 2: .*${message}`, 'u'));
  });
  expect(await readdir(root)).toStrictEqual(['nodes.csv']);
});

test.each([
  [
    'a node that is not in the release',
    `node_id,condition,claim_ids,controller,bypass_pattern\n${HIDDEN_OWNER},b,,,\n`,
    `Line 2: the node ${HIDDEN_OWNER} is not a public entity`,
  ],
  ['a sheet with a wrong column', 'node,condition\n', 'Line 1: the column "node" is not known'],
  ['no sheet', null, 'Cannot read the sheet of the candidate nodes'],
])('the command refuses %s with a short message', async (_, sheet, message) => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  if (sheet !== null) await writeFile(join(root, 'nodes.csv'), sheet);
  const manifest = join(root, 'release.json');
  // The path of the sheet is relative to the folder of the manifest.
  await writeFile(
    manifest,
    JSON.stringify({ date: '2026-11-08', contacts: MANIFEST.contacts, criticalNodes: 'nodes.csv' }),
  );
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  try {
    expect(await releaseCommand(['--manifest', manifest, '--out', join(root, 'out')])).toBe(2);
  } finally {
    spy.mockRestore();
  }
  expect(lines.join('\n')).toContain(message);
  expect(lines.join('\n')).not.toContain(' at ');
  expect((await readdir(root)).sort()).toStrictEqual(
    sheet === null ? ['release.json'] : ['nodes.csv', 'release.json'],
  );
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
      // A designation that cites the files of two regimes counts in no regime.
      twoRegimes: await dated(
        ask,
        await relationOf(MATRIX_EU_ONLY, MATRIX_SDN, [SDN_FILE, UK_FILE]),
        '2024-02-23',
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
      imo_check_digit_ok: 'true',
      vessel_ids: `${MATRIX_SHIP} ${MATRIX_RENAMED}`,
      vessel_labels: '["TEST MATRIX TANKER","TEST MATRIX NEW NAME"]',
      imo_claim_ids: `${MATRIX_SHIP}/imo ${MATRIX_RENAMED}/imo`,
      eu_listed_on: '2024-06-24',
      eu_date_from: 'designation_start',
      eu_date_claim_id: ids.eu,
      eu_ended_on: '',
      eu_act_id: MATRIX_EU_ACT,
      eu_act_label: 'TEST COUNCIL REGULATION',
      eu_document_ids: EU_ACT_DOC,
      eu_claim_id: ids.eu,
      ofac_listed_on: '2024-02-23',
      ofac_date_from: 'designation_start',
      ofac_date_claim_id: ids.ofac,
      ofac_ended_on: '',
      ofac_act_id: MATRIX_SDN,
      ofac_act_label: 'TEST SDN LIST',
      ofac_document_ids: SDN_FILE,
      ofac_claim_id: ids.ofac,
      uk_listed_on: '2024-05-09',
      uk_date_from: 'designation_start',
      uk_date_claim_id: ids.uk,
      uk_ended_on: '',
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
      imo_check_digit_ok: 'false',
      eu_listed_on: '2025-05-20',
      eu_date_from: 'act_entry_into_force',
      eu_date_claim_id: `${MATRIX_EU_AMENDMENT}/entry_into_force`,
      eu_claim_id: ids.euOnly,
      ofac_claim_id: '',
      uk_claim_id: '',
      days_eu_after_ofac: '',
      ofac_or_uk_not_eu: 'false',
      eu_not_ofac: 'true',
    }),
  ]);
  expect(matrixText).not.toContain('9833000');
  expect(matrixText).not.toContain(ids.noImo);
  expect(matrixText).not.toContain(ids.bought);
  expect(matrixText).not.toContain(ids.twoRegimes);
  expect(matrixText).toMatch(
    /# Designations that cite the official files of more than one regime, and count in no regime: [1-9]/u,
  );
  expect(matrixText).toContain('The release does not check the date against the rule.');

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

test('a step after the files that fails leaves no release folder, so the release can run again', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gab-release-test-'));
  await inTransaction(async (held) => {
    await expect(
      writeRelease(held.as('gabriel_app'), MANIFEST, root, null, async (folder) => {
        expect(await readdir(folder)).toContain('manifest.json');
        throw new Error('the site cannot be written');
      }),
    ).rejects.toThrow('the site cannot be written');
  });
  expect(await readdir(root)).toStrictEqual([]);
});
