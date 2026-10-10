import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { SaidLine } from '@/shared/said-line';
import { writeSaid, type WriteState, type WriteWords } from '@/shared/write/write-state';

import { decideAuthorName, readAuthorNames, type NamesRead } from './author-names';

export interface NamesPageProps {
  /** The names that the page read when it opened. */
  readonly read: NamesRead;
}

interface About {
  readonly name: string;
  readonly confirm: boolean;
}

type NameDecision = WriteState<{ readonly units: number }, About>;

const unitsWords = (units: number): string => (units === 1 ? '1 unit' : `${String(units)} units`);

const WORDS: WriteWords<{ readonly units: number }, About> = {
  idle:
    'A confirmation gives the name the letter of its author. A refusal makes the name F, and the ' +
    'name is rated again.',
  working: ({ name, confirm }) => `${confirm ? 'Confirming' : 'Refusing'} "${name}".`,
  done: ({ name, confirm, units }) =>
    `"${name}" was ${confirm ? 'confirmed' : 'refused'}. The rules decided ${unitsWords(units)} again.`,
  unknown: ({ name }) => `The decision on "${name}" may stand. Read the list again.`,
};

const SAYS = 'The decision on a name';

const HEAD = 'h-6 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1 align-top';

const CONTROL = cn(
  'h-6 border border-input px-2 text-xs outline-none focus-visible:border-ring',
  'focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors duration-100 hover:bg-muted',
  'disabled:opacity-50',
);

/** Each name that joined an author A or B and waits for the operator. The name reads as F until
 * the operator confirms it. After each decision the page reads the list again. */
export function NamesPage({ read }: NamesPageProps) {
  // The list read after the last decision, and the read that it replaced. A new read of the
  // route replaces both.
  const [held, setHeld] = useState<{ readonly from: NamesRead; readonly now: NamesRead }>({
    from: read,
    now: read,
  });
  const [decision, setDecision] = useState<NameDecision>({ step: 'idle' });
  const now = held.from === read ? held.now : read;

  const decide = (name: string, confirm: boolean): void => {
    setDecision({ step: 'working', name, confirm });
    // The result and the list read again land together, so no button acts on a list that the
    // decision made old.
    void decideAuthorName(name, confirm).then(async (result) => {
      const again = await readAuthorNames();
      setHeld({ from: read, now: again });
      setDecision({ ...result, name, confirm });
    });
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
  return (
    <section
      aria-label="Names that joined an author A or B"
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      {said}

      {now.names.length === 0 ? (
        <p className="text-xs text-label">No name waits for a decision.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">
              Names that joined an author A or B, the name with the most units first
            </caption>
            <thead className="text-label">
              <tr>
                <th scope="col" className={HEAD}>
                  Name
                </th>
                <th scope="col" className={HEAD}>
                  Author
                </th>
                <th scope="col" className={HEAD}>
                  Letter
                </th>
                <th scope="col" className={cn(HEAD, 'text-right')}>
                  Units
                </th>
                <th scope="col" className={HEAD}>
                  Decision
                </th>
              </tr>
            </thead>
            <tbody>
              {now.names.map((one) => (
                <tr key={one.name} data-name={one.name} className="border-t border-border">
                  <td className={cn(CELL, 'break-words')}>{one.name}</td>
                  <td className={cn(CELL, 'break-words')}>{one.author}</td>
                  <td className={cn(CELL, 'font-mono')}>{one.letter}</td>
                  <td className={cn(CELL, 'font-mono text-right tabular-nums')}>{one.units}</td>
                  <td className={cn(CELL, 'whitespace-nowrap')}>
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        aria-label={`Confirm ${one.name}`}
                        disabled={working}
                        onClick={() => {
                          decide(one.name, true);
                        }}
                        className={CONTROL}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        aria-label={`Refuse ${one.name}`}
                        disabled={working}
                        onClick={() => {
                          decide(one.name, false);
                        }}
                        className={CONTROL}
                      >
                        Refuse
                      </button>
                    </span>
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
