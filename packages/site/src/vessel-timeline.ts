import { relationWords } from './relation-words.ts';
import type { SiteClaim, SiteRelation, SiteRelease } from './site-release.ts';

/** When a mark holds. An interval with no end is open: the release gives no end date, which does
 * not say that the relation ended. */
export type MarkTime =
  | {
      readonly kind: 'interval';
      readonly from: string | null;
      readonly to: string | null;
      /** The claim of the act that gave the end date, when the release holds one. */
      readonly endClaim: SiteClaim | null;
    }
  | {
      readonly kind: 'day';
      /** The key of the value that gives the day. */
      readonly key: string;
      readonly day: string;
    }
  | { readonly kind: 'no date' };

/** One mark of the timeline of a vessel. It links to its claim. */
export interface TimelineMark {
  /** Unique in the timeline of one vessel. */
  readonly key: string;
  readonly words: string;
  /** The entity at the other end of a relation, or null for a value of the vessel. */
  readonly otherId: string | null;
  readonly claim: SiteClaim;
  readonly time: MarkTime;
}

export type LaneKey =
  'names' | 'flags' | 'owners' | 'operators' | 'insurers' | 'designations' | 'port calls';

export interface TimelineLane {
  readonly key: LaneKey;
  readonly words: string;
  readonly marks: readonly TimelineMark[];
}

const LANES: readonly { readonly key: LaneKey; readonly words: string }[] = [
  { key: 'names', words: 'Former names' },
  { key: 'flags', words: 'Flags' },
  { key: 'owners', words: 'Owners' },
  { key: 'operators', words: 'Managers and operators' },
  { key: 'insurers', words: 'Insurers' },
  { key: 'designations', words: 'Designations' },
  { key: 'port calls', words: 'Port calls' },
];

// The relation types of the vocabulary that tell the life of a vessel, and the end of the relation
// that the vessel holds: the second end when a party acts on the vessel, the first end when the
// vessel acts. A relation with the vessel at the other end tells something else, and is no mark.
// The vocabulary has no separate type for a manager, so `operates` holds the managers and the
// operators. An event takes its days as values of the relation, and never as an interval.
interface LaneRule {
  readonly lane: LaneKey;
  readonly vesselIs: 'from' | 'to';
  readonly event: boolean;
}

const RULES: ReadonlyMap<string, LaneRule> = new Map([
  ['flags', { lane: 'flags', vesselIs: 'to', event: false }],
  ['flagged_falsely', { lane: 'flags', vesselIs: 'from', event: true }],
  ['owns', { lane: 'owners', vesselIs: 'to', event: false }],
  ['operates', { lane: 'operators', vesselIs: 'to', event: false }],
  ['insures', { lane: 'insurers', vesselIs: 'to', event: false }],
  ['designated_by', { lane: 'designations', vesselIs: 'from', event: false }],
  ['berthed_at', { lane: 'port calls', vesselIs: 'from', event: true }],
  ['loads_at', { lane: 'port calls', vesselIs: 'from', event: true }],
  ['discharges_at', { lane: 'port calls', vesselIs: 'from', event: true }],
]);

const LANE_OF_VALUE: ReadonlyMap<string, LaneKey> = new Map([
  ['former_names', 'names'],
  ['flag', 'flags'],
  ['flag_history', 'flags'],
]);

const DAY = /^\d{4}-\d{2}-\d{2}$/u;

const END_KEY = 'valid_to';

// The day of an event is its `observed_on` value. With none, any value of the event that is a day
// is its day, the first in the order of the release.
const OBSERVED_KEY = 'observed_on';

/** The elements of a value: a list in its JSON text gives each element, and any other text gives
 * itself. */
const elementsOf = (value: string): readonly string[] => {
  if (!value.startsWith('[')) return [value];
  try {
    const list: unknown = JSON.parse(value);
    if (Array.isArray(list))
      return list.flatMap((one) =>
        typeof one === 'string' || typeof one === 'number' ? [String(one)] : [],
      );
  } catch {
    // A text that only starts like a list is one value.
  }
  return [value];
};

const dayOf = (
  values: readonly SiteClaim[],
): { claim: SiteClaim; key: string; day: string } | null => {
  const days = values.flatMap((one) =>
    one.kind === 'attribute' && DAY.test(one.value)
      ? [{ claim: one, key: one.attribute, day: one.value }]
      : [],
  );
  return days.find((one) => one.key === OBSERVED_KEY) ?? days[0] ?? null;
};

const relationMarks = (
  release: SiteRelease,
  claim: SiteClaim,
  relation: SiteRelation,
  rule: LaneRule,
): readonly TimelineMark[] => {
  const fromVessel = rule.vesselIs === 'from';
  const otherId = fromVessel ? relation.toId : relation.fromId;
  const otherLabel = fromVessel ? relation.toLabel : relation.fromLabel;
  const values = release.valuesOfRelation.get(relation.id) ?? [];
  if (rule.event) {
    const words = `${relationWords(relation.type, !fromVessel)} ${otherLabel}`;
    const day = dayOf(values);
    return [
      day === null
        ? { key: claim.id, words, otherId, claim, time: { kind: 'no date' } }
        : {
            key: day.claim.id,
            words,
            otherId,
            claim: day.claim,
            time: { kind: 'day', key: day.key, day: day.day },
          },
    ];
  }
  const endClaim =
    values.find((one) => one.kind === 'attribute' && one.attribute === END_KEY) ?? null;
  return [
    {
      key: claim.id,
      words: otherLabel,
      otherId,
      claim,
      time: {
        kind: 'interval',
        from: relation.validFrom,
        to: relation.validTo,
        endClaim: relation.validTo === null ? null : endClaim,
      },
    },
  ];
};

// The marks of a lane go in the order of time: an unknown start first, because it can be the
// oldest, and a mark with no date last. A tie goes to the key, so one release gives one order.
const rankOf = (mark: TimelineMark): readonly [number, string] => {
  if (mark.time.kind === 'interval') return [mark.time.from === null ? 0 : 1, mark.time.from ?? ''];
  if (mark.time.kind === 'day') return [1, mark.time.day];
  return [2, ''];
};

const byTime = (one: TimelineMark, two: TimelineMark): number => {
  const [groupOne, dayOne] = rankOf(one);
  const [groupTwo, dayTwo] = rankOf(two);
  if (groupOne !== groupTwo) return groupOne - groupTwo;
  if (dayOne !== dayTwo) return dayOne < dayTwo ? -1 : 1;
  return one.key < two.key ? -1 : one.key > two.key ? 1 : 0;
};

/** The lanes of the timeline of one vessel, from the bounds of its relations and its dated
 * claims. A lane with no mark is left out. */
export const vesselLanes = (release: SiteRelease, vesselId: string): readonly TimelineLane[] => {
  const marks = new Map<LaneKey, TimelineMark[]>();
  const add = (lane: LaneKey, more: readonly TimelineMark[]) => {
    marks.set(lane, [...(marks.get(lane) ?? []), ...more]);
  };
  for (const claim of release.claimsAbout.get(vesselId) ?? []) {
    if (claim.kind === 'relation') {
      const { relation } = claim;
      const rule = RULES.get(relation.type);
      const vesselEnd = rule?.vesselIs === 'from' ? relation.fromId : relation.toId;
      if (rule !== undefined && vesselEnd === vesselId)
        add(rule.lane, relationMarks(release, claim, relation, rule));
      continue;
    }
    const lane = LANE_OF_VALUE.get(claim.attribute);
    if (lane === undefined) continue;
    add(
      lane,
      elementsOf(claim.value).map((words, index) => ({
        key: `${claim.id}#${String(index)}`,
        words,
        otherId: null,
        claim,
        time: { kind: 'no date' },
      })),
    );
  }
  return LANES.flatMap((lane) => {
    const list = marks.get(lane.key) ?? [];
    return list.length === 0 ? [] : [{ ...lane, marks: [...list].sort(byTime) }];
  });
};
