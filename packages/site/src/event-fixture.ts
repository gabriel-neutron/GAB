// Rows of events for the tests and the stories of the lane of events. They go on top of the fixed
// release, which holds no event.

export const SITE = '0a1f0000-0000-4000-8000-000000000020';
export const QUIET_SITE = '0a1f0000-0000-4000-8000-000000000021';
export const STRIKE = '0a1f0000-0000-4000-8000-000000000030';
export const FIRE = '0a1f0000-0000-4000-8000-000000000031';
const ACTOR = '0a1f0000-0000-4000-8000-000000000040';

const SITE_NAME = 'Primorsk oil terminal';
const STRIKE_NAME = `claimed attack — ${SITE_NAME} — 2026-05-15`;
const FIRE_NAME = `fire — ${SITE_NAME} — 2026-06`;
const ACTOR_NAME = 'Unmanned Systems Forces';
const LABEL = 'Proposed — not checked';
const LICENCE = '"derived fact; source under the provider licence, not redistributed"';

const entity = (id: string, type: string, label: string) =>
  `${id},${type},${label},${LABEL},${LICENCE},news`;

const relation = (
  id: string,
  type: string,
  from: readonly [string, string],
  to: readonly [string, string],
) =>
  `${id},${type},${from[0]},${from[1]},${to[0]},${to[1]},,,${LABEL},${LICENCE},news,${type.replaceAll('_', ' ')}`;

const claim = (
  subject: readonly [string, string],
  attribute: string,
  value: string,
  document: 'news' | 'rumod',
  excerpt: string,
  modality: 'asserts' | 'denies',
) =>
  `${subject[0]}/${attribute},attribute,entity,${subject[0]},${subject[1]},${attribute},"${value.replaceAll('"', '""')}",,,,,,${LABEL},${LICENCE},${document},A report of ${document},https://${document}.example.org/page,2026-09-28,1,"${excerpt}",${modality},false`;

const ENTITIES = [
  entity(SITE, 'facility', SITE_NAME),
  entity(QUIET_SITE, 'facility', 'Ust-Luga terminal'),
  entity(STRIKE, 'event', STRIKE_NAME),
  entity(FIRE, 'event', FIRE_NAME),
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
];

const relationClaim = (
  id: string,
  type: string,
  from: readonly [string, string],
  to: readonly [string, string],
) =>
  `${id},relation,entity,${from[0]},${from[1]},,,${type},${to[0]},${to[1]},,,${LABEL},${LICENCE},news,A report of news,https://news.example.org/page,2026-09-28,,,,`;

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
];

const appended = (text: string, rows: readonly string[]): string =>
  rows.length === 0 ? text : `${text}${rows.join('\r\n')}\r\n`;

const ROWS: ReadonlyMap<string, readonly string[]> = new Map([
  ['entities.csv', ENTITIES],
  ['relations.csv', RELATIONS],
  ['claims.csv', CLAIMS],
]);

/** The files of a release, with the events of the fixture added to its entities, relations and
 * claims. */
export const withEvents = (files: ReadonlyMap<string, string>): Map<string, string> =>
  new Map([...files].map(([path, text]) => [path, appended(text, ROWS.get(path) ?? [])]));
