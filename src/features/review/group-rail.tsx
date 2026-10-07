import { proposerWords } from '@/shared/proposer-words';
import { cn } from '@/shared/lib/utils';

import { FAULT_WORDS } from './fault-marks';
import type { GroupLine } from './groups';

export interface GroupRailProps {
  readonly groups: readonly GroupLine[];
  readonly selectedId: string | null;
  readonly onSelect: (groupId: string) => void;
}

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

/** The groups that hold a unit that waits. Each line names the subject, the proposer and the
 * document, and counts the units, the clean units and the units of each fault. */
export function GroupRail({ groups, selectedId, onSelect }: GroupRailProps) {
  return (
    <nav aria-label="Groups that wait for a decision" className="flex min-h-0 flex-1 flex-col">
      <p className="h-6 shrink-0 border-b border-border px-2 text-small/4 leading-6 text-label">
        {groups.length === 1 ? '1 group waits' : `${String(groups.length)} groups wait`}
      </p>
      {groups.length === 0 ? (
        <p className="p-2 text-xs text-label">No group waits.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {groups.map((group) => {
            const subject = group.subject ?? 'Group with no subject';
            const source = group.document?.title ?? 'no document';
            const faults = group.faults
              .map((fault) => `${FAULT_WORDS[fault.kind]}: ${String(fault.units)}`)
              .join(' · ');
            return (
              <li key={group.id}>
                <button
                  type="button"
                  data-group={group.id}
                  aria-current={group.id === selectedId ? 'true' : undefined}
                  onClick={() => {
                    onSelect(group.id);
                  }}
                  className={cn(
                    CONTROL,
                    'flex w-full flex-col border-b border-l-2 border-b-border border-l-transparent px-2 py-1 text-left text-xs',
                    group.id === selectedId ? 'border-l-primary bg-muted' : null,
                  )}
                >
                  <span className="w-full min-w-0 truncate" title={subject}>
                    {subject}
                  </span>
                  <span
                    className="w-full min-w-0 truncate text-small/4 text-label"
                    title={`${proposerWords(group.proposer)}, ${source}`}
                  >
                    {proposerWords(group.proposer)} · {source}
                  </span>
                  <span className="w-full min-w-0 text-small/4 text-label tabular-nums">
                    {group.units === 1 ? '1 unit' : `${String(group.units)} units`} ·{' '}
                    {String(group.clean)} clean
                  </span>
                  {faults === '' ? null : (
                    <span
                      data-faults
                      className="w-full min-w-0 truncate text-small/4 text-dissent"
                      title={faults}
                    >
                      {faults}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
