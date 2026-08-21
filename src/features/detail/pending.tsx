import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { PendingLine, SourceRef } from './dossier';

export interface PendingProps {
  readonly proposals: readonly PendingLine[];
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

const CANDIDATE = 'candidate';

export function Pending({ proposals, mark }: PendingProps) {
  return (
    <section aria-label="Pending proposals">
      <h2 className="flex items-baseline gap-2 pb-1">
        <span className="text-[11px]/4 tracking-[0.06em] text-label uppercase">
          Pending proposals
        </span>
        <span className="font-mono text-[11px]/4 tabular-nums text-label">{proposals.length}</span>
      </h2>
      {proposals.length === 0 ? (
        <p className="text-xs text-label">
          0 pending proposals. No proposal of the record names this entity, and none was dropped.
        </p>
      ) : (
        <ul>
          {proposals.map((proposal) => (
            <li
              key={proposal.id}
              data-proposal={proposal.id}
              className="flex items-center gap-2 border-b border-dashed border-border py-1"
            >
              <span className="shrink-0 text-[11px]/4 text-candidate">{CANDIDATE}</span>
              {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
              <span className="min-w-0 flex-1 truncate text-xs" title={proposal.summary}>
                {proposal.summary}
              </span>
              <span
                className={cn(
                  'shrink-0 text-[11px]/4',
                  proposal.dissent ? 'text-dissent' : 'text-label',
                )}
              >
                {proposal.dissent ? 'dissent' : 'no dissent'}
              </span>
              <span className="sr-only">confidence</span>
              <span className="shrink-0 font-mono text-[11px]/4 tabular-nums text-label">
                {proposal.confidence}
              </span>
              {mark(proposal.sources)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
