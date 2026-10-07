import { LinkedWords } from './linked-words';
import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Attribute, EndState, Unit } from './unit-page';

export interface ChangeListProps {
  readonly unit: Unit | null;
  readonly words: UnitWords;
}

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

function Relation({ line }: { readonly line: RelationLine }) {
  return (
    <li data-relation={line.id} className="break-words">
      {line.from === null ? null : <span>{line.from} </span>}
      <span className="text-label">{line.word} →</span> <span>{line.other}</span>{' '}
      <span className="text-small/4 text-label">({STATE_WORDS[line.state]})</span>
      {line.disputed ? <span className="text-small/4 text-dissent"> disputed</span> : null}
    </li>
  );
}

/** What one unit proposes, as read-only text: the entity first, then its relations, then any other
 * act. Nothing here is a field, because nothing here can be changed. */
export function ChangeList({ unit, words }: ChangeListProps) {
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
              <Relation key={line.id} line={line} />
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
