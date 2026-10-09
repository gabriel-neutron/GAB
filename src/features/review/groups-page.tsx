import { cn } from '@/shared/lib/utils';

import { documentName } from './document-name';
import { GroupPanel, type GroupView } from './group-panel';
import { GroupRail } from './group-rail';
import type { GroupLine, GroupsRead } from './groups';
import type { UnitWords } from './unit-changes';

/** What the operator did on the page of the groups: open one group, or confirm its group
 * action on the clean units that the screen showed. */
export type GroupsAct =
  | { readonly kind: 'select'; readonly groupId: string }
  | { readonly kind: 'promote'; readonly groupId: string; readonly unitIds: readonly string[] };

export interface GroupsPageProps {
  readonly rail: GroupsRead<readonly GroupLine[]>;
  readonly group: GroupView;
  readonly words: UnitWords;
  readonly onAct: (act: GroupsAct) => void;
}

const selectedOf = (view: GroupView): string | null => {
  switch (view.state) {
    case 'none':
      return null;
    case 'reading':
    case 'private':
      return view.groupId;
    case 'held':
      return view.group.id;
  }
};

/** The groups of the queue in two columns: the rail of the groups, and one group with its group
 * action. Each column scrolls on its own. Below a width of 48rem the columns stack: the rail keeps
 * its own scroll at a capped height, and the page scrolls to the group below it. */
export function GroupsPage({ rail, group, words, onAct }: GroupsPageProps) {
  const selected = selectedOf(group);
  const cited =
    rail.state === 'held'
      ? (rail.read.find((line) => line.id === selected)?.document ?? null)
      : null;
  return (
    // The columns follow the width of the page, not of the window.
    <div className="@container h-full">
      <div
        data-groups-page
        className={cn(
          'h-full overflow-y-auto overscroll-contain',
          '@3xl:grid @3xl:min-h-0 @3xl:grid-cols-[clamp(16rem,30%,24rem)_minmax(0,1fr)] @3xl:overflow-hidden',
        )}
      >
        <div className="flex max-h-[60dvh] flex-col border-b border-border @3xl:max-h-none @3xl:min-h-0 @3xl:border-r @3xl:border-b-0">
          {rail.state === 'private' ? (
            <p className="p-3 text-xs text-label">{rail.why}</p>
          ) : (
            <GroupRail
              groups={rail.read}
              selectedId={selected}
              onSelect={(groupId) => {
                onAct({ kind: 'select', groupId });
              }}
            />
          )}
        </div>
        <div className="flex flex-col @3xl:min-h-0">
          <GroupPanel
            // A new group starts with no confirmation open.
            key={selected ?? ''}
            view={group}
            document={cited === null ? null : documentName({ ...cited, uri: null, mime: null })}
            words={words}
            onPromote={(groupId, unitIds) => {
              onAct({ kind: 'promote', groupId, unitIds });
            }}
          />
        </div>
      </div>
    </div>
  );
}
