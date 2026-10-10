import { expect, test } from 'vitest';
import { z } from 'zod';

import { jsonldExport } from './jsonld-export.ts';
import type { ReleaseRecord } from './release-record.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const OWNS = '00000000-0000-4000-8000-000000000003';
const ACT = '00000000-0000-4000-8000-000000000004';
const LABEL = 'Validated manually by the operator, on 2026-10-08';
const RULE = 'Accepted by rule strong_sources v1 — no person read it, on 2026-10-09';
const BASE = 'https://data.example.org/gab/';
const ABSORBED = '00000000-0000-4000-8000-000000000005';
const UNDONE = '00000000-0000-4000-8000-000000000006';

const RECORD: ReleaseRecord = {
  entities: [
    {
      id: SHIP,
      type: 'vessel',
      label: 'A ship',
      origin_label: LABEL,
      sources: ['doc_a'],
      geom: { type: 'Point', coordinates: [32.5, 46.6] },
    },
    {
      id: OWNER,
      type: 'company',
      label: 'An owner',
      origin_label: LABEL,
      sources: ['doc b'],
      geom: null,
    },
  ],
  relations: [
    {
      id: OWNS,
      type: 'owns',
      src_id: OWNER,
      dst_id: SHIP,
      valid_from: '2024-01-02',
      valid_to: null,
      origin_label: LABEL,
      sources: ['doc b'],
    },
  ],
  claims: [
    {
      claim_id: `${SHIP}/flag`,
      subject_kind: 'entity',
      subject_id: SHIP,
      attribute: 'flag',
      value: 'Panama',
      origin_label: RULE,
      sources: ['doc_a', 'doc b'],
      act_id: ACT,
      passages: [
        {
          document: 'doc_a',
          page: 2,
          excerpt: 'flag of Panama',
          modality: 'asserts',
          transcribed: false,
        },
      ],
    },
    {
      claim_id: `${SHIP}/speed_knots`,
      subject_kind: 'entity',
      subject_id: SHIP,
      attribute: 'speed_knots',
      value: 12,
      origin_label: LABEL,
      sources: ['doc_a'],
      act_id: ACT,
      passages: [],
    },
    {
      claim_id: OWNS,
      subject_kind: 'relation',
      subject_id: OWNS,
      attribute: null,
      value: null,
      origin_label: LABEL,
      sources: ['doc b'],
      act_id: ACT,
      passages: [],
    },
  ],
  merges: [
    {
      act_id: ACT,
      action: 'merge',
      day: '2026-10-10',
      absorbed_id: ABSORBED,
      survivor_id: SHIP,
      resolves_to: SHIP,
      origin_label: LABEL,
    },
    {
      act_id: ACT,
      action: 'merge',
      day: '2026-10-10',
      absorbed_id: UNDONE,
      survivor_id: SHIP,
      resolves_to: null,
      origin_label: LABEL,
    },
  ],
  documents: new Map([
    [
      'doc_a',
      {
        id: 'doc_a',
        title: 'A list',
        uri: 'https://example.org/a',
        retrieved_at: '2026-10-01',
        licence: 'public-domain',
        provider: 'ofac_sdn',
      },
    ],
    [
      'doc b',
      {
        id: 'doc b',
        title: 'A page',
        uri: null,
        retrieved_at: null,
        licence: 'cc-by-nc-4.0',
        provider: 'gfw',
      },
    ],
  ]),
  disclaimer: '',
  natoPairs: null,
};

const HEADING = {
  version: '1.0',
  date: '2026-11-08',
  title: 'GAB dataset, version 1.0 of 08/11/2026.',
  disclaimer: 'About this data.',
};

const document = z.object({
  '@context': z.record(z.string(), z.unknown()),
  '@graph': z.array(z.record(z.string(), z.unknown())),
});

const read = () => {
  const file = jsonldExport(RECORD, HEADING, BASE);
  expect(file.path).toBe('dataset.jsonld');
  return document.parse(JSON.parse(file.text));
};

// The IRI that a term of the context names.
const iriOf = (term: unknown): string | undefined =>
  z
    .union([z.string(), z.object({ '@id': z.string() }).transform((one) => one['@id'])])
    .safeParse(term).data;

const node = (id: string): Record<string, unknown> | undefined =>
  read()['@graph'].find((one) => one['@id'] === id);

// Each key of a node, also in a nested node. A value of the JSON type is data and has no terms.
const keysOf = (value: unknown, context: Record<string, unknown>): string[] => {
  if (Array.isArray(value)) return value.flatMap((one) => keysOf(one, context));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, inner]) => {
    const term = context[key];
    const json =
      typeof term === 'object' && term !== null && '@type' in term && term['@type'] === '@json';
    return [key, ...(json ? [] : keysOf(inner, context))];
  });
};

test('the context defines each term that the graph uses', () => {
  const { '@context': context, '@graph': graph } = read();
  const used = new Set(keysOf(graph, context));
  for (const key of used) if (!key.startsWith('@')) expect(context).toHaveProperty([key]);
});

test('the graph documents each term of the release vocabulary with a label and a comment', () => {
  const { '@context': context, '@graph': graph } = read();
  const ours = Object.entries(context)
    .map(([, term]) => iriOf(term))
    .filter((iri) => iri?.startsWith('gab:') === true);
  expect(ours.length).toBeGreaterThan(10);
  const defined = z.object({ '@id': z.string(), label: z.string(), comment: z.string() });
  const definitions = new Set(
    graph.flatMap((one) => {
      const parsed = defined.safeParse(one);
      return parsed.success ? [parsed.data['@id']] : [];
    }),
  );
  for (const iri of ours) expect(definitions).toContain(iri);
});

test('the dataset node gives the version, the date, the licence and the disclaimer', () => {
  expect(node(`release/1.0`)).toMatchObject({
    '@type': 'Dataset',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    name: 'GAB dataset, version 1.0 of 08/11/2026.',
    version: '1.0',
    datePublished: '2026-11-08',
    disclaimer: 'About this data.',
  });
});

test('an entity and a relation keep their label, licence and sources', () => {
  expect(node(`entity/${SHIP}`)).toStrictEqual({
    '@id': `entity/${SHIP}`,
    '@type': 'Entity',
    entityType: 'vessel',
    name: 'A ship',
    originLabel: LABEL,
    licenceText: 'CC-BY 4.0',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    sources: ['document/doc_a'],
  });
  expect(node(`relation/${OWNS}`)).toStrictEqual({
    '@id': `relation/${OWNS}`,
    '@type': 'Relation',
    relationType: 'owns',
    from: `entity/${OWNER}`,
    to: `entity/${SHIP}`,
    validFrom: '2024-01-02',
    originLabel: LABEL,
    licenceText: 'CC-BY-NC 4.0',
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    sources: ['document/doc%20b'],
  });
});

test('each claim keeps its sources, its passages, its label and its licence', () => {
  expect(node(`claim/${SHIP}/flag`)).toStrictEqual({
    '@id': `claim/${SHIP}/flag`,
    '@type': 'Claim',
    claimId: `${SHIP}/flag`,
    claimKind: 'attribute',
    about: `entity/${SHIP}`,
    attribute: 'flag',
    value: 'Panama',
    originLabel: RULE,
    licenceText: 'CC-BY 4.0',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    sources: ['document/doc_a', 'document/doc%20b'],
    passages: [
      {
        '@type': 'Passage',
        document: 'document/doc_a',
        page: 2,
        excerpt: 'flag of Panama',
        modality: 'asserts',
        transcribed: false,
      },
    ],
  });
  expect(node(`claim/${SHIP}/speed_knots`)).toMatchObject({ value: 12, passages: [] });
  expect(node(`claim/${OWNS}`)).toMatchObject({ claimKind: 'relation', about: `relation/${OWNS}` });
  expect(node(`claim/${OWNS}`)).not.toHaveProperty('value');
});

test('a document gives its title, its address and its day of reading', () => {
  expect(node('document/doc_a')).toStrictEqual({
    '@id': 'document/doc_a',
    '@type': 'Document',
    title: 'A list',
    address: 'https://example.org/a',
    readOn: '2026-10-01',
  });
  expect(read()['@context']).toMatchObject({
    address: { '@id': 'schema:url', '@type': 'xsd:anyURI' },
    readOn: { '@id': 'gab:readOn', '@type': 'xsd:date' },
  });
  expect(node('document/doc%20b')).toStrictEqual({
    '@id': 'document/doc%20b',
    '@type': 'Document',
    title: 'A page',
  });
});

test('the identifiers and the vocabulary are under the base that the manifest gives', () => {
  expect(read()['@context']).toMatchObject({ '@base': BASE, gab: `${BASE}vocabulary#` });
});

test('an absorbed entity is replaced by the entity that it resolves to, while the merge stands', () => {
  expect(node(`entity/${ABSORBED}`)).toStrictEqual({
    '@id': `entity/${ABSORBED}`,
    isReplacedBy: `entity/${SHIP}`,
  });
  expect(node(`entity/${UNDONE}`)).toBeUndefined();
});

test('with the NATO pair off, the file holds no letter, no digit and no term of the pair', () => {
  const text = jsonldExport(RECORD, HEADING, BASE).text;
  expect(text).not.toMatch(/nato/iu);
});

test('with the NATO pair on, a claim gives its letter and its digit, and the terms are documented', () => {
  const file = jsonldExport(
    { ...RECORD, natoPairs: new Map([[`${SHIP}/flag`, { letter: 'B', digit: 1 }]]) },
    HEADING,
    BASE,
  );
  const { '@context': context, '@graph': graph } = document.parse(JSON.parse(file.text));
  const claimOf = (id: string) => graph.find((one) => one['@id'] === id);
  expect(claimOf(`claim/${SHIP}/flag`)).toMatchObject({ natoLetter: 'B', natoDigit: 1 });
  expect(claimOf(`claim/${SHIP}/speed_knots`)).not.toHaveProperty('natoLetter');
  expect(claimOf(`claim/${SHIP}/speed_knots`)).not.toHaveProperty('natoDigit');
  for (const key of ['natoLetter', 'natoDigit']) {
    const iri = iriOf(context[key]);
    expect(iri).toBe(`gab:${key}`);
    const defined = graph.find((one) => one['@id'] === iri);
    expect(defined).toHaveProperty('@type', 'Property');
    expect(typeof defined?.['label']).toBe('string');
    expect(typeof defined?.['comment']).toBe('string');
  }
});
