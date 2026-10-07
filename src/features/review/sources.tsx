import { ExternalLink, FileText, FileX } from 'lucide-react';

import { SourceMark } from '@/shared/source-mark';

import type { CitedDocument } from './queue';

export interface SourceBadgeProps {
  readonly source: CitedDocument;
}

/** One cited document, one press away. A document the record does not hold takes its own mark
 * and hue, so the hue alone never tells it apart. */
export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <SourceMark
      name={source.name}
      className={source.missing ? 'border-dissent text-dissent' : undefined}
      label={
        source.missing ? (
          <FileX size={14} aria-hidden="true" />
        ) : (
          <FileText size={14} aria-hidden="true" />
        )
      }
    >
      <span data-source={source.id} className="block space-y-1">
        <span className="block text-xs">{source.title}</span>
        {source.missing ? (
          <span className="block text-small/4 text-dissent">
            This document is cited, and the record holds no row for it.
          </span>
        ) : null}
        {source.address === null ? (
          <span className="block text-small/4 text-label">
            No address. The copy taken at ingest is not served to this screen.
          </span>
        ) : (
          <a
            href={source.address.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-baseline gap-1 text-small/4 text-primary underline underline-offset-2"
          >
            {source.address.kind === 'ingest-copy'
              ? 'Open the copy taken at ingest'
              : 'Open the original address. It can have changed since ingest.'}
            <ExternalLink size={14} aria-hidden="true" className="shrink-0 self-center" />
          </a>
        )}
      </span>
    </SourceMark>
  );
}
