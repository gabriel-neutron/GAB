import type { ReactNode } from 'react';

import type { PendingLine, SourceRef } from './dossier';
import { Tag } from './tag';

export interface PendingProps {
  readonly proposals: readonly PendingLine[];
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

const CANDIDATE = 'candidate';

export function Pending({ proposals, mark }: PendingProps) {
  if (proposals.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        0 pending proposals. No proposal of the record names this entity, and none was dropped.
      </p>
    );
  }

  return (
    <ul>
      {proposals.map((proposal) => (
        <li
          key={proposal.id}
          data-proposal={proposal.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-divider py-2 last:border-b-0"
        >
          <Tag kind="candidate">{CANDIDATE}</Tag>
          <span className="min-w-0 flex-1 basis-48 text-body-sm break-words">
            {proposal.summary}
          </span>
          <span className="shrink-0 text-body-sm text-muted-foreground">{proposal.origin}</span>
          {proposal.dissent ? (
            <Tag kind="dissent">disputed</Tag>
          ) : (
            <Tag kind="default">not disputed</Tag>
          )}
          {mark(proposal.sources)}
        </li>
      ))}
    </ul>
  );
}
