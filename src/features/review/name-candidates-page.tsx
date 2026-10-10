import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { SaidLine } from '@/shared/said-line';
import { writeSaid, type WriteState, type WriteWords } from '@/shared/write/write-state';

import {
  confirmNameCandidate,
  readNameCandidates,
  refuseNameCandidate,
  type CandidateEntity,
  type CandidatesRead,
  type NameCandidate,
} from './name-candidates';

export interface NameCandidatesPageProps {
  /** The candidates that the page read when it opened. */
  readonly read: CandidatesRead;
}

/** What the last decision was about: a merge into the kept entity, or a refusal of a pair. */
type About =
  | { readonly act: 'confirm'; readonly survivor: string; readonly absorbed: string }
  | { readonly act: 'refuse'; readonly first: string; readonly second: string };

type Decision = WriteState<object, About>;

const WORDS: WriteWords<object, About> = {
  idle:
    'Each pair has a Latin and a Cyrillic name that give one key. If they are one entity, keep ' +
    'one of them: the other merges into it, and its label becomes a former name. If not, refuse ' +
    'the pair: it does not come back.',
  working: (about) =>
    about.act === 'confirm'
      ? `Merging "${about.absorbed}" into "${about.survivor}".`
      : `Refusing the pair "${about.first}" and "${about.second}".`,
  done: (about) =>
    about.act === 'confirm'
      ? `"${about.absorbed}" was merged into "${about.survivor}", and it is a former name of it now.`
      : `The pair "${about.first}" and "${about.second}" was refused, and it does not come back.`,
  unknown: (about) =>
    about.act === 'confirm'
      ? `The merge of "${about.absorbed}" into "${about.survivor}" may stand. Read the list again.`
      : `The refusal of "${about.first}" and "${about.second}" may stand. Read the list again.`,
};

const SAYS = 'The decision on a candidate';

const HEAD = 'h-6 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1 align-top';

const CONTROL = cn(
  'h-6 border border-input px-2 text-xs outline-none focus-visible:border-ring',
  'focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors duration-100 hover:bg-muted',
  'disabled:opacity-50',
);

const pairKey = (candidate: NameCandidate): string =>
  `${candidate.first.id} ${candidate.second.id}`;

/** Each merge candidate across a Latin and a Cyrillic spelling. The operator keeps one entity of
 * a pair and the other merges into it, or refuses the pair. After each decision the page reads
 * the list again. */
export function NameCandidatesPage({ read }: NameCandidatesPageProps) {
  // The list read after the last decision, and the read that it replaced. A new read of the route
  // replaces both.
  const [held, setHeld] = useState<{
    readonly from: CandidatesRead;
    readonly now: CandidatesRead;
  }>({ from: read, now: read });
  const [decision, setDecision] = useState<Decision>({ step: 'idle' });
  const now = held.from === read ? held.now : read;

  // The result and the list read again land together, so no button acts on a list that the
  // decision made old.
  const decide = (about: About, write: () => ReturnType<typeof refuseNameCandidate>): void => {
    setDecision({ step: 'working', ...about });
    void write().then(async (result) => {
      const again = await readNameCandidates();
      setHeld({ from: read, now: again });
      setDecision({ ...result, ...about });
    });
  };

  const keep = (survivor: CandidateEntity, absorbed: CandidateEntity): void => {
    decide({ act: 'confirm', survivor: survivor.label, absorbed: absorbed.label }, () =>
      confirmNameCandidate(survivor.id, absorbed.id),
    );
  };

  const refuse = (candidate: NameCandidate): void => {
    decide({ act: 'refuse', first: candidate.first.label, second: candidate.second.label }, () =>
      refuseNameCandidate(candidate.first.id, candidate.second.id),
    );
  };

  const said = <SaidLine said={writeSaid(decision, WORDS)} label={SAYS} />;
  if (now.state === 'private')
    return (
      <div className="flex flex-col gap-2 p-2">
        {decision.step === 'idle' ? null : said}
        <p className="text-xs text-label">{now.why}</p>
      </div>
    );
  const working = decision.step === 'working';

  const entityCell = (entity: CandidateEntity, other: CandidateEntity) => (
    <td className={CELL}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="break-words">{entity.label}</span>
        {entity.name === entity.label ? null : (
          <span className="break-words text-label">Matched by the name {entity.name}</span>
        )}
        <span className="break-all font-mono text-label">{entity.id}</span>
        <span>
          <button
            type="button"
            aria-label={`Keep this entity, ${entity.label} (${entity.id}), and merge ${other.label} into it`}
            disabled={working}
            onClick={() => {
              keep(entity, other);
            }}
            className={CONTROL}
          >
            Keep this entity
          </button>
        </span>
      </span>
    </td>
  );

  return (
    <section
      aria-label="Merge candidates across a Latin and a Cyrillic spelling"
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      {said}

      {now.candidates.length === 0 ? (
        <p className="text-xs text-label">
          No pair of entities waits: no Latin and Cyrillic names of one type give one key that the
          operator has not decided.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">
              Pairs of entities of one type whose Latin and Cyrillic names give one transliteration
              key, in the order of the type and the key
            </caption>
            <thead className="text-label">
              <tr>
                <th scope="col" className={HEAD}>
                  Type
                </th>
                <th scope="col" className={HEAD}>
                  Key
                </th>
                <th scope="col" className={HEAD}>
                  First entity
                </th>
                <th scope="col" className={HEAD}>
                  Second entity
                </th>
                <th scope="col" className={HEAD}>
                  Not one entity
                </th>
              </tr>
            </thead>
            <tbody>
              {now.candidates.map((candidate) => (
                <tr
                  key={pairKey(candidate)}
                  data-pair={pairKey(candidate)}
                  className="border-t border-border"
                >
                  <td className={CELL}>{candidate.type}</td>
                  <td className={cn(CELL, 'font-mono break-words')}>{candidate.key}</td>
                  {entityCell(candidate.first, candidate.second)}
                  {entityCell(candidate.second, candidate.first)}
                  <td className={CELL}>
                    <button
                      type="button"
                      aria-label={`Refuse the pair ${candidate.first.label} and ${candidate.second.label}`}
                      disabled={working}
                      onClick={() => {
                        refuse(candidate);
                      }}
                      className={CONTROL}
                    >
                      Refuse
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
