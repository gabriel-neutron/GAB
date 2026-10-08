import { cn } from '@/shared/lib/utils';

import { LinkedWords } from './linked-words';
import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Attribute, EndState, Unit } from './unit-page';

/** What the operator did to one relation: aim the rejection at it, or reject it at once because
 * its other end was rejected. */
export type RelationAct =
  | { readonly kind: 'aim'; readonly relationId: string }
  | { readonly kind: 'end_rejected'; readonly relationId: string };

export interface ChangeListProps {
  readonly unit: Unit | null;
  readonly words: UnitWords;
  /** The relation that the operator aims to reject alone, or null. */
  readonly aimed: string | null;
  readonly onRelation: (act: RelationAct) => void;
}

const AIM = cn(
  'ml-1 text-small/4 text-label underline underline-offset-2 outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 hover:text-foreground',
);

const STATE_WORDS: Readonly<Record<Exclude<EndState, 'rejected'>, string>> = {
  record: 'in the record',
  pending: 'waits in the queue',
  missing: 'not in the record and not in the queue',
};

// A relation alone names the end that was rejected, because either end can be the one.
const stateWords = (line: RelationLine): string => {
  if (line.rejected === null)
    return line.state === 'rejected' ? STATE_WORDS.missing : STATE_WORDS[line.state];
  return line.from === null
    ? `the other end was rejected on ${line.rejected.on}`
    : `${line.rejected.name} was rejected on ${line.rejected.on}`;
};

const HEADING = 'mt-3 text-small/4 tracking-caps text-label uppercase';

function Attributes({ attributes }: { readonly attributes: readonly Attribute[] }) {
  if (attributes.length === 0) return <p className="text-label">No attribute.</p>;
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-2 gap-y-0.5">
      {attributes.map((attribute) => (
        <div key={attribute.key} className="contents">
          <dt className="text-label">{attribute.key}:</dt>
          <dd className="min-w-0 break-words">
            {/* Each value of a list is its own text, so an address in it is its own link. */}
            {attribute.values.map((value, at) => (
              // The values of one attribute never move, so the position is their identity.
              <span key={at}>
                {at === 0 ? null : ', '}
                <LinkedWords text={value} />
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface RelationProps {
  readonly line: RelationLine;
  /** False where the relation is the whole unit, so it is rejected with its unit. */
  readonly alone: boolean;
  readonly aimed: boolean;
  readonly onRelation: (act: RelationAct) => void;
}

function Relation({ line, alone, aimed, onRelation }: RelationProps) {
  return (
    <li
      data-relation={line.id}
      aria-current={aimed ? 'true' : undefined}
      className={cn('break-words', aimed && 'bg-muted')}
    >
      {line.from === null ? null : <span>{line.from} </span>}
      <span className="text-label">{line.word} →</span> <span>{line.other}</span>{' '}
      {line.typeUnknown ? (
        <span data-type-unknown className="text-small/4 text-dissent">
          (type unknown){' '}
        </span>
      ) : null}
      <span
        className={cn('text-small/4', line.rejected === null ? 'text-label' : 'text-destructive')}
      >
        ({stateWords(line)})
      </span>
      {line.disputed ? <span className="text-small/4 text-dissent"> disputed</span> : null}
      {line.rejected !== null ? (
        <button
          type="button"
          className={AIM}
          onClick={() => {
            onRelation({ kind: 'end_rejected', relationId: line.id });
          }}
        >
          Reject this relation: end rejected
        </button>
      ) : !alone || aimed ? null : (
        <button
          type="button"
          className={AIM}
          onClick={() => {
            onRelation({ kind: 'aim', relationId: line.id });
          }}
        >
          Reject this relation
        </button>
      )}
    </li>
  );
}

/** What one unit proposes, as read-only text: the entity first, then its relations, then any other
 * act. Nothing here is a field, because nothing here can be changed. */
export function ChangeList({ unit, words, aimed, onRelation }: ChangeListProps) {
  if (unit === null)
    return (
      <section aria-label="The changes of the unit" className="p-3 text-xs text-label">
        Choose a unit on the left.
      </section>
    );
  const { entity, relations, others } = unitChanges(unit, words);
  return (
    <section
      aria-label="The changes of the unit"
      className="min-h-0 overflow-y-auto overscroll-contain p-3 text-xs"
    >
      <h2 className="text-sm">{unit.name}</h2>
      {entity === null ? null : (
        <>
          <p className="text-label">
            {entity.typeUnknown ? (
              <>
                New entity. <span className="text-dissent">Its type is unknown.</span>
              </>
            ) : (
              `New ${entity.type.toLowerCase()}.`
            )}{' '}
            Nothing of it is in the record yet.
            {entity.disputed ? <span className="text-dissent"> Disputed.</span> : null}
          </p>
          <h3 className={HEADING}>Attributes</h3>
          <Attributes attributes={entity.attributes} />
          {entity.importKeys.length === 0 ? null : (
            <>
              <h3 className={HEADING}>Import keys</h3>
              <Attributes attributes={entity.importKeys} />
            </>
          )}
        </>
      )}
      {unit.kind === 'link' ? (
        <p className="text-label">
          A relation between two groups. It is a unit of its own, so no entity waits for it.
        </p>
      ) : null}
      {relations.length === 0 ? null : (
        <>
          <h3 className={HEADING}>
            {entity === null
              ? 'Relation'
              : `Relations that come with it (${String(relations.length)})`}
          </h3>
          <ul className="space-y-0.5">
            {relations.map((line) => (
              <Relation
                key={line.id}
                line={line}
                alone={entity !== null}
                aimed={line.id === aimed}
                onRelation={onRelation}
              />
            ))}
          </ul>
        </>
      )}
      {others.map((other) => (
        <div key={other.id} data-change={other.id}>
          <h3 className={HEADING}>
            {other.op.replaceAll('_', ' ')}
            {other.target === '' ? '' : ` of ${other.target}`}
          </h3>
          <Attributes attributes={other.attributes} />
        </div>
      ))}
      <p className="mt-3 text-small/4 text-label">
        Nothing here is written to the record until the operator decides.
      </p>
    </section>
  );
}
