import { expect, test } from 'vitest';

import type { ReleaseFile } from './csv-export.ts';
import { readCriticalNodesSheet } from './critical-nodes-sheet.ts';
import { releaseFiles } from './release-files.ts';
import { readReleaseManifest } from './release-manifest.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';
import { readReleaseTables } from './release-table.ts';

// The fixed release that the offline tests and the stories of the static site read. The release
// code writes it, so the site reads the files as a release gives them. Run this test with `-u`
// after a change of a release file to write the fixture again.

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const OWNER = '0a1f0000-0000-4000-8000-000000000002';
const COUNCIL = '0a1f0000-0000-4000-8000-000000000003';
const PORT = '0a1f0000-0000-4000-8000-000000000004';
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';
const OLD_OWNER = '0a1f0000-0000-4000-8000-000000000006';
const MANAGER = '0a1f0000-0000-4000-8000-000000000007';
const INSURER = '0a1f0000-0000-4000-8000-000000000008';
const TWIN = '0a1f0000-0000-4000-8000-000000000009';
const OWNS = '0a1f0000-0000-4000-8000-000000000011';
const DESIGNATED = '0a1f0000-0000-4000-8000-000000000012';
const LOADS = '0a1f0000-0000-4000-8000-000000000013';
const OLD_OWNS = '0a1f0000-0000-4000-8000-000000000014';
const OPERATES = '0a1f0000-0000-4000-8000-000000000015';
const INSURES = '0a1f0000-0000-4000-8000-000000000016';
const ACT = '0a1f0000-0000-4000-8000-000000000021';
const MERGE = '0a1f0000-0000-4000-8000-000000000022';

const RULE = 'Accepted by rule strong_sources v2 — no person read it, on 2026-10-02';
const OPERATOR = 'Validated manually by the operator, on 2026-10-04';
const CANDIDATE = 'Proposed — not checked';

const DISCLAIMER = `**About this data.** A machine reads public documents and proposes each claim. Each claim cites the documents that state it, and each claim carries a label that tells who decided it.

- **Proposed — not checked:** a candidate. No rule and no person checked it. It is not evidence.
- **Accepted by rule … — no person read it:** the claim passed a named rule on its cited sources. No person read it. Nobody has measured the accuracy of the rules yet.
- **Accepted by an AI reviewer — no person read it:** an AI checked the claim. No person read it.
- **Validated manually by the operator:** the operator read the sources and accepted the claim.

A claim tells what its sources say. A source can be wrong. GAB gives no personal data about a person beyond what a cited source already publishes. Each row carries its label: when you copy a row, copy its label with it.

Report an error: \`<link>\`. Right of reply: \`<link>\`.`;

const passage = (document: string, page: number, excerpt: string) => ({
  document,
  page,
  excerpt,
  modality: 'asserts',
  transcribed: false,
});

const claim = (over: Partial<ReleaseClaim> & Pick<ReleaseClaim, 'claim_id'>): ReleaseClaim => ({
  subject_kind: 'entity',
  subject_id: VESSEL,
  attribute: null,
  value: null,
  origin_label: RULE,
  sources: ['eu_act'],
  act_id: ACT,
  passages: [],
  ...over,
});

const CLAIMS: readonly ReleaseClaim[] = [
  claim({
    claim_id: `${VESSEL}/imo`,
    attribute: 'imo',
    value: '9000001',
    sources: ['eu_act'],
    passages: [passage('eu_act', 4, 'SEVERNAYA VOLNA, IMO 9000001')],
  }),
  claim({
    claim_id: `${VESSEL}/flag`,
    attribute: 'flag',
    value: 'Gabon',
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [passage('news', 1, 'the tanker now sails under the flag of Gabon')],
  }),
  claim({
    claim_id: `${OWNER}/registration_country`,
    subject_id: OWNER,
    attribute: 'registration_country',
    value: 'United Arab Emirates',
    origin_label: OPERATOR,
    sources: ['news'],
    passages: [passage('news', 2, 'Arctic Bridge Shipping, registered in Dubai')],
  }),
  claim({
    claim_id: OWNS,
    subject_kind: 'relation',
    subject_id: OWNS,
    origin_label: OPERATOR,
    sources: ['news'],
    passages: [passage('news', 2, 'Arctic Bridge Shipping bought the tanker in March 2024')],
  }),
  claim({
    claim_id: DESIGNATED,
    subject_kind: 'relation',
    subject_id: DESIGNATED,
    sources: ['eu_act'],
    passages: [passage('eu_act', 4, 'The vessels listed in Annex XLII: SEVERNAYA VOLNA')],
  }),
  claim({
    claim_id: LOADS,
    subject_kind: 'relation',
    subject_id: LOADS,
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [],
  }),
];

// The claims that the previous release does not hold: a vessel with a former name, a closed
// owner with the act that ended it, a manager with no start, a closed insurer, a port call with
// its day, and a second vessel with the same IMO number that no merge joined.
const NEW_CLAIMS: readonly ReleaseClaim[] = [
  claim({
    claim_id: `${VESSEL}/former_names`,
    attribute: 'former_names',
    value: ['Volna Star'],
    origin_label: OPERATOR,
    sources: ['news'],
    passages: [passage('news', 1, 'the tanker, formerly the Volna Star')],
  }),
  claim({
    claim_id: OLD_OWNS,
    subject_kind: 'relation',
    subject_id: OLD_OWNS,
    origin_label: OPERATOR,
    sources: ['news'],
    passages: [passage('news', 2, 'Baltic Tanker Holding owned the tanker from June 2019')],
  }),
  claim({
    claim_id: `${OLD_OWNS}/valid_to`,
    subject_kind: 'relation',
    subject_id: OLD_OWNS,
    attribute: 'valid_to',
    value: '2024-03-01',
    origin_label: OPERATOR,
    sources: ['news'],
    passages: [passage('news', 2, 'Baltic Tanker Holding sold the tanker in March 2024')],
  }),
  claim({
    claim_id: OPERATES,
    subject_kind: 'relation',
    subject_id: OPERATES,
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [passage('news', 3, 'Gulf Ship Management runs the tanker')],
  }),
  claim({
    claim_id: INSURES,
    subject_kind: 'relation',
    subject_id: INSURES,
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [passage('news', 3, 'Coastal Mutual covered the tanker until June 2025')],
  }),
  claim({
    claim_id: `${LOADS}/loaded_on`,
    subject_kind: 'relation',
    subject_id: LOADS,
    attribute: 'loaded_on',
    value: '2025-08-14',
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [passage('news', 4, 'the tanker loaded at Primorsk on 14 August 2025')],
  }),
  claim({
    claim_id: `${TWIN}/imo`,
    subject_id: TWIN,
    attribute: 'imo',
    value: 9000001,
    origin_label: CANDIDATE,
    sources: ['news'],
    passages: [passage('news', 5, 'the Northern Wave, IMO 9000001')],
  }),
];

const company = (id: string, label: string) => ({
  id,
  type: 'company',
  label,
  origin_label: CANDIDATE,
  sources: ['news'],
  geom: null,
});

const control = (
  id: string,
  type: string,
  src: string,
  from: string | null,
  to: string | null,
  label = CANDIDATE,
) => ({
  id,
  type,
  src_id: src,
  dst_id: VESSEL,
  valid_from: from,
  valid_to: to,
  origin_label: label,
  sources: ['news'],
});

const recordOf = (natoPair: boolean, withPort: boolean): ReleaseRecord => ({
  entities: [
    {
      id: VESSEL,
      type: 'vessel',
      label: 'Severnaya Volna',
      origin_label: RULE,
      sources: ['eu_act'],
      geom: { type: 'Point', coordinates: [28.85, 60.34] },
    },
    {
      id: OWNER,
      type: 'company',
      label: 'Arctic Bridge Shipping',
      origin_label: OPERATOR,
      sources: ['news'],
      geom: null,
    },
    {
      id: COUNCIL,
      type: 'organisation',
      label: 'Council of the European Union',
      origin_label: OPERATOR,
      sources: ['eu_act'],
      geom: null,
    },
    ...(withPort
      ? [
          {
            id: PORT,
            type: 'port',
            label: 'Primorsk',
            origin_label: CANDIDATE,
            sources: ['news'],
            geom: { type: 'Point', coordinates: [28.61, 60.35] },
          },
          company(OLD_OWNER, 'Baltic Tanker Holding'),
          company(MANAGER, 'Gulf Ship Management'),
          company(INSURER, 'Coastal Mutual'),
          {
            id: TWIN,
            type: 'vessel',
            label: 'Northern Wave',
            origin_label: CANDIDATE,
            sources: ['news'],
            geom: null,
          },
        ]
      : []),
  ],
  relations: [
    {
      id: OWNS,
      type: 'owns',
      src_id: OWNER,
      dst_id: VESSEL,
      valid_from: '2024-03-01',
      valid_to: null,
      origin_label: OPERATOR,
      sources: ['news'],
    },
    {
      id: DESIGNATED,
      type: 'designated_by',
      src_id: VESSEL,
      dst_id: COUNCIL,
      valid_from: '2025-05-20',
      valid_to: null,
      origin_label: RULE,
      sources: ['eu_act'],
    },
    ...(withPort
      ? [
          {
            id: LOADS,
            type: 'loads_at',
            src_id: VESSEL,
            dst_id: PORT,
            valid_from: null,
            valid_to: null,
            origin_label: CANDIDATE,
            sources: ['news'],
          },
          control(OLD_OWNS, 'owns', OLD_OWNER, '2019-06-01', '2024-03-01', OPERATOR),
          control(OPERATES, 'operates', MANAGER, null, null),
          control(INSURES, 'insures', INSURER, '2023-01-01', '2025-06-30'),
        ]
      : []),
  ],
  claims: withPort ? [...CLAIMS, ...NEW_CLAIMS] : CLAIMS.filter((one) => one.claim_id !== LOADS),
  merges: withPort
    ? [
        {
          act_id: MERGE,
          action: 'merge',
          day: '2026-10-05',
          absorbed_id: ABSORBED,
          survivor_id: VESSEL,
          resolves_to: VESSEL,
          origin_label: OPERATOR,
        },
      ]
    : [],
  documents: new Map([
    [
      'eu_act',
      {
        id: 'eu_act',
        title: 'Council Implementing Regulation (EU) 2025/0000',
        uri: 'https://eur-lex.europa.eu/eli/reg_impl/2025/0000/oj',
        retrieved_at: '2026-09-30',
        licence: 'eu-reuse',
        provider: 'eu',
      },
    ],
    [
      'news',
      {
        id: 'news',
        title: 'A tanker changes hands',
        uri: 'https://news.example.org/tanker',
        retrieved_at: '2026-09-28',
        licence: null,
        provider: null,
      },
    ],
  ]),
  nameCandidates: { proposed: 3, confirmed: 2, refused: 1 },
  disclaimer: DISCLAIMER,
  natoPairs: natoPair
    ? new Map([
        [`${VESSEL}/imo`, { letter: 'A', digit: 2 }],
        [DESIGNATED, { letter: 'A', digit: 1 }],
        [OWNS, { letter: 'C', digit: 3 }],
      ])
    : null,
});

const SHEET = [
  'node_id,condition,claim_ids,controller,bypass_pattern',
  `${VESSEL},b,${LOADS},Arctic Bridge Shipping,Ship-to-ship transfer off Gabon`,
  `${VESSEL},c,,,`,
  `${OWNER},,,Unknown beneficial owner,Shell company in a second jurisdiction`,
].join('\n');

const manifestOf = (natoPair: boolean, date: string, version: string) =>
  readReleaseManifest(
    JSON.stringify({
      version,
      date,
      showNatoPair: natoPair,
      contacts: {
        reportError: 'https://example.org/report-an-error',
        rightOfReply: 'mailto:reply@example.org',
      },
      iriBase: 'https://gab.example.org/',
    }),
    new Date(),
  );

const previousRelease = () => {
  const files = releaseFiles(
    recordOf(false, false),
    manifestOf(false, '2026-10-01', '0.9'),
    null,
    null,
  );
  return {
    version: '0.9',
    date: '2026-10-01',
    tables: readReleaseTables((path) => files.find((file) => file.path === path)?.text),
  };
};

const fixtureOf = (natoPair: boolean): readonly ReleaseFile[] =>
  releaseFiles(
    recordOf(natoPair, true),
    manifestOf(natoPair, '2026-11-08', '1.0'),
    readCriticalNodesSheet(SHEET),
    previousRelease(),
  );

test.each([
  ['release', false],
  ['release-nato', true],
])('the fixture %s of the static site is the release that the code writes', async (name, on) => {
  for (const file of fixtureOf(on))
    await expect(file.text).toMatchFileSnapshot(`../../../site/fixtures/${name}/${file.path}`);
});
