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
  /** The day the operator rejected the other end, or null. */
  readonly rejectedOn: string | null;
  readonly disputed: boolean;
}

/** One act that neither creates an entity nor a relation, with what it names. */
export interface OtherChange {
  readonly id: string;
  readonly op: string;
  readonly target: string;
  readonly attributes: readonly Attribute[];
}

/** What one unit proposes: the entity first, then its relations, then any other act. */
export interface UnitChanges {
  readonly entity: {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly attributes: readonly Attribute[];
    readonly disputed: boolean;
  } | null;
  readonly relations: readonly RelationLine[];
  readonly others: readonly OtherChange[];
}

// The state of the end says where it stands, so the name stays short.
const NO_NAME = 'an element';

const nameOf = (end: UnitEnd): string => end.name ?? NO_NAME;

export function unitChanges(unit: Unit, words: UnitWords): UnitChanges {
  const head = unit.acts.find((act) => act.kind === 'entity' && act.id === unit.id);
  const entity =
    head?.kind === 'entity'
      ? {
          id: head.id,
          name: head.label,
          type: words.entityType(head.type),
          attributes: head.attributes,
          disputed: head.disputed,
        }
      : null;

  const relations = unit.acts.flatMap((act): readonly RelationLine[] => {
    if (act.kind !== 'relation') return [];
    const typed = words.relation(act.type);
    const line = { id: act.id, disputed: act.disputed };
    if (entity !== null && act.dst.id === entity.id && act.src.id !== entity.id)
      return [
        {
          ...line,
          from: null,
          word: typed.inverseLabel,
          other: nameOf(act.src),
          state: act.src.state,
          rejectedOn: act.src.rejectedOn,
        },
      ];
    return [
      {
        ...line,
        from: entity !== null && act.src.id === entity.id ? null : nameOf(act.src),
        word: typed.label,
        other: nameOf(act.dst),
        state: act.dst.state,
        rejectedOn: act.dst.rejectedOn,
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
          },
        ]
      : [],
  );

  return { entity, relations, others };
}
