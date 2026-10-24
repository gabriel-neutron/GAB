/** The keys that name one legal or physical thing: an INN (tax_id), an OGRN (registration_number),
 * an IMO number and a LEI. Two entities, of any type, with the same value are one thing recorded
 * twice, or a wrong value. */
export const UNIQUE_KEYS = ['imo', 'tax_id', 'registration_number', 'lei'] as const;

export interface EntityIdentifiers {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  /** The attributes of the row: each key holds its value in `v`, alone or in a list. */
  readonly attrs: Readonly<Record<string, { readonly v: unknown }>>;
}

export interface DuplicateGroup {
  readonly key: (typeof UNIQUE_KEYS)[number];
  readonly value: string;
  readonly entities: { readonly id: string; readonly label: string; readonly type: string }[];
}

const valuesOf = (held: unknown): string[] =>
  (Array.isArray(held) ? held : [held])
    .filter((one): one is string | number => typeof one === 'string' || typeof one === 'number')
    .map((one) => String(one).replace(/[\s-]/gu, '').toUpperCase())
    .filter((one) => one !== '');

/** The groups of two or more entities that hold the same value of a unique key. It
 * only reads: it never merges. Each group goes to a reviewer, who confirms a merge. Two entities
 * with the same name and different values are not a group. */
export const duplicateIdentifiers = (entities: readonly EntityIdentifiers[]): DuplicateGroup[] => {
  const groups = new Map<
    string,
    DuplicateGroup & { entities: { id: string; label: string; type: string }[] }
  >();
  for (const entity of entities) {
    for (const key of UNIQUE_KEYS) {
      for (const value of new Set(valuesOf(entity.attrs[key]?.v))) {
        const at = JSON.stringify([key, value]);
        const group = groups.get(at) ?? { key, value, entities: [] };
        if (!group.entities.some((one) => one.id === entity.id)) {
          group.entities.push({ id: entity.id, label: entity.label, type: entity.type });
        }
        groups.set(at, group);
      }
    }
  }
  return [...groups.values()].filter((group) => group.entities.length > 1);
};
