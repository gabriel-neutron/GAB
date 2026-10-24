/** The rules of the event entity type: its name, its attributes and the types its relations reach. */

import { isDay } from '@gab/proposal/day';
import { CLAIMED_ATTACK, EVENT_DAYS, EVENT_KIND, EVENT_PRECISION } from '@gab/proposal/event-keys';
import type { WriteRequest } from '@gab/proposal/request';

export { CLAIMED_ATTACK, EVENT_DAYS, EVENT_KIND, EVENT_PRECISION };

/** The closed list of kinds of the first batch. An explosion keeps its word in the excerpt. */
const KINDS = [CLAIMED_ATTACK, 'fire', 'stoppage'] as const;

const PRECISIONS = ['day', 'night', 'month'] as const;

/** The types that the end of a relation of an event can have. */
const RELATION_ENDS: ReadonlyMap<
  string,
  { readonly from: readonly string[]; readonly to: readonly string[] }
> = new Map([
  ['occurred_at', { from: ['event'], to: ['facility', 'port', 'vessel'] }],
  ['carried_out_by', { from: ['event'], to: ['military_unit', 'state_body'] }],
]);

// The name is "kind — site — day". The site may hold a dash, so the kind is the text before the
// first separator and the day is the text after the last one.
const NAME = /^(.+?) — (.+) — (\d{4}-\d{2}(?:-\d{2})?)$/u;

/** The kind, the site and the day of an event name, or null when the name does not fit. */
export const parseEventName = (
  label: string,
): { readonly kind: string; readonly site: string; readonly day: string } | null => {
  const [, kind, site, day] = NAME.exec(label) ?? [];
  return kind === undefined || site === undefined || day === undefined ? null : { kind, site, day };
};
const MONTH = /^\d{4}-\d{2}$/u;

const asTexts = (value: unknown): string[] | null => {
  const list = Array.isArray(value) ? value : [value];
  return list.every((one) => typeof one === 'string') ? list : null;
};

const dayAfter = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

type Attributes = Readonly<Record<string, { readonly v: unknown }>>;

// The day that the name must hold, or the reason why the days do not fit their precision.
const nameDay = (
  precision: string,
  days: readonly string[],
): string | { readonly reason: string } => {
  if (precision === 'month')
    return days.length === 1 && days[0] !== undefined && MONTH.test(days[0])
      ? days[0]
      : { reason: 'a month holds one value, written as 2026-05' };
  const [first, second] = days;
  if (first === undefined || !days.every(isDay))
    return { reason: 'occurred_on holds days written as 2026-05-15' };
  if (precision === 'day') return days.length === 1 ? first : { reason: 'a day holds one value' };
  return days.length === 2 && second !== undefined && dayAfter(first) === second
    ? second
    : { reason: 'a night holds two days in a row: the day before and the day named' };
};

/** Why the name or the attributes of a new event are wrong, or null when they fit. The name is the
 * kind, the site and the day, and the kind and the day agree with the attributes. */
const eventRefusal = (label: string, attrs: Attributes | undefined): string | null => {
  const kind = attrs?.[EVENT_KIND]?.v;
  const precision = attrs?.[EVENT_PRECISION]?.v;
  const days = asTexts(attrs?.[EVENT_DAYS]?.v);
  if (typeof kind !== 'string' || !KINDS.some((one) => one === kind))
    return `an event has the attribute ${EVENT_KIND}, one of: ${KINDS.join(', ')}`;
  if (typeof precision !== 'string' || !PRECISIONS.some((one) => one === precision))
    return `an event has the attribute ${EVENT_PRECISION}, one of: ${PRECISIONS.join(', ')}`;
  if (days === null) return 'an event has the attribute occurred_on, written as a list of days';
  const day = nameDay(precision, days);
  if (typeof day !== 'string') return day.reason;
  const parts = NAME.exec(label);
  if (parts?.[1] !== kind || parts[3] !== day)
    return `the name of an event is "kind — site — day": here "${kind} — site — ${day}"`;
  return null;
};

/** Why an item of the batch breaks a rule of the event type, or null. */
export const eventActRefusal = (act: WriteRequest): string | null =>
  act.op === 'create_entity' && act.type === 'event' ? eventRefusal(act.label, act.attrs) : null;

/** Why a relation of an event cannot join these two types, or null. A relation of another type is
 * free. */
export const eventEndsRefusal = (
  relation: string,
  from: string | null,
  to: string | null,
): string | null => {
  const ends = RELATION_ENDS.get(relation);
  if (ends === undefined) return null;
  if (from === null || !ends.from.includes(from))
    return `${relation} starts at ${ends.from.join(' or ')}`;
  if (to === null || !ends.to.includes(to)) return `${relation} reaches ${ends.to.join(', ')} only`;
  return null;
};
