import { CircleDashed, ExternalLink, FileX } from 'lucide-react';

import { SourceMark } from '@/shared/source-mark';

import type { CitedDocument } from './queue';

export interface SourceBadgeProps {
  readonly source: CitedDocument;
}

/** The rating is the badge, and not a position in a list: it is what outranks the self-report of
 * the machine, so the glance reads it and the document is one press away. */
export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <SourceMark
      name={source.name}
      band={source.missing ? 'missing' : source.rated ? source.score : 'not rated'}
      className={source.poor || source.missing ? 'border-dissent text-dissent' : undefined}
      label={
        source.missing ? (
          <FileX size={14} aria-hidden="true" />
        ) : source.rated ? (
          source.score
        ) : (
          // An absence is not a low score, so it is grey and it is never a dash.
          <CircleDashed size={14} aria-hidden="true" />
        )
      }
    >
      <span data-source={source.id} className="block space-y-1">
        <span className="block text-xs">{source.title}</span>
        <span className="block font-mono text-small/4 text-label">
          {source.score}
          {source.scoreOrigin === '' ? null : ` · ${source.scoreOrigin}`}
        </span>
        {source.missing ? (
          <span className="block text-small/4 text-dissent">
            This document is cited, and the record holds no row for it.
          </span>
        ) : null}
        {source.href === null ? (
          <span className="block text-small/4 text-label">
            No address. The copy taken at ingest is not served to this screen.
          </span>
        ) : (
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-baseline gap-1 text-small/4 text-primary underline underline-offset-2"
          >
            Open the copy taken at ingest
            <ExternalLink size={14} aria-hidden="true" className="shrink-0 self-center" />
          </a>
        )}
      </span>
    </SourceMark>
  );
}
