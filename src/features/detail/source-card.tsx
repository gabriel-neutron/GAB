import { FileX } from 'lucide-react';
import { useId, useState } from 'react';

import { ExtractionControl } from '@/shared/extraction-control';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { WhenWriterOnline } from '@/shared/write/when-writer-online';

import type { SourceCardModel } from './dossier';

export interface SourceCardProps {
  readonly source: SourceCardModel;
}

const LINK = 'min-w-0 text-primary underline underline-offset-2 break-all';

const NAME = 'w-16 shrink-0 text-label break-words';

export function SourceCard({ source }: SourceCardProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [addressOpen, setAddressOpen] = useState<boolean>(false);
  const addressId = useId();
  const panelId = useId();
  const factCount = source.backs.length + source.holdsUp.length;

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
        <span className="min-w-0 flex-1 text-xs break-words">{source.title}</span>
        {source.kind === null ? null : (
          <span className="shrink-0 text-small/4 text-label">{source.kind}</span>
        )}
        {source.missing ? (
          <FileX size={14} aria-hidden="true" className="shrink-0 text-dissent" />
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-small/4">
        {source.uri === null ? (
          <span className="min-w-0 flex-1 text-label">
            {source.imported ? 'Import dataset, no web address' : 'No web address recorded'}
          </span>
        ) : (
          <>
            <a
              id={addressId}
              href={source.uri}
              aria-label={`Open the original document at ${source.uri}`}
              className={cn(LINK, 'flex-1')}
            >
              {addressOpen ? source.uri : (source.uriShort ?? source.uri)}
            </a>
            {source.uriShort === source.uri.replace(/^https?:\/\//, '') ? null : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-expanded={addressOpen}
                aria-controls={addressId}
                onClick={() => {
                  setAddressOpen(!addressOpen);
                }}
                className="shrink-0 rounded-none px-1 text-small/4 transition-colors duration-100"
              >
                {addressOpen ? 'Show less' : 'Show more'}
              </Button>
            )}
          </>
        )}
        <span className="shrink-0 font-mono tabular-nums text-label">
          {source.retrievedAt === null
            ? 'No retrieval date recorded'
            : `Retrieved on ${source.retrievedAt}`}
        </span>
        {factCount === 0 ? (
          <p className="shrink-0 text-label">This document backs no fact on this page.</p>
        ) : (
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
            {`Facts (${factCount})`}
          </Button>
        )}
      </div>

      {source.missing ? (
        <p className="mt-1 text-small/4 text-dissent">
          This document is cited and it has no row in the record.
        </p>
      ) : null}

      {open ? (
        <div id={panelId} className="mt-1 space-y-1 text-small/4">
          {source.backs.length === 0 ? null : (
            <div>
              <p className={cn(NAME, 'w-auto')}>
                {`Facts this document backs (${source.backs.length})`}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {source.backs.map((fact) => (
                  <li key={fact.key} className="min-w-0 break-words">
                    {fact.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {source.holdsUp.length === 0 ? null : (
            <div>
              <p className={cn(NAME, 'w-auto')}>
                {`Attributes this document backs (${source.holdsUp.length})`}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {source.holdsUp.map((claim) => (
                  <li key={claim.key} className="flex gap-2">
                    <span className={cn(NAME)}>{claim.label}</span>
                    <span className="min-w-0 break-words">{claim.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {source.extractable ? (
            <WhenWriterOnline>
              <p className="text-label">
                An extraction reads the stored document and proposes facts. A person reviews each
                proposal before it enters the record.
              </p>
              <ExtractionControl documentId={source.id} />
            </WhenWriterOnline>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
