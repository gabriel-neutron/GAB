import type { proposeItem } from '@gab/tools/propose';
import type { z } from 'zod';

/** One item of the answer of the model, in the shape of the propose tool. */
export type ScreenItem = z.output<typeof proposeItem>;

/** Why code dropped an item, or a part of an item, before the write. */
export type DropReason =
  | 'bound_on_undated_type'
  | 'type_outside_vocabulary'
  | 'generic_group'
  | 'generic_concept'
  | 'duplicate_in_job'
  | 'person_outside_publication_rule'
  | 'email_address'
  | 'names_a_dropped_item';

interface Vocabulary {
  readonly entityTypes: readonly string[];
  readonly relationTypes: readonly string[];
  /** The relation types that take a start date and an end date. */
  readonly datedRelationTypes: readonly string[];
}

/** The items that code keeps, the count of each drop, and the key and the item of each entity
 * that the kept items create. A later part of the same job takes these as the entities it already
 * has. */
export interface Screened {
  readonly items: ScreenItem[];
  readonly dropped: Partial<Record<DropReason, number>>;
  readonly proposed: (readonly [string, ScreenItem])[];
}

// The publication rule: a person is named only when a sanctions act designates the person, or a
// filing names the person as a director, an officer or an owner. The relation that states it must
// stand in the same batch, so an author, a quoted expert or a person of the acknowledgements is
// never proposed.
const PUBLICATION_RELATIONS: ReadonlySet<string> = new Set(['designated_by', 'appoints', 'owns']);

// A plural of "countries" with no proper name: "European countries", "Western nations". A word
// such as "of" or "united" makes a proper name: "United States", "Organization of American
// States".
const GROUP_NOUN = /^(?:countries|states|nations|economies|governments|jurisdictions)$/u;
const PROPER_WORD = /^(?:of|united|federated)$/u;
// A concept in place of a named act: "Financial sanctions", "Export controls". A named act holds a
// number, a longer title, or a capital letter after its first word: "Export Administration
// Regulations".
const CONCEPT_NOUN = /^(?:sanctions|measures|restrictions|controls|regulations|laws)$/u;
const MAX_CONCEPT_WORDS = 3;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const EMAIL_KEY = /(?:^|_)e_?mail(?:_|$)/u;

const wordsOf = (label: string): string[] =>
  label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word !== '' && word !== 'the');

const keyOf = (type: string, label: string): string => `${type}:${wordsOf(label).join(' ')}`;

const isGenericGroup = (label: string): boolean => {
  const words = wordsOf(label);
  return GROUP_NOUN.test(words.at(-1) ?? '') && !words.some((word) => PROPER_WORD.test(word));
};

const isGenericConcept = (label: string): boolean => {
  const words = wordsOf(label);
  const given = label
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '' && word.toLowerCase() !== 'the');
  return (
    words.length <= MAX_CONCEPT_WORDS &&
    CONCEPT_NOUN.test(words.at(-1) ?? '') &&
    !/\d/u.test(label) &&
    given.slice(1).every((word) => word === word.toLowerCase())
  );
};

type Attrs = NonNullable<Extract<ScreenItem['act'], { op: 'create_entity' }>['attrs']>;

const isEmail = (key: string, value: Attrs[string]['v']): boolean =>
  EMAIL_KEY.test(key) ||
  (Array.isArray(value) ? value : [value]).some(
    (one) => typeof one === 'string' && EMAIL.test(one),
  );

// The JSON text of a value with the keys of each object in sorted order.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, part: unknown) =>
    part !== null && typeof part === 'object' && !Array.isArray(part)
      ? Object.fromEntries(
          Object.entries(part as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : part,
  );

/** Code drops each item of one answer that a rule can refuse, before the propose tool writes it.
 * `seen` holds the key and the item of each entity that earlier parts of the job proposed. Such an
 * entity is still a pending proposal, so the model cannot name it by its id. Code keeps it as its
 * own item when it adds something: an attribute or a geometry that the earlier act does not have.
 * Code drops a repeat that adds nothing, unless a kept relation of the batch names it. Such a
 * repeat is sent as the act of the earlier part, with its label and its passages. The door then
 * returns the act that waits, and the job gives one proposal for the entity. */
export const screenBatch = (
  given: readonly ScreenItem[],
  words: Vocabulary,
  seen: ReadonlyMap<string, ScreenItem>,
): Screened => {
  const dropped: Partial<Record<DropReason, number>> = {};
  const drop = (reason: DropReason): false => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
    return false;
  };
  const gone = new Set<string>();
  // The ref of a duplicate in this batch, and the ref of the first item that creates the entity.
  const sameAs = new Map<string, string>();
  const firstOf = new Map<string, string>();
  // The ref of each entity that an earlier part of the job proposed, and the item of that part.
  const repeats = new Map<string, ScreenItem>();

  const entityStays = (item: ScreenItem): boolean => {
    const { act } = item;
    if (act.op !== 'create_entity') return true;
    if (!words.entityTypes.includes(act.type)) return drop('type_outside_vocabulary');
    if (act.type === 'state_body' && isGenericGroup(act.label)) return drop('generic_group');
    if (act.type === 'legal_act' && isGenericConcept(act.label)) return drop('generic_concept');
    const key = keyOf(act.type, act.label);
    const first = firstOf.get(key);
    if (first !== undefined) {
      sameAs.set(item.ref, first);
      return drop('duplicate_in_job');
    }
    firstOf.set(key, item.ref);
    const earlier = seen.get(key);
    if (earlier !== undefined) repeats.set(item.ref, earlier);
    return true;
  };

  let items = given.filter((item) => {
    const stays = entityStays(item);
    if (!stays) gone.add(item.ref);
    return stays;
  });
  items = items.map((item) =>
    item.act.op === 'create_relation'
      ? {
          ...item,
          act: {
            ...item.act,
            srcId: sameAs.get(item.act.srcId) ?? item.act.srcId,
            dstId: sameAs.get(item.act.dstId) ?? item.act.dstId,
          },
        }
      : item,
  );

  // A relation keeps both of its ends, and a relation can name a relation, so the drop runs until
  // nothing more falls.
  const relationsStay = (): void => {
    for (let changed = true; changed;) {
      changed = false;
      items = items.filter((item) => {
        const { act } = item;
        if (act.op !== 'create_relation') return true;
        const stays = !words.relationTypes.includes(act.type)
          ? drop('type_outside_vocabulary')
          : gone.has(act.srcId) || gone.has(act.dstId)
            ? drop('names_a_dropped_item')
            : true;
        if (!stays) {
          gone.add(item.ref);
          changed = true;
        }
        return stays;
      });
    }
  };
  relationsStay();

  // Only a dated type takes a start and an end. A bound on another type makes the door refuse the
  // whole batch, so code drops the bound and keeps the relation.
  items = items.map((item) => {
    const { act } = item;
    if (act.op !== 'create_relation' || words.datedRelationTypes.includes(act.type)) return item;
    if (act.validFrom === undefined && act.validTo === undefined) return item;
    const { validFrom, validTo, ...bare } = act;
    for (const bound of [validFrom, validTo])
      if (bound !== undefined) drop('bound_on_undated_type');
    return { ...item, act: bare };
  });

  const published = new Set(
    items.flatMap(({ act }) =>
      act.op === 'create_relation' && PUBLICATION_RELATIONS.has(act.type)
        ? [act.srcId, act.dstId]
        : [],
    ),
  );
  items = items.flatMap((item) => {
    const { act } = item;
    if (act.op !== 'create_entity' || act.type !== 'person') return [item];
    if (!published.has(item.ref)) {
      drop('person_outside_publication_rule');
      gone.add(item.ref);
      return [];
    }
    if (act.attrs === undefined) return [item];
    const kept = Object.entries(act.attrs).filter(([key, value]) => {
      if (!isEmail(key, value.v)) return true;
      return drop('email_address');
    });
    const { type, label, geom } = act;
    const bare = { op: act.op, type, label, ...(geom === undefined ? {} : { geom }) };
    return [
      { ...item, act: kept.length === 0 ? bare : { ...bare, attrs: Object.fromEntries(kept) } },
    ];
  });
  relationsStay();

  // An entity of an earlier part stays only when a kept relation names it or it adds something.
  // A repeat adds something when it has an attribute or a geometry that the earlier act does not
  // have. Code compares the values with their keys in sorted order, so the key order of the model
  // has no effect. An empty attributes object adds nothing. Nothing names a dropped repeat, so no
  // relation falls with it.
  const named = new Set(
    items.flatMap(({ act }) => (act.op === 'create_relation' ? [act.srcId, act.dstId] : [])),
  );
  const addsTo = (act: ScreenItem['act'], earlier: ScreenItem['act']): boolean => {
    if (act.op !== 'create_entity' || earlier.op !== 'create_entity') return false;
    const before = earlier.attrs ?? {};
    const newAttr = Object.entries(act.attrs ?? {}).some(
      ([key, value]) => before[key] === undefined || canonical(value) !== canonical(before[key]),
    );
    return newAttr || (act.geom !== undefined && canonical(act.geom) !== canonical(earlier.geom));
  };
  items = items.flatMap((item) => {
    const { ref, act } = item;
    const earlier = repeats.get(ref);
    if (earlier === undefined) return [item];
    if (addsTo(act, earlier.act)) return [item];
    if (!named.has(ref)) {
      drop('duplicate_in_job');
      return [];
    }
    // The door joins an act to the pending act with the same payload and the same passages.
    return [{ ...earlier, ref }];
  });

  return {
    items,
    dropped,
    proposed: items.flatMap((item) =>
      item.act.op === 'create_entity'
        ? [[keyOf(item.act.type, item.act.label), item] as const]
        : [],
    ),
  };
};
