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
  orphan: 'c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f',
  rejectedSource: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  pointer: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  twin: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
  blockedMix: 'd7e8f9a0-b1c2-4d3e-8f4a-5b6c7d8e9f0a',
} as const;

/** The relation of the orphan unit, whose other end the operator rejected. */
export const ORPHAN_RELATION = 'e0f1a2b3-c4d5-4e6f-9a7b-8c9d0e1f2a3b';

const REJECTED_PARENT = 'f3a4b5c6-d7e8-4f9a-8b0c-1d2e3f4a5b6c';

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

type Level = 'blocks' | 'waits' | 'not_clean' | 'information';

// A rejection before gives its reason as a key and its note, as the database gives them.
const faultsOf = (said: readonly (readonly [Level, string, string])[]) =>
  said.map(([level, kind, words]) =>
    kind === 'rejected_before'
      ? { kind, level, act: null, said: words, reason: 'wrong_value', note: 'A ferry.' }
      : { kind, level, act: null, said: words },
  );

// Each sample unit holds a set of faults that the check of the database can give together. A
// unit in a circle does not show the wait of the same end, and one relation has two ends only.
const BLOCKED_MIX = faultsOf([
  [
    'blocks',
    'circle',
    'Waits in a circle with 19th Separate EW Brigade, which waits for this unit: reject one ' +
      'relation of the circle',
  ],
  ['blocks', 'no_source', 'The act 68th GRAU arsenal cites no passage of a source'],
  [
    'blocks',
    'self',
    'The relation 68th GRAU arsenal subordinate to 68th GRAU arsenal has the same element at ' +
      'its two ends',
  ],
  ['not_clean', 'contradiction', 'Two acts set echelon differently: Army and Brigade'],
  ['not_clean', 'dispute', 'Disputed: the checker says unclear'],
  [
    'not_clean',
    'duplicate',
    'Same name and type under the same parent: 68th GRAU Arsenal is in the record',
  ],
  ['not_clean', 'reported_claim', 'The source reports a claim (alleges) and does not state a fact'],
  ['not_clean', 'unknown_type', 'The entity type is unknown'],
  ['not_clean', 'rejected_before', 'Rejected before on 2026-10-06'],
  ['information', 'approximate_position', 'The position is approximate'],
  ['information', 'note', 'Note: no clear location'],
  ['information', 'sources_from_parent', 'Sources from the parent Southern Military District'],
]);

/** The answer of the writer for the first page of the queue. */
export const UNIT_ANSWER = {
  total: 1082,
  matched: 1082,
  before: 0,
  next: [
    '0',
    '999',
    '5th combined arms army',
    GROUP,
    '1',
    '999',
    'trade of russia',
    SAMPLE_UNITS.disputed,
  ],
  choices: {
    groups: [
      { id: OTHER_GROUP, subject: 'Southern Military District' },
      { id: GROUP, subject: '5th Combined Arms Army' },
    ],
    documents: [
      { id: REPORT.id, title: REPORT.title },
      { id: V1.id, title: V1.title },
    ],
  },
  units: [
    {
      unit: ARMY,
      kind: 'entity',
      name: '5th Combined Arms Army',
      type: 'military_unit',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      state: 'clean',
      faults: [],
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
      state: 'clean',
      faults: [
        {
          kind: 'end_waits_in_group',
          level: 'waits',
          act: '4a7b2d3f-1c0e-4f8a-b2d4-6e8f0a2b4c6d',
          said: 'Waits for 5th Combined Arms Army in this group: promote it first',
        },
        {
          kind: 'approximate_position',
          level: 'information',
          act: BRIGADE,
          said: 'The position is approximate',
        },
        {
          kind: 'sources_from_parent',
          level: 'information',
          act: null,
          said: 'Sources from the parent 5th Combined Arms Army',
        },
      ],
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
      name: '1061st Logistics Center subordinate to Southern Military District',
      type: 'subordinate_to',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      state: 'blocked',
      faults: [
        {
          kind: 'end_waits',
          level: 'blocks',
          act: SAMPLE_UNITS.link,
          said: 'Waits for Southern Military District (group Southern Military District)',
        },
      ],
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
      state: 'not_clean',
      faults: [
        {
          kind: 'dispute',
          level: 'not_clean',
          act: SAMPLE_UNITS.disputed,
          said: 'Disputed: no cited passage states label "North American countries"',
        },
      ],
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
    {
      unit: SAMPLE_UNITS.orphan,
      kind: 'entity',
      name: '117th GRAU arsenal',
      type: 'military_unit',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      state: 'blocked',
      faults: [
        {
          kind: 'end_rejected',
          level: 'blocks',
          act: ORPHAN_RELATION,
          said: 'The other end 1061st Logistics Center was rejected on 2026-10-07',
        },
        {
          kind: 'same_name',
          level: 'information',
          act: null,
          said: 'Same name under 20th Combined Arms Army',
        },
      ],
      acts: [
        entity(SAMPLE_UNITS.orphan, '117th GRAU arsenal', { military_unit_number: '57229-51' }),
        relation(ORPHAN_RELATION, SAMPLE_UNITS.orphan, REJECTED_PARENT, {
          src: { name: '117th GRAU arsenal', state: 'pending', group: GROUP },
          dst: {
            name: '1061st Logistics Center',
            state: 'rejected',
            group: null,
            rejectedOn: '2026-10-07',
          },
        }),
      ],
      documents: [V1],
      passages: [passage(SAMPLE_UNITS.orphan, 3)],
    },
    {
      unit: SAMPLE_UNITS.rejectedSource,
      kind: 'link',
      name: '1061st Logistics Center subordinate to Eastern Military District',
      type: 'subordinate_to',
      proposer: 'v1_import',
      group: { id: OTHER_GROUP, subject: '1061st Logistics Center' },
      state: 'blocked',
      faults: [
        {
          kind: 'end_rejected',
          level: 'blocks',
          act: SAMPLE_UNITS.rejectedSource,
          said: 'The end 1061st Logistics Center was rejected on 2026-10-07',
        },
      ],
      acts: [
        relation(SAMPLE_UNITS.rejectedSource, REJECTED_PARENT, RECORD_UNIT, {
          src: {
            name: '1061st Logistics Center',
            state: 'rejected',
            group: null,
            rejectedOn: '2026-10-07',
          },
          dst: { name: 'Eastern Military District', state: 'record', group: null },
        }),
      ],
      documents: [V1],
      passages: [passage(SAMPLE_UNITS.rejectedSource, 3)],
    },
    {
      unit: SAMPLE_UNITS.pointer,
      kind: 'relation',
      name: '19th Separate EW Brigade contradicts a relation',
      type: 'contradicts',
      proposer: 'extractor',
      group: null,
      state: 'blocked',
      faults: faultsOf([
        [
          'blocks',
          'end_missing',
          'The end 19th Separate EW Brigade is not in the record and not in the queue',
        ],
        [
          'blocks',
          'end_relation_waits',
          'Points to the relation 5th Combined Arms Army subordinate to Eastern Military ' +
            'District, which is not in the record yet',
        ],
      ]),
      acts: [
        relation(SAMPLE_UNITS.pointer, DISTRICT, '3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c', {
          src: { name: '19th Separate EW Brigade', state: 'missing', group: null },
          dst: {
            name: '5th Combined Arms Army subordinate to Eastern Military District',
            state: 'pending',
            group: GROUP,
          },
        }),
      ],
      documents: [REPORT],
      passages: [],
    },
    {
      unit: SAMPLE_UNITS.twin,
      kind: 'entity',
      name: '439th Guards Rocket Artillery Brigade',
      type: 'military_unit',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      state: 'not_clean',
      faults: faultsOf([
        [
          'waits',
          'end_waits_in_group',
          'Waits for 5th Combined Arms Army in this group: promote it first',
        ],
        [
          'not_clean',
          'duplicate',
          'Same name and type under the same parent: 439th Guards Rocket Artillery Brigade ' +
            'waits in the queue (group 5th Combined Arms Army)',
        ],
        ['information', 'sources_from_parent', 'Sources from the parent 5th Combined Arms Army'],
      ]),
      acts: [
        entity(SAMPLE_UNITS.twin, '439th Guards Rocket Artillery Brigade', { echelon: 'Brigade' }),
        relation('5b8c3e4a-2d1f-4a9b-c3e5-7f9a1b3c5d7e', SAMPLE_UNITS.twin, ARMY, {
          src: { name: '439th Guards Rocket Artillery Brigade', state: 'pending', group: GROUP },
          dst: { name: '5th Combined Arms Army', state: 'pending', group: GROUP },
        }),
      ],
      documents: [V1],
      passages: [passage(SAMPLE_UNITS.twin, 1)],
    },
    {
      unit: SAMPLE_UNITS.blockedMix,
      kind: 'entity',
      name: '68th GRAU arsenal',
      type: 'unknown',
      proposer: 'v1_import',
      group: { id: GROUP, subject: '5th Combined Arms Army' },
      state: 'blocked',
      faults: BLOCKED_MIX,
      acts: [
        entity(SAMPLE_UNITS.blockedMix, '68th GRAU arsenal', {
          position_precision: 'approximate',
          note: 'no clear location',
        }),
      ],
      documents: [V1],
      passages: [passage(SAMPLE_UNITS.blockedMix, 4)],
    },
  ],
};
