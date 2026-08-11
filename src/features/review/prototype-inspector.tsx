/**
 * **PROTOTYPE — throwaway. The Inspector.**
 *
 * Three layouts were built and compared on 11 August 2026 — a ledger of aligned rows, this one,
 * and the node read as its own record. The operator chose this one and the other two are
 * deleted, so this is the review surface.
 *
 * Three panes: the queue, then the node's changes as one line each, then the whole evidence for
 * the one change under the cursor.
 *
 * **Why it won.** The decision controls never move. In the layouts it replaced they appeared
 * once per change, each at the end of a different amount of text, so the hand went somewhere new
 * every time. Here one change is open, its evidence fills a pane, and the controls sit at the
 * foot of that pane whatever the change is.
 *
 * **What it costs, and it is not fixed.** Two changes on one node cannot be read side by side —
 * and comparing them is why the node was made the unit in the first place. When two agents
 * contradict each other on one node, this layout shows them one at a time.
 */

import { Badge } from '@/shared/ui/badge';

import { formatValue, short, type Subject } from './prototype-model';
import { useReviewPass, type LayoutProps } from './prototype-pass';
import {
  ChangeFlags,
  ChangeMark,
  ChangeTable,
  ConfidenceBadge,
  Decide,
  DeferBox,
  DissentNote,
  EvidenceLine,
  GapLine,
  KindDot,
  KIND_COLOR,
  QueueRail,
  Quote,
  SortBar,
  UnroutedNote,
} from './prototype-parts';

export function ReviewInspector(props: LayoutProps) {
  const pass = useReviewPass(props);
  const { current, focused } = pass;

  return (
    <div className="grid h-[calc(100svh-9rem)] grid-cols-[14rem_20rem_1fr] gap-5">
      <nav className="flex min-h-0 flex-col">
        <div className="mb-2">
          <SortBar sort={props.sort} onSort={props.onSort} />
        </div>
        <QueueRail
          subjects={pass.ordered}
          currentId={current?.id ?? null}
          settledIn={pass.settledIn}
          onSelect={pass.select}
        />
      </nav>

      {current === null ? null : (
        <>
          {/* The node, and its changes as one line each. */}
          <div className="flex min-h-0 flex-col border-x border-border px-4">
            <Head subject={current} />
            <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {current.changes.map((change) => {
                const verdict = pass.verdictOf(change);
                return (
                  <li key={change.proposal.id}>
                    <button
                      type="button"
                      data-change-id={change.proposal.id}
                      aria-current={
                        change.proposal.id === focused?.proposal.id ? 'true' : undefined
                      }
                      onClick={() => {
                        pass.focus(change.proposal.id);
                      }}
                      className={`flex w-full items-center gap-2 border-l-[3px] py-1.5 pr-2 pl-2 text-left ${
                        change.proposal.id === focused?.proposal.id
                          ? 'bg-muted'
                          : 'hover:bg-muted/50'
                      } ${verdict !== null ? 'opacity-50' : ''}`}
                      style={{ borderLeftColor: KIND_COLOR[change.kind] }}
                    >
                      <KindDot kind={change.kind} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {change.changes.length > 0
                          ? change.changes.map((a) => a.key).join(', ')
                          : change.summary}
                      </span>
                      {verdict === null ? (
                        <ConfidenceBadge confidence={change.proposal.confidence} />
                      ) : (
                        <Badge variant="outline">{verdict}</Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* The evidence for the one change under the cursor. */}
          {focused === null ? null : (
            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <ChangeMark kind={focused.kind} />
                <ConfidenceBadge confidence={focused.proposal.confidence} />
                <ChangeFlags change={focused} />
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                {focused.summary !== '' && <p className="text-sm">{focused.summary}</p>}
                <ChangeTable changes={focused.changes} />
                <Quote spans={focused.spans} />
                {/* The header above already prints the flags. */}
                <EvidenceLine change={focused} flags={false} />
                <DissentNote change={focused} />
                {focused.unrouted && <UnroutedNote />}
                {focused.gaps.map((gap) => (
                  <GapLine key={gap}>{gap}</GapLine>
                ))}
              </div>

              <footer className="mt-3 border-t border-border pt-3">
                {pass.deferring === focused.proposal.id ? (
                  <DeferBox
                    onHold={(reason) => {
                      pass.decide(focused, 'deferred', reason);
                    }}
                    onCancel={() => {
                      pass.setDeferring(null);
                    }}
                  />
                ) : (
                  <div className="flex justify-end">
                    <Decide
                      verdict={pass.verdictOf(focused)}
                      onAccept={() => {
                        pass.decide(focused, 'accepted');
                      }}
                      onReject={() => {
                        pass.decide(focused, 'rejected');
                      }}
                      onDefer={() => {
                        pass.setDeferring(focused.proposal.id);
                      }}
                      onUndo={() => {
                        pass.undo(focused.proposal.id);
                      }}
                    />
                  </div>
                )}
              </footer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Head({ subject }: { subject: Subject }) {
  const standing = subject.entity ?? subject.relation;
  return (
    <header>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-base font-semibold">{subject.label}</h1>
        {subject.type !== null && <Badge variant="secondary">{subject.type}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {standing === null ? 'does not exist yet' : short(standing.id)} · {subject.changes.length}{' '}
        waiting
      </p>
      {standing !== null && Object.keys(standing.attrs).length > 0 && (
        <dl className="mt-2 space-y-0.5 text-xs">
          {Object.entries(standing.attrs).map(([key, attr]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-32 shrink-0 truncate font-mono text-muted-foreground">{key}</dt>
              <dd className="truncate">{formatValue(attr.v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
