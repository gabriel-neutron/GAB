import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { SaidLine } from '@/shared/said-line';
import { writeSaid, type WriteState, type WriteWords } from '@/shared/write/write-state';

import { mergeImoPair, readImoPairs, type PairedVessel, type PairsRead } from './imo-pairs';

export interface ImoPairsPageProps {
  /** The pairs that the page read when it opened. */
  readonly read: PairsRead;
}

interface About {
  readonly survivor: string;
  readonly absorbed: string;
}

type PairMerge = WriteState<{ readonly proposalId: string }, About>;

const WORDS: WriteWords<{ readonly proposalId: string }, About> = {
  idle:
    'Two vessels with one IMO number are one ship. Keep one of them: the other merges into it, ' +
    'and its name becomes a former name.',
  working: ({ survivor, absorbed }) => `Merging "${absorbed}" into "${survivor}".`,
  done: ({ survivor, absorbed }) =>
    `"${absorbed}" was merged into "${survivor}", and it is a former name of it now.`,
  unknown: ({ survivor, absorbed }) =>
    `The merge of "${absorbed}" into "${survivor}" may stand. Read the list again.`,
};

const SAYS = 'The merge of a pair';

const HEAD = 'h-6 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1 align-top';

const CONTROL = cn(
  'h-6 border border-input px-2 text-xs outline-none focus-visible:border-ring',
  'focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors duration-100 hover:bg-muted',
  'disabled:opacity-50',
);

const pairKey = (first: PairedVessel, second: PairedVessel): string => `${first.id} ${second.id}`;

/** Each pair of vessels of the record with one IMO number. The operator keeps one vessel of a
 * pair, and the other merges into it. After each merge the page reads the list again. */
export function ImoPairsPage({ read }: ImoPairsPageProps) {
  // The list read after the last merge, and the read that it replaced. A new read of the route
  // replaces both.
  const [held, setHeld] = useState<{ readonly from: PairsRead; readonly now: PairsRead }>({
    from: read,
    now: read,
  });
  const [merge, setMerge] = useState<PairMerge>({ step: 'idle' });
  const now = held.from === read ? held.now : read;

  const keep = (survivor: PairedVessel, absorbed: PairedVessel): void => {
    const about = { survivor: survivor.label, absorbed: absorbed.label };
    setMerge({ step: 'working', ...about });
    // The result and the list read again land together, so no button acts on a list that the
    // merge made old.
    void mergeImoPair(survivor.id, absorbed.id).then(async (result) => {
      const again = await readImoPairs();
      setHeld({ from: read, now: again });
      setMerge({ ...result, ...about });
    });
  };

  const said = <SaidLine said={writeSaid(merge, WORDS)} label={SAYS} />;
  if (now.state === 'private')
    return (
      <div className="flex flex-col gap-2 p-2">
        {merge.step === 'idle' ? null : said}
        <p className="text-xs text-label">{now.why}</p>
      </div>
    );
  const working = merge.step === 'working';

  const vesselCell = (vessel: PairedVessel, other: PairedVessel) => (
    <td className={CELL}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="break-words">{vessel.label}</span>
        <span className="break-all font-mono text-label">{vessel.id}</span>
        <span>
          <button
            type="button"
            aria-label={`Keep this vessel, ${vessel.label} (${vessel.id}), and merge ${other.label} into it`}
            disabled={working}
            onClick={() => {
              keep(vessel, other);
            }}
            className={CONTROL}
          >
            Keep this vessel
          </button>
        </span>
      </span>
    </td>
  );

  return (
    <section
      aria-label="Vessels with the same IMO number"
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      {said}

      {now.pairs.length === 0 ? (
        <p className="text-xs text-label">No two vessels of the record have the same IMO number.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">
              Pairs of vessels of the record with the same IMO number, in the order of the number
            </caption>
            <thead className="text-label">
              <tr>
                <th scope="col" className={HEAD}>
                  IMO number
                </th>
                <th scope="col" className={HEAD}>
                  First vessel
                </th>
                <th scope="col" className={HEAD}>
                  Second vessel
                </th>
              </tr>
            </thead>
            <tbody>
              {now.pairs.map((pair) => (
                <tr
                  key={pairKey(pair.first, pair.second)}
                  data-pair={pairKey(pair.first, pair.second)}
                  className="border-t border-border"
                >
                  <td className={cn(CELL, 'font-mono tabular-nums')}>{pair.imo}</td>
                  {vesselCell(pair.first, pair.second)}
                  {vesselCell(pair.second, pair.first)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
