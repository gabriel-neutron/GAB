import type { proposeItem } from '@gab/tools/propose';
import type { z } from 'zod';

/** One item of the answer of the model, in the shape of the propose tool. */
export type ScreenItem = z.output<typeof proposeItem>;

/** Why code dropped an item before the write. */
export type DropReason =
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
}

/** The items that code keeps, the count of each drop, and the key of each entity that the kept
 * items create. A later part of the same job takes these keys as the entities it already has. */
export interface Screened {
  readonly items: ScreenItem[];
  readonly dropped: Partial<Record<DropReason, number>>;
  readonly proposed: string[];
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

/** Code drops each item of one answer that a rule can refuse, before the propose tool writes it.
 * `seen` holds the keys of the entities that earlier parts of the job proposed. Such an entity is
 * still a pending proposal, so the model cannot name it by its id. Code keeps it again when a kept
 * relation of the batch names it or when it has attributes, and drops it only when it adds
 * nothing. */
export const screenBatch = (
  given: readonly ScreenItem[],
  words: Vocabulary,
  seen: ReadonlySet<string>,
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
  // The refs of the entities that an earlier part of the job proposed.
  const repeats = new Set<string>();

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
    if (seen.has(key)) repeats.add(item.ref);
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

  // An entity of an earlier part stays only when a kept relation names it or it has attributes.
  // Nothing names a dropped repeat, so no relation falls with it.
  const named = new Set(
    items.flatMap(({ act }) => (act.op === 'create_relation' ? [act.srcId, act.dstId] : [])),
  );
  items = items.filter(({ ref, act }) => {
    const addsSomething = named.has(ref) || (act.op === 'create_entity' && act.attrs !== undefined);
    return !repeats.has(ref) || addsSomething ? true : drop('duplicate_in_job');
  });

  return {
    items,
    dropped,
    proposed: items.flatMap(({ act }) =>
      act.op === 'create_entity' ? [keyOf(act.type, act.label)] : [],
    ),
  };
};
