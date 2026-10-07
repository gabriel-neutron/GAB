// A page of the queue as the writer answers it, for the tests and the stories. Its shapes come
// from the import of the v1 work and from one page of a report that the extractor read.

const V1 = {
  id: 'doc_6028f1aa64ea',
  title: 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage',
  uri: null,
  mime: 'text/plain',
};

const REPORT = {
  id: 'doc_2852b6ae9b28',
  title: 'Financial sanctions and the trade of Russia',
  uri: 'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr1047.pdf',
  mime: 'application/pdf',
};

const DISTRICT = '0203dbf1-e42f-40ad-823b-aaf4fe79138e';
const ARMY = '05944d40-8f23-4dc2-92b1-4f5dd9ef9872';
const BRIGADE = 'df517a7b-6184-44f9-8484-bd5b1674cdc7';
const GROUP = '017d271c-1c57-41c5-83c4-af7f5f696c7e';
const OTHER_GROUP = '9a0c3c1e-5b7d-4e2f-8a61-2d4f6b8c0e13';
const RECORD_UNIT = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

export const SAMPLE_UNITS = {
  army: ARMY,
  brigade: BRIGADE,
  link: '62b37efd-316f-4ea8-8e8d-b253355757d6',
  disputed: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
} as const;

const v1Line = (name: string, more: string): string =>
  `v1 unit ${name.length.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000 | ${name} | ` +
  `affiliation: Hostile | ${more}`;

const LINES = [
  v1Line('19th Separate EW Brigade', 'echelon: Brigade | parent: Southern Military District'),
  v1Line('439th Guards Rocket Artillery Brigade', 'echelon: Brigade | parent: 5th Army'),
  v1Line(
    '5th Combined Arms Army',
    'echelon: Army | military_unit_number: 29506 | position: 43.790382 N, 131.955795 E | ' +
      'sources: https://voinskaya-chast-poisk.ru/5-armiya-vostochnogo-voennogo-okruga-mesto-dislokaczii.html ' +
      'https://ru.wikipedia.org/wiki/5-%D1%8F_%D0%B3%D0%B2%D0%B0%D1%80%D0%B4%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F',
  ),
  v1Line('117th GRAU arsenal', 'military_unit_number: 57229-51 | parent: 1061st Logistics Center'),
  v1Line('68th GRAU arsenal', 'position_precision: approximate'),
];

const passage = (act: string, line: number) => ({
  act,
  document: V1.id,
  page: 1,
  before: `${LINES.slice(Math.max(0, line - 2), line).join('\n')}\n`,
  text: LINES[line] ?? '',
  after: `\n${LINES.slice(line + 1, line + 3).join('\n')}`,
});

const entity = (id: string, label: string, attrs: Record<string, unknown>) => ({
  id,
  op: 'create_entity',
  payload: {
    type: 'military_unit',
    label,
    sources: [V1.id],
    geom: { type: 'Point', coordinates: [131.955795, 43.790382] },
    attrs: Object.fromEntries(Object.entries(attrs).map(([key, v]) => [key, { v, src: [V1.id] }])),
  },
  targetId: null,
  dissent: false,
  dissentReason: null,
  target: null,
  src: null,
  dst: null,
});

const relation = (
  id: string,
  src: string,
  dst: string,
  ends: { readonly src: object; readonly dst: object },
) => ({
  id,
  op: 'create_relation',
  payload: {
    type: 'subordinate_to',
    src_id: src,
    dst_id: dst,
    src_kind: 'entity',
    dst_kind: 'entity',
    attrs: {},
    sources: [V1.id],
  },
  targetId: null,
  dissent: false,
  dissentReason: null,
  target: null,
  ...ends,
});

/** The answer of the writer for the first page of the queue. */
export const UNIT_ANSWER = {
  total: 1082,
  next: ['0', '5th combined arms army', GROUP, 'trade of russia', SAMPLE_UNITS.disputed],
  units: [
    {
      unit: ARMY,
      kind: 'entity',
      name: '5th Combined Arms Army',
      type: 'military_unit',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      acts: [
        entity(ARMY, '5th Combined Arms Army', {
          echelon: 'Army',
          affiliation: 'Hostile',
          military_unit_number: '29506',
          source_urls: [
            'https://voinskaya-chast-poisk.ru/5-armiya-vostochnogo-voennogo-okruga-mesto-dislokaczii.html',
            'https://ru.wikipedia.org/wiki/5-%D1%8F_%D0%B3%D0%B2%D0%B0%D1%80%D0%B4%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F',
          ],
        }),
        relation('3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c', ARMY, RECORD_UNIT, {
          src: { name: '5th Combined Arms Army', state: 'pending', group: GROUP },
          dst: { name: 'Eastern Military District', state: 'record', group: null },
        }),
      ],
      documents: [V1],
      passages: [passage(ARMY, 2)],
    },
    {
      unit: BRIGADE,
      kind: 'entity',
      name: '57th Separate Motor Rifle Brigade',
      type: 'military_unit',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      acts: [
        entity(BRIGADE, '57th Separate Motor Rifle Brigade', {
          echelon: 'Brigade',
          position_precision: 'approximate',
        }),
        relation('4a7b2d3f-1c0e-4f8a-b2d4-6e8f0a2b4c6d', BRIGADE, ARMY, {
          src: { name: '57th Separate Motor Rifle Brigade', state: 'pending', group: GROUP },
          dst: { name: '5th Combined Arms Army', state: 'pending', group: GROUP },
        }),
      ],
      documents: [V1],
      passages: [passage(BRIGADE, 1)],
    },
    {
      unit: SAMPLE_UNITS.link,
      kind: 'link',
      name: '1061st Logistics Center → Southern Military District',
      type: 'subordinate_to',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      acts: [
        relation(SAMPLE_UNITS.link, BRIGADE, DISTRICT, {
          src: { name: '1061st Logistics Center', state: 'pending', group: GROUP },
          dst: { name: 'Southern Military District', state: 'pending', group: OTHER_GROUP },
        }),
      ],
      documents: [V1],
      passages: [passage(SAMPLE_UNITS.link, 3)],
    },
    {
      unit: SAMPLE_UNITS.disputed,
      kind: 'entity',
      name: 'North American countries',
      type: 'state_body',
      proposer: 'extractor',
      group: null,
      acts: [
        {
          id: SAMPLE_UNITS.disputed,
          op: 'create_entity',
          payload: { type: 'state_body', label: 'North American countries', attrs: {} },
          targetId: null,
          dissent: true,
          dissentReason: 'no cited passage states label "North American countries"',
          target: null,
          src: null,
          dst: null,
        },
      ],
      documents: [REPORT],
      passages: [
        {
          act: SAMPLE_UNITS.disputed,
          document: REPORT.id,
          page: 14,
          before:
            'Table 3 reports the change of the trade.\nThe rows group the partners by region.\n',
          text: 'European and Asian countries',
          after: ' kept their imports.\nThe next section turns to the prices.',
        },
      ],
    },
  ],
};
