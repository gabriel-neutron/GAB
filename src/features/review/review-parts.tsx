/**
 * **PROTOTYPE — throwaway.** The small pieces the two layouts share.
 *
 * Each layout arranges these for itself. Nothing here is a layout, because the layout is the
 * question the prototype asks.
 *
 * The rule the operator set on 11 August 2026: **show the change, not the machinery.** No
 * number is printed where a mark will do, and every statement about a hole in the model is one
 * muted line, never a box.
 */

import type { ReactNode } from 'react';
import { ExternalLink, GitMerge, Link2, Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import type { Attribute } from '@/shared/fixtures/types';

import {
  CHANGE_LABEL,
  formatValue,
  isLowConfidence,
  THRESHOLD_MARK,
  type AttrChange,
  type ChangeKind,
  type CitedSpan,
  type ResolvedSource,
  type ReviewRow,
} from './review-model';

const KIND_ICON: Readonly<Record<ChangeKind, typeof Plus>> = {
  'new-node': Plus,
  'new-link': Link2,
  edit: Pencil,
  delete: Trash2,
  merge: GitMerge,
};

/** A 2px rule down the left of a row or a card. The kind is legible before anything is read. */
export const KIND_ACCENT: Readonly<Record<ChangeKind, string>> = {
  'new-node': 'border-l-primary',
  'new-link': 'border-l-primary',
  edit: 'border-l-muted-foreground/40',
  delete: 'border-l-destructive',
  merge: 'border-l-foreground/50',
};

/**
 * What the proposal does to the graph. A new node, a new link, an edit and a deletion are four
 * different risks, and this is the first thing on every card and every row.
 */
export function ChangeMark({ kind }: { kind: ChangeKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <Icon className="size-3.5 shrink-0" />
      {CHANGE_LABEL[kind]}
    </span>
  );
}

/**
 * Confidence, drawn and never written. The notch is the threshold, so the analyst sees where
 * the row falls without reading a figure it cannot act on.
 */
export function ConfidenceBar({
  confidence,
  wide = false,
}: {
  confidence: number;
  wide?: boolean;
}) {
  const low = confidence < THRESHOLD_MARK;
  return (
    <span
      role="img"
      aria-label={low ? 'confidence below the threshold' : 'confidence above the threshold'}
      className={`relative block h-1 shrink-0 rounded-full bg-muted ${wide ? 'w-40' : 'w-12'}`}
    >
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${low ? 'bg-destructive' : 'bg-foreground/70'}`}
        style={{ width: `${(confidence * 100).toString()}%` }}
      />
      <span
        className="absolute -top-0.5 h-2 w-px bg-foreground/50"
        style={{ left: `${(THRESHOLD_MARK * 100).toString()}%` }}
      />
    </span>
  );
}

/** Why the row is in review. It replaces the confidence figure, and it is the same fact. */
export function ReasonBadge({ row }: { row: ReviewRow }) {
  if (row.bucket === 'unrouted') return <Badge variant="outline">not routed</Badge>;
  if (row.proposal.dissent && isLowConfidence(row.proposal)) {
    return <Badge variant="destructive">dissent · low</Badge>;
  }
  if (row.proposal.dissent) return <Badge variant="destructive">dissent</Badge>;
  return <Badge variant="secondary">low confidence</Badge>;
}

/** Where a source is cited, and what a reader is given instead of the file. #31. */
export function SourceLine({ source }: { source: ResolvedSource }) {
  const { id, doc } = source;
  if (doc === null) {
    return <li className="text-xs text-destructive">{id} — cited, and in no document row (#15)</li>;
  }
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="text-foreground">{doc.title}</span>
      {doc.admiralty === null ? (
        <span className="text-destructive">unrated</span>
      ) : (
        <span className="text-muted-foreground">{doc.admiralty}</span>
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
    </li>
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
    <div className="space-y-2">
      {spans.map((span) => (
        <blockquote
          key={`${span.docId}-${span.text.slice(0, 16)}`}
          className="border-l-2 border-border pl-3 text-sm"
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
export function DissentNote({ row }: { row: ReviewRow }) {
  if (!row.proposal.dissent) return null;
  return (
    <p className="text-sm text-destructive">
      The agents disagreed, and the sample records nothing but the flag — not who objected, not what
      it proposed instead. <span className="text-muted-foreground">#44</span>
    </p>
  );
}

/** The target as it stands today, against the change proposed. This is the card. */
export function ChangeTable({ changes }: { changes: readonly AttrChange[] }) {
  if (changes.length === 0) return null;
  return (
    <table className="w-full text-sm">
      <tbody>
        {changes.map((change) => (
          <tr key={change.key} className="border-b border-border last:border-0">
            <td className="w-36 py-1.5 pr-3 align-top font-mono text-xs text-muted-foreground">
              {change.key}
            </td>
            <td className="w-24 py-1.5 pr-3 align-top text-muted-foreground line-through decoration-muted-foreground/50">
              {change.before === null ? '' : formatValue(change.before.v)}
            </td>
            <td className="py-1.5 align-top">
              <AttrCell attr={change.after} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttrCell({ attr }: { attr: Attribute }) {
  return (
    <>
      <span>{formatValue(attr.v)}</span>
      <span className="ml-2 font-mono text-xs text-muted-foreground">{attr.src.join(' ')}</span>
    </>
  );
}

/** A hole in the model, stated in one muted line and never in a box. */
export function GapLine({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/**
 * The #42 group. It states the conflict and takes no side: the controls stay live, and nothing
 * on the screen calls the row safe or blocked.
 */
export function UnroutedNote() {
  return (
    <p className="border-l-2 border-dashed border-foreground/40 pl-3 text-sm text-muted-foreground">
      S3 does not send this row to review, and P1 lets nothing through without a promotion. The two
      cannot both hold, so the screen applies no default —{' '}
      <strong className="font-medium">#42</strong>.
    </p>
  );
}

/** One line of provenance. The full record belongs to the detail surface, not to a decision. */
export function MetaLine({ row }: { row: ReviewRow }) {
  return (
    <p className="text-xs text-muted-foreground">
      {row.agentLabel ?? 'the operator'} · {row.ageDays} days ago
      {row.proposal.authorRole === 'gabriel_app' && ' · written by hand'}
    </p>
  );
}
