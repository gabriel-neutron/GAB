import { z } from 'zod';

// Rows of events for the tests and the stories of the lane of events and of the card of an asset.
// They go on top of the fixed release, which holds no event. The rows are made for the tests: they
// are not data of the registry.

export const SITE = '0a1f0000-0000-4000-8000-000000000020';
export const QUIET_SITE = '0a1f0000-0000-4000-8000-000000000021';
export const STRIKE = '0a1f0000-0000-4000-8000-000000000030';
export const FIRE = '0a1f0000-0000-4000-8000-000000000031';
export const ACCEPTED_STRIKE = '0a1f0000-0000-4000-8000-000000000032';
const ACTOR = '0a1f0000-0000-4000-8000-000000000040';

const SITE_NAME = 'Test oil terminal';
const STRIKE_NAME = `claimed attack — ${SITE_NAME} — 2026-05-15`;
const FIRE_NAME = `fire — ${SITE_NAME} — 2026-06`;
const ACCEPTED_STRIKE_NAME = `claimed attack — ${SITE_NAME} — 2026-03-02`;
const ACTOR_NAME = 'Unmanned Systems Forces';
const LABEL = 'Proposed — not checked';
// The CSV rows of the fixture quote no cell, so the label holds no comma.
const RULE = 'Accepted by rule strong_sources v2 — no person read it';
const LICENCE = '"derived fact; source under the provider licence, not redistributed"';

const entity = (id: string, type: string, label: string, origin = LABEL) =>
  `${id},${type},${label},${origin},${LICENCE},news`;

const relation = (
  id: string,
  type: string,
  from: readonly [string, string],
  to: readonly [string, string],
  origin = LABEL,
) =>
  `${id},${type},${from[0]},${from[1]},${to[0]},${to[1]},,,${origin},${LICENCE},news,${type.replaceAll('_', ' ')}`;

const claim = (
  subject: readonly [string, string],
  attribute: string,
  value: string,
  document: 'news' | 'rumod',
  excerpt: string,
  modality: 'asserts' | 'denies',
  origin = LABEL,
) =>
  `${subject[0]}/${attribute},attribute,entity,${subject[0]},${subject[1]},${attribute},"${value.replaceAll('"', '""')}",,,,,,${origin},${LICENCE},${document},A report of ${document},https://${document}.example.org/page,2026-09-28,1,"${excerpt}",${modality},false`;

const ENTITIES = [
  entity(SITE, 'facility', SITE_NAME, RULE),
  entity(QUIET_SITE, 'facility', 'Test quiet terminal'),
  entity(STRIKE, 'event', STRIKE_NAME),
  entity(FIRE, 'event', FIRE_NAME),
  entity(ACCEPTED_STRIKE, 'event', ACCEPTED_STRIKE_NAME, RULE),
  entity(ACTOR, 'military_unit', ACTOR_NAME),
];

const RELATIONS = [
  relation(
    '0a1f0000-0000-4000-8000-000000000050',
    'occurred_at',
    [STRIKE, STRIKE_NAME],
    [SITE, SITE_NAME],
  ),
  relation(
    '0a1f0000-0000-4000-8000-000000000051',
    'carried_out_by',
    [STRIKE, STRIKE_NAME],
    [ACTOR, ACTOR_NAME],
  ),
  relation(
    '0a1f0000-0000-4000-8000-000000000052',
    'occurred_at',
    [FIRE, FIRE_NAME],
    [SITE, SITE_NAME],
  ),
  relation(
    '0a1f0000-0000-4000-8000-000000000053',
    'occurred_at',
    [ACCEPTED_STRIKE, ACCEPTED_STRIKE_NAME],
    [SITE, SITE_NAME],
    RULE,
  ),
];

const relationClaim = (
  id: string,
  type: string,
  from: readonly [string, string],
  to: readonly [string, string],
  origin = LABEL,
) =>
  `${id},relation,entity,${from[0]},${from[1]},,,${type},${to[0]},${to[1]},,,${origin},${LICENCE},news,A report of news,https://news.example.org/page,2026-09-28,,,,`;

const CLAIMS = [
  relationClaim(
    '0a1f0000-0000-4000-8000-000000000050',
    'occurred_at',
    [STRIKE, STRIKE_NAME],
    [SITE, SITE_NAME],
  ),
  relationClaim(
    '0a1f0000-0000-4000-8000-000000000051',
    'carried_out_by',
    [STRIKE, STRIKE_NAME],
    [ACTOR, ACTOR_NAME],
  ),
  relationClaim(
    '0a1f0000-0000-4000-8000-000000000052',
    'occurred_at',
    [FIRE, FIRE_NAME],
    [SITE, SITE_NAME],
  ),
  claim(
    [STRIKE, STRIKE_NAME],
    'event_kind',
    'claimed attack',
    'news',
    'the terminal was hit',
    'asserts',
  ),
  claim(
    [STRIKE, STRIKE_NAME],
    'occurred_on',
    '["2026-05-14","2026-05-15"]',
    'news',
    'у ніч на 15 травня',
    'asserts',
  ),
  claim(
    [STRIKE, STRIKE_NAME],
    'occurred_on',
    '["2026-05-14","2026-05-15"]',
    'rumod',
    'No strike took place at the terminal',
    'denies',
  ),
  claim([FIRE, FIRE_NAME], 'event_kind', 'fire', 'news', 'a fire broke out', 'asserts'),
  claim([FIRE, FIRE_NAME], 'occurred_on', '["2026-06"]', 'news', 'in June', 'asserts'),
  relationClaim(
    '0a1f0000-0000-4000-8000-000000000053',
    'occurred_at',
    [ACCEPTED_STRIKE, ACCEPTED_STRIKE_NAME],
    [SITE, SITE_NAME],
    RULE,
  ),
  claim(
    [ACCEPTED_STRIKE, ACCEPTED_STRIKE_NAME],
    'event_kind',
    'claimed attack',
    'news',
    'drones hit the terminal',
    'asserts',
    RULE,
  ),
  claim(
    [ACCEPTED_STRIKE, ACCEPTED_STRIKE_NAME],
    'occurred_on',
    '["2026-03-02"]',
    'news',
    'on 2 March',
    'asserts',
    RULE,
  ),
];

const appended = (text: string, rows: readonly string[]): string =>
  rows.length === 0 ? text : `${text}${rows.join('\r\n')}\r\n`;

const ROWS: ReadonlyMap<string, readonly string[]> = new Map([
  ['entities.csv', ENTITIES],
  ['relations.csv', RELATIONS],
  ['claims.csv', CLAIMS],
]);

const measure = (
  kind: 'designated_by' | 'restricted_by',
  from: string,
  act: string,
  document: string,
  origin: string,
) => ({
  measure: kind,
  from,
  to: null,
  act_id: '0a1f0000-0000-4000-8000-000000000060',
  act_label: act,
  act_document: document,
  origin_label: origin,
});

// The site on the map, with one accepted EU listing and one UK measure in review.
const SITE_FEATURE = {
  type: 'Feature',
  id: SITE,
  geometry: { type: 'Point', coordinates: [33.5, 61.5] },
  properties: {
    id: SITE,
    type: 'facility',
    label: SITE_NAME,
    origin_label: RULE,
    licence: 'derived fact; source under the provider licence, not redistributed',
    document_ids: 'news',
    asset_kind: null,
    sanctions: {
      eu: [
        measure(
          'designated_by',
          '2025-05-20',
          'Council of the European Union',
          'Council Implementing Regulation (EU) 2025/0000',
          RULE,
        ),
      ],
      us: [],
      uk: [measure('restricted_by', '2025-09-01', 'HM Treasury', 'UK sanctions list', LABEL)],
    },
  },
};

const collection = z.looseObject({ features: z.array(z.unknown()) });

const withSite = (text: string): string => {
  const read = collection.parse(JSON.parse(text));
  return JSON.stringify({ ...read, features: [...read.features, SITE_FEATURE] });
};

/** The files of a release, with the events of the fixture added to its entities, relations and
 * claims, and the site added to its GeoJSON file. */
export const withEvents = (files: ReadonlyMap<string, string>): Map<string, string> =>
  new Map(
    [...files].map(([path, text]) => [
      path,
      path === 'entities.geojson' ? withSite(text) : appended(text, ROWS.get(path) ?? []),
    ]),
  );
