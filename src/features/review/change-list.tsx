import { cn } from '@/shared/lib/utils';

import { LinkedWords } from './linked-words';
import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Attribute, EndState, Unit } from './unit-page';

export interface ChangeListProps {
  readonly unit: Unit | null;
  readonly words: UnitWords;
  /** The relation that the operator aims to reject alone, or null. */
  readonly aimed: string | null;
  /** The operator aims the rejection at one relation of the unit. */
  readonly onAim: (relationId: string) => void;
}

const AIM = cn(
  'ml-1 text-small/4 text-label underline underline-offset-2 outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 hover:text-foreground',
);

const STATE_WORDS: Readonly<Record<EndState, string>> = {
  record: 'in the record',
  pending: 'waits in the queue',
  missing: 'not in the record and not in the queue',
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
            <LinkedWords text={attribute.values.join(', ')} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface RelationProps {
  readonly line: RelationLine;
  /** Null where the relation is the whole unit, so it is rejected with its unit. */
  readonly onAim: (() => void) | null;
  readonly aimed: boolean;
}

function Relation({ line, onAim, aimed }: RelationProps) {
  return (
    <li
      data-relation={line.id}
      aria-current={aimed ? 'true' : undefined}
      className={cn('break-words', aimed && 'bg-muted')}
    >
      {line.from === null ? null : <span>{line.from} </span>}
      <span className="text-label">{line.word} →</span> <span>{line.other}</span>{' '}
      <span className="text-small/4 text-label">({STATE_WORDS[line.state]})</span>
      {line.disputed ? <span className="text-small/4 text-dissent"> disputed</span> : null}
      {onAim === null || aimed ? null : (
        <button type="button" className={AIM} onClick={onAim}>
          Reject this relation
        </button>
      )}
    </li>
  );
}

/** What one unit proposes, as read-only text: the entity first, then its relations, then any other
 * act. Nothing here is a field, because nothing here can be changed. */
export function ChangeList({ unit, words, aimed, onAim }: ChangeListProps) {
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
            New {entity.type.toLowerCase()}. Nothing of it is in the record yet.
            {entity.disputed ? <span className="text-dissent"> Disputed.</span> : null}
          </p>
          <h3 className={HEADING}>Attributes</h3>
          <Attributes attributes={entity.attributes} />
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
                aimed={line.id === aimed}
                onAim={
                  entity === null
                    ? null
                    : () => {
                        onAim(line.id);
                      }
                }
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
