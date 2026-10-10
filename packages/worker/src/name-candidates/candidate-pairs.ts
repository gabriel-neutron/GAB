import { scriptOf, transliterationKey } from './transliteration-key.ts';

/** One name of an entity of the record: its label, or one of its other names. */
export interface EntityName {
  readonly entityId: string;
  readonly type: string;
  readonly name: string;
}

/** Two entities of one type with a Latin name and a Cyrillic name of one key. The first
 * identifier is the smaller one, and each name is the name of its own entity that matched. */
export interface CandidatePair {
  readonly firstId: string;
  readonly secondId: string;
  readonly type: string;
  readonly key: string;
  readonly firstName: string;
  readonly secondName: string;
}

const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const before = (a: CandidatePair, b: CandidatePair): boolean =>
  (order(a.key, b.key) || order(a.firstName, b.firstName) || order(a.secondName, b.secondName)) < 0;

/** The pairs of entities of one type where a Latin name of one and a Cyrillic name of the other
 * give one transliteration key. Two entities make one pair, with the first match in the order of
 * the key and the names. The pairs come in the order of the identifiers. */
export const candidatePairs = (names: readonly EntityName[]): readonly CandidatePair[] => {
  const groups = new Map<string, { latin: EntityName[]; cyrillic: EntityName[]; key: string }>();
  for (const one of names) {
    const script = scriptOf(one.name);
    const key = transliterationKey(one.name);
    if (key === null || (script !== 'latin' && script !== 'cyrillic')) continue;
    const group = `${one.type}\u0000${key}`;
    const held = groups.get(group) ?? { latin: [], cyrillic: [], key };
    held[script].push(one);
    groups.set(group, held);
  }

  const pairs = new Map<string, CandidatePair>();
  for (const { latin, cyrillic, key } of groups.values())
    for (const a of latin)
      for (const b of cyrillic) {
        if (a.entityId === b.entityId) continue;
        const [first, second] = a.entityId < b.entityId ? [a, b] : [b, a];
        const pair: CandidatePair = {
          firstId: first.entityId,
          secondId: second.entityId,
          type: a.type,
          key,
          firstName: first.name,
          secondName: second.name,
        };
        const id = `${pair.firstId} ${pair.secondId}`;
        const held = pairs.get(id);
        if (held === undefined || before(pair, held)) pairs.set(id, pair);
      }
  return [...pairs.values()].sort(
    (a, b) => order(a.firstId, b.firstId) || order(a.secondId, b.secondId),
  );
};
