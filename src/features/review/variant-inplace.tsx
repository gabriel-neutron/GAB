/**
 * **PROTOTYPE — throwaway. Variation 3 — In place.**
 *
 * No rail. The subjects run across the top as a strip, and the screen below is **the node's own
 * record**: every attribute it holds, in its own order, with a pending change drawn on the line
 * it touches. A key the machine invented is appended at the foot, marked as new.
 *
 * **What it is testing.** The other two show a list of proposals and call it a node. This one
 * shows the node. The sentence an analyst has to be able to finish is not "four things want to
 * change" but "this is the object, and three of its eleven values are contested" — and only a
 * record can carry that.
 *
 * **What it costs.** A change that is not an attribute edit — a deletion, a merge, a new link —
 * has no line to sit on, so it falls to a block underneath and breaks the idea.
 */

import { Badge } from '@/shared/ui/badge';

import {
  formatValue,
  recordRows,
  short,
  wholeRowChanges,
  type Change,
  type RecordRow,
} from './review-model';
import { useReviewPass, type LayoutProps } from './review-pass';
import {
  ChangeFlags,
  ChangeMark,
  ConfidenceBadge,
  Decide,
  DeferBox,
  DissentNote,
  EvidenceLine,
  GapLine,
  KindDot,
  KIND_COLOR,
  Quote,
  SortBar,
  UnroutedNote,
} from './review-parts';

export const NAME = 'In place — the node’s record, changes on the lines they touch';

export function VariantInPlace(props: LayoutProps) {
  const pass = useReviewPass(props);
  const { current } = pass;

  return (
    <div className="flex h-[calc(100svh-9rem)] flex-col">
      {/* The queue, across the top. A rail costs 16rem of every screen and a record is wide. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {pass.ordered.map((subject) => {
          const kind = subject.changes[0]?.kind ?? 'edit';
          const settled = pass.settledIn(subject);
          return (
            <button
              key={subject.id}
              type="button"
              aria-current={subject.id === current?.id ? 'true' : undefined}
              onClick={() => {
                pass.select(subject.id);
              }}
              className={`flex max-w-56 items-center gap-1.5 border-b-2 px-2 py-1 text-left ${
                subject.id === current?.id ? 'bg-muted' : 'border-b-transparent hover:bg-muted/50'
              }`}
              style={
                subject.id === current?.id ? { borderBottomColor: KIND_COLOR[kind] } : undefined
              }
            >
              <KindDot kind={kind} />
              <span className="truncate text-sm">{subject.label}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {settled > 0 && `${settled}/`}
                {subject.changes.length}
              </span>
            </button>
          );
        })}
        <span className="ml-auto">
          <SortBar sort={props.sort} onSort={props.onSort} />
        </span>
      </div>

      {current === null ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-2">
          <header className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-semibold">{current.label}</h1>
            <span className="flex items-baseline gap-2">
              {current.type !== null && <Badge variant="secondary">{current.type}</Badge>}
              <span className="font-mono text-xs text-muted-foreground">
                {current.entity?.id !== undefined
                  ? short(current.entity.id)
                  : current.relation !== null
                    ? short(current.relation.id)
                    : 'new'}
              </span>
            </span>
          </header>

          <table className="mt-4 w-full max-w-5xl text-sm">
            <tbody>
              {recordRows(current).map((row) => (
                <RecordLine
                  key={row.key}
                  row={row}
                  focused={row.change?.proposal.id === pass.focused?.proposal.id}
                  pass={pass}
                />
              ))}
            </tbody>
          </table>

          {wholeRowChanges(current).length > 0 && (
            <div className="mt-6 max-w-5xl space-y-3">
              <h2 className="text-xs tracking-[0.06em] text-muted-foreground uppercase">
                Against the whole row
              </h2>
              {wholeRowChanges(current).map((change) => (
                <WholeRow
                  key={change.proposal.id}
                  change={change}
                  focused={change.proposal.id === pass.focused?.proposal.id}
                  pass={pass}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One line of the record. Quiet when nothing wants it, opened when something does. */
function RecordLine({
  row,
  focused,
  pass,
}: {
  row: RecordRow;
  focused: boolean;
  pass: ReturnType<typeof useReviewPass>;
}) {
  const { change } = row;

  if (change === null) {
    return (
      <tr className="border-b border-border/60">
        <td className="w-48 py-1.5 pr-4 align-top font-mono text-xs text-muted-foreground">
          {row.key}
        </td>
        <td className="py-1.5 text-muted-foreground" colSpan={3}>
          {row.current === null ? '' : formatValue(row.current.v)}
          <span className="ml-2 font-mono text-xs">{row.current?.src.join(' ')}</span>
        </td>
      </tr>
    );
  }

  const verdict = pass.verdictOf(change);
  return (
    <>
      <tr
        onClick={() => {
          pass.focus(change.proposal.id);
        }}
        className={`${focused ? 'bg-muted/60' : ''} ${verdict !== null ? 'opacity-50' : ''}`}
        data-change-id={change.proposal.id}
        style={{ boxShadow: `inset 3px 0 0 0 ${KIND_COLOR[change.kind]}` }}
      >
        <td className="w-48 py-1.5 pr-4 pl-2.5 align-top font-mono text-xs">
          {row.key}
          {row.current === null && <span className="ml-1.5 text-muted-foreground">new</span>}
        </td>
        <td className="w-40 py-1.5 pr-3 align-top text-muted-foreground">
          {row.current === null ? (
            <span className="text-xs">absent</span>
          ) : (
            <span className="line-through decoration-muted-foreground/50">
              {formatValue(row.current.v)}
            </span>
          )}
        </td>
        <td className="py-1.5 pr-3 align-top font-medium">
          {row.proposed === null ? '' : formatValue(row.proposed.v)}
          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
            {row.proposed?.src.join(' ')}
          </span>
        </td>
        <td className="w-56 py-1 text-right align-top">
          <span className="inline-flex items-center gap-1.5">
            <ConfidenceBadge confidence={change.proposal.confidence} />
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
              onUndo={() => {
                pass.undo(change.proposal.id);
              }}
              compact
            />
          </span>
        </td>
      </tr>
      <tr
        className={`border-b border-border ${focused ? 'bg-muted/60' : ''} ${
          verdict !== null ? 'opacity-50' : ''
        }`}
      >
        <td />
        <td colSpan={3} className="pb-2">
          <Evidence change={change} pass={pass} />
        </td>
      </tr>
    </>
  );
}

/** A change with no line to sit on: a deletion, a merge, a new link. */
function WholeRow({
  change,
  focused,
  pass,
}: {
  change: Change;
  focused: boolean;
  pass: ReturnType<typeof useReviewPass>;
}) {
  const verdict = pass.verdictOf(change);
  return (
    <section
      onClick={() => {
        pass.focus(change.proposal.id);
      }}
      className={`border-l-[3px] py-2 pr-2 pl-3 ${focused ? 'bg-muted/60' : ''} ${
        verdict !== null ? 'opacity-50' : ''
      }`}
      data-change-id={change.proposal.id}
      style={{ borderLeftColor: KIND_COLOR[change.kind] }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ChangeMark kind={change.kind} />
        <ConfidenceBadge confidence={change.proposal.confidence} />
        <ChangeFlags change={change} />
        <span className="ml-auto">
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
            onUndo={() => {
              pass.undo(change.proposal.id);
            }}
          />
        </span>
      </div>
      {change.summary !== '' && <p className="mt-1.5 text-sm">{change.summary}</p>}
      <div className="mt-1.5">
        <Evidence change={change} pass={pass} />
      </div>
    </section>
  );
}

function Evidence({ change, pass }: { change: Change; pass: ReturnType<typeof useReviewPass> }) {
  return (
    <div className="space-y-1">
      <Quote spans={change.spans} />
      {/* `WholeRow` prints the flags in its own header; a record line does not, so the evidence
          line carries them there. They printed twice until 11 August 2026. */}
      <EvidenceLine change={change} flags={change.changes.length > 0} />
      <DissentNote change={change} />
      {change.unrouted && <UnroutedNote />}
      {change.gaps.map((gap) => (
        <GapLine key={gap}>{gap}</GapLine>
      ))}
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
  );
}
