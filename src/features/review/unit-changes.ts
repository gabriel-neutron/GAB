import type { RelationWords } from '@/shared/relation-words';

import type { Attribute, EndState, Unit, UnitEnd } from './unit-page';

/** The words that the middle column reads: the words of a relation type, read from either end,
 * and the name of an entity type. */
export interface UnitWords {
  readonly relation: (key: string) => RelationWords;
  readonly entityType: (key: string) => string;
}

/** One relation of a unit, as "word → name of the other end". `from` names the source end when
 * the unit has no entity of its own. */
export interface RelationLine {
  readonly id: string;
  readonly from: string | null;
  readonly word: string;
  readonly other: string;
  readonly state: EndState;
  /** The end that the operator rejected, either end, with the day. Null where no end was
   * rejected. */
  readonly rejected: { readonly name: string; readonly on: string } | null;
  readonly disputed: boolean;
  /** The type is "unknown", or the record has no such type. */
  readonly typeUnknown: boolean;
}

/** One act that neither creates an entity nor a relation, with what it names. */
export interface OtherChange {
  readonly id: string;
  readonly op: string;
  readonly target: string;
  readonly attributes: readonly Attribute[];
  /** The end date that the act gives to an open relation, or null for any other change. */
  readonly closesOn: string | null;
}

/** What one unit proposes: the entity first, then its relations, then any other act. */
export interface UnitChanges {
  readonly entity: {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly attributes: readonly Attribute[];
    /** The keys that the v1 import kept to find the row of its file again. */
    readonly importKeys: readonly Attribute[];
    readonly disputed: boolean;
    readonly typeUnknown: boolean;
  } | null;
  readonly relations: readonly RelationLine[];
  readonly others: readonly OtherChange[];
}

// The state of the end says where it stands, so the name stays short.
const NO_NAME = 'an element';

const nameOf = (end: UnitEnd): string => end.name ?? NO_NAME;

const rejectedOf = (ends: readonly UnitEnd[]): RelationLine['rejected'] => {
  const end = ends.find((held) => held.state === 'rejected');
  return end === undefined ? null : { name: nameOf(end), on: end.rejectedOn ?? 'an unknown day' };
};

// The keys that the v1 import kept, as attributes of the record, to find the row of its file.
const IMPORT_KEYS: ReadonlySet<string> = new Set(['v1_id', 'osm_id', 'source_urls']);

export function unitChanges(unit: Unit, words: UnitWords): UnitChanges {
  const unknown = new Set(
    unit.faults.filter((fault) => fault.kind === 'unknown_type').map((fault) => fault.act),
  );
  const typeUnknown = (id: string, type: string): boolean => type === 'unknown' || unknown.has(id);
  const head = unit.acts.find((act) => act.kind === 'entity' && act.id === unit.id);
  const entity =
    head?.kind === 'entity'
      ? {
          id: head.id,
          name: head.label,
          type: words.entityType(head.type),
          attributes: head.attributes.filter((held) => !IMPORT_KEYS.has(held.key)),
          importKeys: head.attributes.filter((held) => IMPORT_KEYS.has(held.key)),
          disputed: head.disputed,
          typeUnknown: typeUnknown(head.id, head.type),
        }
      : null;

  const relations = unit.acts.flatMap((act): readonly RelationLine[] => {
    if (act.kind !== 'relation') return [];
    const typed = words.relation(act.type);
    const line = {
      id: act.id,
      disputed: act.disputed,
      typeUnknown: typeUnknown(act.id, act.type),
    };
    if (entity !== null && act.dst.id === entity.id && act.src.id !== entity.id)
      return [
        {
          ...line,
          from: null,
          word: typed.inverseLabel,
          other: nameOf(act.src),
          state: act.src.state,
          rejected: rejectedOf([act.src]),
        },
      ];
    return [
      {
        ...line,
        from: entity !== null && act.src.id === entity.id ? null : nameOf(act.src),
        word: typed.label,
        other: nameOf(act.dst),
        state: act.dst.state,
        rejected: rejectedOf(
          entity !== null && act.src.id === entity.id ? [act.dst] : [act.src, act.dst],
        ),
      },
    ];
  });

  const others = unit.acts.flatMap((act): readonly OtherChange[] =>
    act.kind === 'change'
      ? [
          {
            id: act.id,
            op: act.op,
            target: act.target === null ? '' : nameOf(act.target),
            attributes: act.attributes,
            closesOn: act.closesOn,
          },
        ]
      : [],
  );

  return { entity, relations, others };
}
