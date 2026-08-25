import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import type { SourceCardModel } from './dossier';

export interface SourceCardProps {
  readonly source: SourceCardModel;
}

const LINK = 'min-w-0 truncate text-primary underline underline-offset-2';

const NAME = 'w-16 shrink-0 truncate text-label';

export function SourceCard({ source }: SourceCardProps) {
  const [open, setOpen] = useState<boolean>(false);
  const panelId = useId();

  const scoreWords =
    source.scoreOrigin === '' ? source.score : `${source.score}, ${source.scoreOrigin}`;

  return (
    <article
      aria-label={`Source ${source.number} — ${source.title}`}
      data-source={source.id}
      className="rounded-none border-b border-border px-2 py-1.5"
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-small/4 tabular-nums text-label">
          {source.number}
        </span>
        {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
        <span className="min-w-0 flex-1 truncate text-xs" title={source.title}>
          {source.title}
        </span>
        <span
          className="max-w-40 shrink-0 truncate font-mono text-small/4 text-label"
          title={scoreWords}
        >
          {scoreWords}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2 text-small/4">
        {source.uri === null ? (
          <span className="min-w-0 flex-1 truncate text-label">No address recorded</span>
        ) : (
          <a
            href={source.uri}
            title={source.uri}
            aria-label={`Open the original document at ${source.uri}`}
            className={cn(LINK, 'flex-1')}
          >
            {source.uriShort ?? source.uri}
          </a>
        )}
        <span className="shrink-0 font-mono tabular-nums text-label">
          {source.retrievedAt ?? 'No date of retrieval'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
          // `transition-colors` with no duration runs at the Tailwind default of 150 ms. A state
          // change here lasts under 120 ms, so the duration is stated.
          className="shrink-0 rounded-none px-1 text-small/4 transition-colors duration-100"
        >
          {`Claims (${source.holdsUp.length})`}
        </Button>
      </div>

      {source.missing ? (
        <p className="mt-1 text-small/4 text-dissent">
          This document is cited and it has no row in the record.
        </p>
      ) : null}

      {open ? (
        <div id={panelId} className="mt-1 space-y-1 text-small/4">
          <div>
            <p className={cn(NAME, 'w-auto')}>
              {`Claims this document holds up (${source.holdsUp.length})`}
            </p>
            {source.holdsUp.length === 0 ? (
              <p>This document holds up no claim on this page.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {source.holdsUp.map((claim) => (
                  <li key={claim.key} className="flex gap-2">
                    <span className={cn(NAME)} title={claim.label}>
                      {claim.label}
                    </span>
                    <span className="min-w-0 truncate" title={claim.text}>
                      {claim.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
