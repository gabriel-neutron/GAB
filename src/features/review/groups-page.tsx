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
    case 'private':
      return view.groupId;
    case 'held':
      return view.group.id;
  }
};

/** The groups of the queue in two columns: the rail of the groups, and one group with its group
 * action. Each column scrolls on its own. */
export function GroupsPage({ rail, group, words, onAct }: GroupsPageProps) {
  return (
    <div
      data-groups-page
      className="grid h-full min-h-0 grid-cols-[clamp(16rem,30%,24rem)_minmax(0,1fr)] overflow-hidden"
    >
      <div className="flex min-h-0 flex-col border-r border-border">
        {rail.state === 'private' ? (
          <p className="p-3 text-xs text-label">{rail.why}</p>
        ) : (
          <GroupRail
            groups={rail.read}
            selectedId={selectedOf(group)}
            onSelect={(groupId) => {
              onAct({ kind: 'select', groupId });
            }}
          />
        )}
      </div>
      <div className="flex min-h-0 flex-col">
        <GroupPanel
          // A new group starts with no confirmation open.
          key={selectedOf(group) ?? ''}
          view={group}
          words={words}
          onPromote={(groupId, unitIds) => {
            onAct({ kind: 'promote', groupId, unitIds });
          }}
        />
      </div>
    </div>
  );
}
