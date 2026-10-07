import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import type { WriteState } from '@/shared/write/write-state';

import { groupConfirmation } from './group-confirmation';
import type { GroupUnits } from './groups';
import type { UnitResult } from './send-group-action';
import type { UnitWords } from './unit-changes';

/** The group action that the screen stands in, and the group it is about. */
export type GroupActionState = WriteState<
  { readonly results: readonly UnitResult[] },
  { readonly groupId: string }
>;

/** The group on the screen: none chosen, one that is being read, one that this page cannot read,
 * or its units. Each group that is read carries the group action that the screen stands in. */
export type GroupView =
  | { readonly state: 'none' }
  | { readonly state: 'reading'; readonly groupId: string }
  | {
      readonly state: 'private';
      readonly groupId: string;
      readonly why: string;
      readonly action: GroupActionState;
    }
  | { readonly state: 'held'; readonly group: GroupUnits; readonly action: GroupActionState };

export interface GroupPanelProps {
  readonly view: GroupView;
  readonly words: UnitWords;
  /** The operator confirmed the group action on the clean units that the screen showed. */
  readonly onPromote: (groupId: string, unitIds: readonly string[]) => void;
}

const typeWords = (kind: string, type: string | null, words: UnitWords): string => {
  if (type === null) return 'change';
  return kind === 'link' ? words.relation(type).label : words.entityType(type);
};

function Results({ results }: { readonly results: readonly UnitResult[] }) {
  const promoted = results.filter((result) => result.outcome === 'promoted').length;
  const refused = results.filter((result) => result.outcome === 'refused');
  return (
    <section aria-label="The result of the group action" aria-live="polite" className="space-y-1">
      <p>
        The record holds {promoted === 1 ? '1 unit' : `${String(promoted)} units`} of the group
        action.
        {refused.length === 0
          ? null
          : ` ${String(refused.length)} refused, and they stay in the queue:`}
      </p>
      {refused.length === 0 ? null : (
        <ul className="space-y-1">
          {refused.map((result) => (
            <li key={result.unit} data-refused={result.unit}>
              <span className="text-foreground">{result.name}</span>
              <span className="text-destructive">: {result.said}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const sentenceOf = (action: GroupActionState): string | null => {
  switch (action.step) {
    case 'idle':
    case 'done':
      return null;
    case 'working':
      return 'The group action is on the way to the record.';
    case 'refused':
      return `Nothing was written: ${action.refusal}`;
    case 'unknown':
      return `${action.doubt} Open this page again before the next decision.`;
  }
};

/** One group: the action "Promote the clean proposals of this group", its confirmation with the
 * counts and the tree of the clean units, and the result of each unit. */
export function GroupPanel({ view, words, onPromote }: GroupPanelProps) {
  // The confirmation dies with the view: a reload asks for it again.
  const [confirming, setConfirming] = useState(false);
  if (view.state === 'none')
    return <p className="p-3 text-xs text-label">Choose a group in the list.</p>;
  if (view.state === 'reading')
    return <p className="p-3 text-xs text-label">Reading the units of the group.</p>;
  if (view.state === 'private')
    return (
      <section aria-label="The group" className="space-y-2 overflow-y-auto p-3 text-xs">
        {view.action.step === 'done' ? <Results results={view.action.results} /> : null}
        <p className="text-label">{view.why}</p>
      </section>
    );

  const { group, action } = view;
  const shown = groupConfirmation(group);
  const open = confirming && action.step !== 'working';
  const busy = action.step === 'working';
  const sentence = sentenceOf(action);
  const clean = shown.unitIds.length;

  return (
    <section
      aria-label="The group"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-3 text-xs"
    >
      <h2 className="text-sm">{group.subject ?? 'Group with no subject'}</h2>
      <p className="text-label tabular-nums">
        {group.units.length === 1 ? '1 unit waits' : `${String(group.units.length)} units wait`},{' '}
        {String(clean)} clean
      </p>

      {action.step === 'done' ? (
        <div className="mt-2">
          <Results results={action.results} />
        </div>
      ) : null}

      {open ? (
        <section aria-label="Confirm the group action" className="mt-2 space-y-2">
          <p data-said="group">{shown.said}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="xs"
              onClick={() => {
                setConfirming(false);
                onPromote(group.id, shown.unitIds);
              }}
            >
              Promote {clean === 1 ? '1 unit' : `${String(clean)} units`}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </Button>
          </div>
          <h3 className="text-label">The clean units</h3>
          <ul aria-label="The tree of the clean units">
            {shown.tree.map((row) => (
              <li
                key={row.id}
                data-depth={row.depth}
                className="flex min-w-0 gap-1"
                // A depth has no class of its own: each level moves the line by one step.
                style={{ paddingLeft: `${String(row.depth * 0.75)}rem` }}
              >
                <span className="min-w-0 truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 text-label">{typeWords(row.kind, row.type, words)}</span>
                {row.under === null ? null : (
                  <span className="min-w-0 truncate text-label" title={`under ${row.under}`}>
                    under {row.under}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-2 space-y-2">
          {clean === 0 ? <p data-said="group">{shown.said}</p> : null}
          <Button
            type="button"
            size="xs"
            disabled={busy || clean === 0}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Promote the clean proposals of this group
          </Button>
        </div>
      )}

      {sentence === null ? null : (
        <p
          role="status"
          className={cn(
            'mt-2',
            action.step === 'refused' || action.step === 'unknown'
              ? 'text-destructive'
              : 'text-label',
          )}
        >
          {sentence}
        </p>
      )}
    </section>
  );
}
