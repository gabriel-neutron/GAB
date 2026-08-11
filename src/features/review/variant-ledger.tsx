/**
 * **PROTOTYPE — throwaway. Variation 1 — Ledger.**
 *
 * The node's changes as one aligned table. Every value sits in a column that every other value
 * shares, so the eye runs down `now` against `proposed` and never hunts.
 *
 * **What it is testing.** The previous draft was a stack of loose blocks: each change set its own
 * width, so the page was ragged and the two values being compared never lined up. A table is the
 * oldest fix for that, and it is the densest thing an operator can read.
 *
 * **What it costs.** The quotation does not fit in a cell. It sits under the row, indented, which
 * breaks the grid it just bought.
 */

import { Badge } from '@/shared/ui/badge';

import { formatValue, short, type Change, type Subject } from './review-model';
import { useReviewPass, type LayoutProps } from './review-pass';
import {
  ChangeFlags,
  ConfidenceBadge,
  Decide,
  DeferBox,
  GapLine,
  KindDot,
  KIND_COLOR,
  QueueRail,
  SortBar,
  SourceLine,
  UnroutedNote,
} from './review-parts';

export const NAME = 'Ledger — the node’s changes as one aligned table';

export function VariantLedger(props: LayoutProps) {
  const pass = useReviewPass(props);
  const { current } = pass;

  return (
    <div className="grid h-[calc(100svh-9rem)] grid-cols-[16rem_1fr] gap-6">
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
        <div className="flex min-h-0 flex-col">
          <Head subject={current} />
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="w-6" />
                  <th className="py-1 pr-3 text-left font-medium">Attribute</th>
                  <th className="py-1 pr-3 text-left font-medium">Now</th>
                  <th className="py-1 pr-3 text-left font-medium">Proposed</th>
                  <th className="py-1 pr-3 text-left font-medium">Source</th>
                  <th className="py-1 pr-3 text-right font-medium">Conf.</th>
                  <th className="py-1 text-right font-medium">Decide</th>
                </tr>
              </thead>
              <tbody>
                {current.changes.map((change) => (
                  <Rows
                    key={change.proposal.id}
                    change={change}
                    focused={change.proposal.id === pass.focused?.proposal.id}
                    pass={pass}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Head({ subject }: { subject: Subject }) {
  const standing = subject.entity ?? subject.relation;
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
      <div>
        <h1 className="text-xl font-semibold">{subject.label}</h1>
        <p className="text-xs text-muted-foreground">
          {standing === null ? 'does not exist yet' : short(standing.id)} ·{' '}
          {subject.changes.length} waiting
        </p>
      </div>
      {subject.type !== null && <Badge variant="secondary">{subject.type}</Badge>}
    </header>
  );
}

/**
 * One change is one row, plus a second row for the evidence. A change that edits two attributes
 * produces two value rows and one evidence row: the decision belongs to the proposal, so the
 * buttons sit on the first of them and span the rest.
 */
function Rows({
  change,
  focused,
  pass,
}: {
  change: Change;
  focused: boolean;
  pass: ReturnType<typeof useReviewPass>;
}) {
  const verdict = pass.verdictOf(change);
  const tint = focused ? 'bg-muted/60' : '';
  const settled = verdict !== null ? 'opacity-50' : '';
  const rows = change.changes.length === 0 ? 1 : change.changes.length;

  return (
    <>
      {change.changes.length === 0 ? (
        <tr
          className={`border-l-[3px] ${tint} ${settled}`}
          style={{ borderLeftColor: KIND_COLOR[change.kind] }}
          onClick={() => {
            pass.focus(change.proposal.id);
          }}
        >
          <td className="pl-1.5">
            <KindDot kind={change.kind} />
          </td>
          <td colSpan={3} className="py-1.5 pr-3">
            {change.summary}
          </td>
          <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">
            {change.sources.map((s) => s.id).join(' ')}
          </td>
          <td className="py-1.5 pr-3 text-right">
            <ConfidenceBadge confidence={change.proposal.confidence} />
          </td>
          <td className="py-1.5 text-right">
            <Decide
              verdict={verdict}
              onAccept={() => {
                pass.decide(change, 'accepted');
              }}
              onReject={() => {
                pass.decide(change, 'rejected');
              }}
              onDefer={() => {
                pass.setDeferring(change.proposal.id);
              }}
              compact
            />
          </td>
        </tr>
      ) : (
        change.changes.map((attr, index) => (
          <tr
            key={attr.key}
            className={`border-l-[3px] ${tint} ${settled}`}
            style={{ borderLeftColor: KIND_COLOR[change.kind] }}
            onClick={() => {
              pass.focus(change.proposal.id);
            }}
          >
            {index === 0 && (
              <td className="pl-1.5 align-top" rowSpan={rows}>
                <KindDot kind={change.kind} />
              </td>
            )}
            <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">{attr.key}</td>
            <td className="py-1.5 pr-3 text-muted-foreground">
              {attr.before === null ? (
                <span className="text-xs">absent</span>
              ) : (
                <span className="line-through decoration-muted-foreground/50">
                  {formatValue(attr.before.v)}
                </span>
              )}
            </td>
            <td className="py-1.5 pr-3 font-medium">{formatValue(attr.after.v)}</td>
            <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">
              {attr.after.src.join(' ')}
            </td>
            {index === 0 && (
              <>
                <td className="py-1.5 pr-3 text-right align-top" rowSpan={rows}>
                  <ConfidenceBadge confidence={change.proposal.confidence} />
                </td>
                <td className="py-1.5 text-right align-top" rowSpan={rows}>
                  <Decide
                    verdict={verdict}
                    onAccept={() => {
                      pass.decide(change, 'accepted');
                    }}
                    onReject={() => {
                      pass.decide(change, 'rejected');
                    }}
                    onDefer={() => {
                      pass.setDeferring(change.proposal.id);
                    }}
                    compact
                  />
                </td>
              </>
            )}
          </tr>
        ))
      )}

      <tr className={`border-b border-border ${tint} ${settled}`}>
        <td />
        <td colSpan={6} className="pb-2 pl-0">
          <div className="space-y-1">
            {change.spans.map((span) => (
              <p key={span.text.slice(0, 16)} className="border-l-2 border-border pl-2.5 text-sm">
                {span.text}
              </p>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {change.sources.map((source) => (
                <SourceLine key={source.id} source={source} />
              ))}
              <ChangeFlags change={change} />
            </div>
            {change.unrouted && <UnroutedNote />}
            {change.gaps.map((gap) => (
              <GapLine key={gap}>{gap}</GapLine>
            ))}
            <GapLine>
              {change.authorLabel} · {change.ageDays} days ago
            </GapLine>
            {pass.deferring === change.proposal.id && (
              <DeferBox
                onHold={(reason) => {
                  pass.decide(change, 'deferred', reason);
                }}
                onCancel={() => {
                  pass.setDeferring(null);
                }}
              />
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
