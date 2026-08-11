/**
 * **PROTOTYPE — throwaway.** The pieces the queue and the page share.
 *
 * **The colour.** The operator asked that an addition, a modification and a deletion be told
 * apart by colour. The three values below are taken from `src/theme.css`, the visual language
 * chosen on #39, and not invented here:
 *
 * | Change | Token in `theme.css` | Reason |
 * |---|---|---|
 * | Addition | `--candidate`, amber | New machine material entering the graph is the candidate layer at its most literal. |
 * | Deletion | `--dissent`, red | "An action that destroys data means stop and look." |
 * | Modification | grey | Rule 8: the normal state is grey, and a sourced edit is the common case. The eye goes to the two rarer acts. |
 * | Merge | red, hollow | It removes rows, so it is the destructive family — but M12 makes it the one reversible act, so it is quieter than a deletion. |
 *
 * `theme.css` is written and **not imported**, so the tokens do not exist at runtime. The values
 * are therefore inlined here, in one place, with `light-dark()` so both themes hold. They are
 * deleted with the prototype. Nothing outside `features/review/` is touched.
 */

import { useState, type ReactNode } from 'react';
import { Check, Clock, ExternalLink, GitMerge, Minus, Pencil, Plus, X } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import type { Attribute } from '@/shared/fixtures/types';

import {
  CHANGE_LABEL,
  formatValue,
  SORT_KEYS,
  SORT_LABEL,
  THRESHOLD,
  type AttrChange,
  type Change,
  type ChangeKind,
  type CitedSpan,
  type LocalVerdict,
  type ResolvedSource,
  type SortKey,
  type Subject,
} from './review-model';

/** Taken from `src/theme.css`. Light value first, dark value second. */
export const KIND_COLOR: Readonly<Record<ChangeKind, string>> = {
  add: 'light-dark(oklch(0.52 0.13 90), oklch(0.82 0.13 82))',
  edit: 'light-dark(oklch(0.5 0.01 230), oklch(0.63 0.008 215))',
  delete: 'light-dark(oklch(0.48 0.18 28), oklch(0.7 0.17 28))',
  merge: 'light-dark(oklch(0.48 0.18 28), oklch(0.7 0.17 28))',
};

const KIND_ICON: Readonly<Record<ChangeKind, typeof Plus>> = {
  add: Plus,
  edit: Pencil,
  delete: Minus,
  merge: GitMerge,
};

/**
 * What the change does to the graph, in colour and in words. Never the icon alone (rule 20).
 *
 * It is a filled chip and not coloured text: at 12px the theme's light-mode hues are dark and
 * low in chroma by design, and a word in colour reads as a word. The colour needs surface.
 */
export function ChangeMark({ kind }: { kind: ChangeKind }) {
  const Icon = KIND_ICON[kind];
  const color = KIND_COLOR[kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <Icon className="size-3.5 shrink-0" />
      {CHANGE_LABEL[kind]}
    </span>
  );
}

/**
 * Confidence, as a badge carrying the figure. The operator refused the bar on 11 August 2026.
 * It is monospace and tabular, per rules 12 and 13 of the theme.
 */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const low = confidence < THRESHOLD;
  return (
    <Badge
      variant={low ? 'destructive' : 'outline'}
      className="font-mono tabular-nums"
      title={low ? 'below the threshold in force' : 'above the threshold in force'}
    >
      {confidence.toFixed(2)}
    </Badge>
  );
}

/**
 * The flags that used to be group headings. The operator asked for one undivided queue, so a
 * change carries its own state instead of living in a bucket.
 */
export function ChangeFlags({ change }: { change: Change }) {
  return (
    <>
      {change.proposal.dissent && <Badge variant="destructive">dissent</Badge>}
      {change.unrouted && <Badge variant="outline">not routed</Badge>}
    </>
  );
}

/** Where a source is cited, and what a reader is given instead of the file. #31. */
export function SourceLine({ source }: { source: ResolvedSource }) {
  const { id, doc } = source;
  if (doc === null) {
    return <span className="text-xs text-destructive">{id} — in no document row (#15)</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 text-xs">
      <span>{doc.title}</span>
      {doc.admiralty === null ? (
        <span className="text-destructive">unrated</span>
      ) : (
        <span className="font-mono text-muted-foreground">{doc.admiralty}</span>
      )}
      {doc.uri !== null && (
        <a
          className="inline-flex items-center gap-0.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={doc.uri}
          target="_blank"
          rel="noreferrer"
        >
          source <ExternalLink className="size-2.5" />
        </a>
      )}
      {doc.archiveUri !== null && (
        <a
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={doc.archiveUri}
          target="_blank"
          rel="noreferrer"
        >
          archive
        </a>
      )}
    </span>
  );
}

/**
 * The cited text. When there is none, one muted line says so and the screen does not fall back
 * to an identifier and call it a citation.
 */
export function Quote({ spans }: { spans: readonly CitedSpan[] }) {
  if (spans.length === 0) {
    return <GapLine>No quoted text. A proposal cites a document, never an extent — #44.</GapLine>;
  }
  return (
    <div className="space-y-1">
      {spans.map((span) => (
        <blockquote
          key={`${span.docId}-${span.text.slice(0, 16)}`}
          className="border-l-2 border-border pl-2.5 text-sm"
        >
          {span.text}
        </blockquote>
      ))}
    </div>
  );
}

/**
 * The disagreement. `Proposal` carries `dissent: boolean` and nothing else, and `AgentCall`
 * records the input and not the output, so a dissent card has a flag and no argument to weigh.
 * The space stays, and it states what is missing — #44.
 */
export function DissentNote({ change }: { change: Change }) {
  if (!change.proposal.dissent) return null;
  return (
    <p className="text-xs text-destructive">
      The agents disagreed. The sample records the flag and nothing else — not who objected, not
      what it proposed instead. <span className="text-muted-foreground">#44</span>
    </p>
  );
}

/** The difference: the value as it stands, and the value proposed. */
export function ChangeTable({ changes }: { changes: readonly AttrChange[] }) {
  if (changes.length === 0) return null;
  return (
    <table className="text-sm">
      <tbody>
        {changes.map((change) => (
          <tr key={change.key}>
            <td className="py-0.5 pr-4 align-top font-mono text-xs text-muted-foreground">
              {change.key}
            </td>
            {change.before !== null && (
              <td className="py-0.5 pr-3 align-top text-muted-foreground line-through decoration-muted-foreground/50">
                {formatValue(change.before.v)}
              </td>
            )}
            <td className="py-0.5 align-top">
              <AttrCell attr={change.after} isNew={change.before === null} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttrCell({ attr, isNew }: { attr: Attribute; isNew: boolean }) {
  return (
    <>
      <span>{formatValue(attr.v)}</span>
      {isNew && <span className="ml-2 text-xs text-muted-foreground">(new key)</span>}
      <span className="ml-2 font-mono text-xs text-muted-foreground">{attr.src.join(' ')}</span>
    </>
  );
}

/** A hole in the model, stated in one muted line and never in a box. */
export function GapLine({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/**
 * The #42 note. It states the conflict and takes no side: the controls stay live, and nothing
 * on the screen calls the change safe or blocked.
 */
export function UnroutedNote() {
  return (
    <p className="text-xs text-muted-foreground">
      S3 does not send this change to review, and P1 lets nothing through without a promotion. The
      two cannot both hold, so the screen applies no default —{' '}
      <strong className="font-medium">#42</strong>.
    </p>
  );
}

/**
 * The two acts, and the third that is neither. Every variation uses the same three, in the same
 * order and with the same words, so that the comparison is about the layout and not the labels.
 */
export function Decide({
  verdict,
  onAccept,
  onReject,
  onDefer,
  compact = false,
}: {
  verdict: LocalVerdict | null;
  onAccept: () => void;
  onReject: () => void;
  onDefer: () => void;
  compact?: boolean;
}) {
  if (verdict !== null) return <Badge variant="outline">{verdict}</Badge>;
  const size = compact ? 'icon-sm' : 'sm';
  return (
    <span className="inline-flex items-center gap-1">
      <Button variant="ghost" size={size} onClick={onDefer} title="Defer (D)">
        <Clock />
        {!compact && 'Defer'}
      </Button>
      <Button variant="destructive" size={size} onClick={onReject} title="Reject (R)">
        <X />
        {!compact && 'Reject'}
      </Button>
      <Button size={size} onClick={onAccept} title="Promote (A)">
        <Check />
        {!compact && 'Promote'}
      </Button>
    </span>
  );
}

/** The box that asks why a change cannot be decided yet. */
export function DeferBox({ onHold, onCancel }: { onHold: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        autoFocus
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
        }}
        placeholder="Why not yet?"
        className="h-8 flex-1 border border-border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        size="sm"
        onClick={() => {
          onHold(reason === '' ? 'no reason given' : reason);
        }}
      >
        Hold
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/** The order of the queue. ADR 0004 §7 names sort order as workspace, so the host persists it. */
export function SortBar({ sort, onSort }: { sort: SortKey; onSort: (next: SortKey) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">sort</span>
      {SORT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === sort}
          onClick={() => {
            onSort(key);
          }}
          className={`px-1.5 py-0.5 ${
            key === sort ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          {SORT_LABEL[key]}
        </button>
      ))}
    </div>
  );
}

/**
 * The queue, as a rail. Two of the three variations use it; the third drops it, which is the
 * point of the third.
 */
export function QueueRail({
  subjects,
  currentId,
  settledIn,
  onSelect,
}: {
  subjects: readonly Subject[];
  currentId: string | null;
  settledIn: (subject: Subject) => number;
  onSelect: (subjectId: string) => void;
}) {
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {subjects.map((subject) => {
        const kind = subject.changes[0]?.kind ?? 'edit';
        const settled = settledIn(subject);
        return (
          <li key={subject.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(subject.id);
              }}
              aria-current={subject.id === currentId ? 'true' : undefined}
              className={`flex w-full items-center gap-2 border-l-[3px] py-1.5 pr-2 pl-2.5 text-left ${
                subject.id === currentId ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              style={{ borderLeftColor: KIND_COLOR[kind] }}
            >
              <KindDot kind={kind} />
              <span className="min-w-0 flex-1 truncate text-sm">{subject.label}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {settled > 0 && `${settled}/`}
                {subject.changes.length}
              </span>
            </button>
          </li>
        );
      })}
      {subjects.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nothing waits.</li>}
    </ul>
  );
}

/** The kind, at the size of a bullet. A rail row is one line, so the chip does not fit. */
export function KindDot({ kind }: { kind: ChangeKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <Icon className="size-3.5 shrink-0" style={{ color: KIND_COLOR[kind] }} aria-label={CHANGE_LABEL[kind]} />
  );
}
