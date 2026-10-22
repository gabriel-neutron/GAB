import { expect, test } from 'vitest';

import { assetCoverageLines } from './asset-coverage.ts';
import { assetLinks } from './asset-links.ts';
import { claimProviders, CreditFault, releaseCredits } from './credits.ts';
import { osmLink } from './osm-link.ts';
import { assertNoOsmGeometry } from './osm-geometry.ts';
import { releaseFiles } from './release-files.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import type {
  ReleaseClaim,
  ReleaseDocument,
  ReleaseEntity,
  ReleaseRecord,
} from './release-record.ts';

const FIELD_A = '00000000-0000-4000-8000-0000000000a1';
const FIELD_B = '00000000-0000-4000-8000-0000000000a2';
const PIPE = '00000000-0000-4000-8000-0000000000a3';
const COMPANY = '00000000-0000-4000-8000-0000000000c1';
const OPERATES = '00000000-0000-4000-8000-0000000000d1';
const OWNS = '00000000-0000-4000-8000-0000000000d2';
const DESIGNATED = '00000000-0000-4000-8000-0000000000d3';
const ENDED = '00000000-0000-4000-8000-0000000000d4';
const ACT = '00000000-0000-4000-8000-000000000004';
const LABEL = 'Accepted by reference dataset GEM, approved by the operator';

const claim = (subject: string, attribute: string, value: unknown): ReleaseClaim => ({
  claim_id: `${subject}/${attribute}`,
  subject_kind: 'entity',
  subject_id: subject,
  attribute,
  value,
  origin_label: LABEL,
  sources: ['gem'],
  act_id: ACT,
  passages: [],
});

const POINT = { type: 'Point', coordinates: [60.5, 62.25] };

const entity = (
  id: string,
  type: string,
  geom: ReleaseEntity['geom'] = POINT,
  sources: string[] = ['gem'],
): ReleaseEntity => ({
  id,
  type,
  label: `Entity ${id.slice(-2)}`,
  origin_label: LABEL,
  sources,
  geom,
});

const relation = (
  id: string,
  type: string,
  src: string,
  dst: string,
  end: string | null = null,
) => ({
  id,
  type,
  src_id: src,
  dst_id: dst,
  valid_from: null,
  valid_to: end,
  origin_label: LABEL,
  sources: ['gem'],
});

const GEM: ReleaseDocument = {
  id: 'gem',
  title: 'GEM oil and gas extraction tracker',
  uri: 'https://globalenergymonitor.org/example',
  retrieved_at: '2026-10-13',
  licence: 'cc-by-4.0',
  provider: 'gem',
};

const RECORD: ReleaseRecord = {
  entities: [
    entity(FIELD_A, 'facility'),
    entity(FIELD_B, 'facility', null),
    entity(PIPE, 'facility'),
    entity(COMPANY, 'company', null),
  ],
  relations: [
    relation(OPERATES, 'operates', COMPANY, FIELD_A),
    relation(OWNS, 'owns', COMPANY, FIELD_A),
    relation(DESIGNATED, 'designated_by', FIELD_A, COMPANY),
    relation(ENDED, 'operates', COMPANY, FIELD_B, '2020-01-01'),
  ],
  claims: [
    claim(FIELD_A, 'asset_kind', 'field'),
    claim(FIELD_B, 'asset_kind', 'field'),
    claim(PIPE, 'asset_kind', 'pipeline_segment'),
    claim(FIELD_A, 'capacity_mtoe_y', 30),
    claim(FIELD_B, 'capacity_mtoe_y', '10'),
    claim(FIELD_A, 'osm_id', 'way/42'),
    claim(FIELD_A, 'osm_version', 7),
  ],
  merges: [],
  documents: new Map([['gem', GEM]]),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: 'Report an error: `<link>`\nRight of reply: `<link>`',
  natoPairs: null,
};

test('the coverage count gives each kind, with the share of the capacity and the source of the total', () => {
  const lines = assetCoverageLines(RECORD, {
    field: { attribute: 'capacity_mtoe_y', total: 100, unit: 'Mtoe/y', source: 'GEM, 2026-10-13' },
  });
  expect(lines).toStrictEqual([
    'kind\tassets\twith geometry\twith operator\twith owner\twith sanctions relation\ttotal capacity\tsource of the total',
    'field\t2 (40.0% of capacity)\t1 (30.0% of capacity)\t1 (30.0% of capacity)\t1 (30.0% of capacity)\t1 (30.0% of capacity)\t100 Mtoe/y\tGEM, 2026-10-13',
    'pipeline_segment\t1\t1\t0\t0\t0\tunknown\tnone given',
  ]);
});

test('a relation that has ended does not count as an operator', () => {
  const [, field] = assetCoverageLines(RECORD, {});
  expect(field).toBe('field\t2\t1\t1\t1\t1\tunknown\tnone given');
});

test('the OpenStreetMap link follows the form of the identifier', () => {
  expect(osmLink('way/42')).toBe('https://www.openstreetmap.org/way/42');
  expect(osmLink('n7')).toBe('https://www.openstreetmap.org/node/7');
  expect(osmLink('R9')).toBe('https://www.openstreetmap.org/relation/9');
  expect(osmLink('42')).toBeNull();
  expect(osmLink(42)).toBeNull();
});

test('the link file gives the link, the version and the own point of each asset with an identifier', () => {
  const file = assetLinks(RECORD, '');
  expect(file.path).toBe('asset-links.csv');
  expect(file.text).toContain('id,label,asset_kind,osm_id,osm_version,osm_link,point');
  expect(file.text).toContain(
    `${FIELD_A},Entity a1,field,way/42,7,https://www.openstreetmap.org/way/42,60.5 62.25,CC-BY 4.0,gem`,
  );
  expect(file.text).not.toContain(FIELD_B);
});

test('the credits name GEM, the World Bank and NASA FIRMS with the words of their licences', () => {
  const { text } = releaseCredits(
    {
      version: '1',
      date: '2026-10-13',
      title: 'GAB',
      disclaimer: '',
    },
    new Set(),
  );
  expect(text).toContain('Creative Commons Attribution 4.0 International');
  expect(text).toContain('https://creativecommons.org/licenses/by/4.0/');
  expect(text).toContain('World Bank');
  expect(text).toContain('Fire Information for Resource');
});

const HEADING = { version: '1', date: '2026-10-13', title: 'GAB', disclaimer: '' };

test.each([
  ['ofac_sdn', 'Specially Designated Nationals'],
  ['uk_sanctions_list', 'Open Government Licence v3.0'],
  ['eu_eurlex', 'Commission Decision 2011/833/EU'],
  ['eu_fsf', 'Financial Sanctions Files'],
  ['gleif', 'Global Legal Entity'],
])('the credits name the provider %s that a claim cites', (provider, words) => {
  expect(releaseCredits(HEADING, new Set()).text).not.toContain(words);
  expect(releaseCredits(HEADING, new Set([provider])).text).toContain(words);
});

test('a provider with no credit line stops the release', () => {
  expect(() => releaseCredits(HEADING, new Set(['gfw']))).toThrow(CreditFault);
  expect(() => releaseCredits(HEADING, new Set(['osm', 'own']))).not.toThrow();
});

test('the providers of the documents that the claims cite give the credits', () => {
  const claim = {
    sources: ['osm_doc'],
    passages: [{ document: 'gem_doc' }],
  } as unknown as ReleaseRecord['claims'][number];
  const record = {
    claims: [claim],
    documents: new Map([
      ['osm_doc', { provider: 'ofac_sdn' }],
      ['gem_doc', { provider: null }],
      ['other', { provider: 'gleif' }],
    ]),
  } as unknown as ReleaseRecord;
  expect([...claimProviders(record)]).toStrictEqual(['ofac_sdn']);
});

test('a geometry that cites an OpenStreetMap document stops the release', () => {
  const osm: ReleaseDocument = {
    ...GEM,
    id: 'osm_doc',
    uri: 'https://overpass-api.de/api/interpreter',
    licence: 'odbl',
    provider: 'osm',
  };
  const bad: ReleaseRecord = {
    ...RECORD,
    entities: [entity(FIELD_A, 'facility', POINT, ['osm_doc'])],
    documents: new Map([['osm_doc', osm]]),
  };
  expect(() => assertNoOsmGeometry(bad)).toThrow(/holds no OpenStreetMap geometry/);
  expect(() => assertNoOsmGeometry(RECORD)).not.toThrow();
});

const NOMINATIM: ReleaseDocument = {
  ...GEM,
  id: 'nominatim_doc',
  uri: 'https://nominatim.openstreetmap.org/lookup?osm_ids=N1',
  licence: null,
  provider: null,
};

test('an OpenStreetMap document that holds up only the identifier lets the release go on', () => {
  const record: ReleaseRecord = {
    ...RECORD,
    entities: [
      { ...entity(FIELD_A, 'facility', POINT, ['gem', 'nominatim_doc']), geom_sources: ['gem'] },
    ],
    documents: new Map([
      ['gem', GEM],
      ['nominatim_doc', NOMINATIM],
    ]),
  };
  expect(() => assertNoOsmGeometry(record)).not.toThrow();
});

test('the error names each entity whose geometry cites an OpenStreetMap document', () => {
  const record: ReleaseRecord = {
    ...RECORD,
    entities: [
      { ...entity(FIELD_A, 'facility', POINT, ['nominatim_doc']), geom_sources: ['nominatim_doc'] },
      { ...entity(FIELD_B, 'facility', POINT, ['gem']), geom_sources: ['gem'] },
      { ...entity(PIPE, 'facility', POINT, ['nominatim_doc']), geom_sources: ['nominatim_doc'] },
    ],
    documents: new Map([
      ['gem', GEM],
      ['nominatim_doc', NOMINATIM],
    ]),
  };
  let message = '';
  try {
    assertNoOsmGeometry(record);
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain(`${FIELD_A} (Entity a1): nominatim_doc`);
  expect(message).toContain(`${PIPE} (Entity a3): nominatim_doc`);
  expect(message).not.toContain(FIELD_B);
});

const featureIds = (text: string): ReadonlySet<string> => {
  const parsed = JSON.parse(text) as { features: { id: string }[] };
  return new Set(parsed.features.map((one) => one.id));
};

const MANIFEST: ReleaseManifest = {
  version: '0.1-test',
  date: '2026-10-13',
  showNatoPair: false,
  dateRules: { eu: 'entry_into_force', ofac: 'recent_actions_notice', uk: 'date_designated' },
  contacts: { reportError: 'mailto:error@example.org', rightOfReply: 'mailto:reply@example.org' },
  criticalNodes: null,
  volumes: null,
  iriBase: 'https://example.org/id/',
};

test('no release file holds an OpenStreetMap geometry, and each asset of the release has a sourced point', () => {
  const { files } = releaseFiles(RECORD, MANIFEST, null, null, null);
  expect(files.map((one) => one.path)).toContain('asset-links.csv');
  expect(files.map((one) => one.path)).toContain('credits.md');
  const geojson = files.find((one) => one.path === 'entities.geojson');
  const features = featureIds(geojson?.text ?? '');
  for (const asset of RECORD.claims.filter((one) => one.attribute === 'asset_kind')) {
    const held = RECORD.entities.find((one) => one.id === asset.subject_id);
    if (held?.geom === null) continue;
    expect(features.has(asset.subject_id)).toBe(true);
    expect(held?.sources.length).toBeGreaterThan(0);
  }
  for (const file of files) expect(file.text).not.toMatch(/overpass|"osm_geometry"/u);
  const osm: ReleaseDocument = {
    ...GEM,
    id: 'osm_doc',
    uri: 'https://overpass-api.de/api/interpreter',
    licence: 'odbl',
    provider: 'osm',
  };
  const bad: ReleaseRecord = {
    ...RECORD,
    entities: [entity(FIELD_A, 'facility', POINT, ['osm_doc'])],
    documents: new Map([['osm_doc', osm]]),
  };
  expect(() => releaseFiles(bad, MANIFEST, null, null, null)).toThrow(
    /holds no OpenStreetMap geometry/,
  );
});
