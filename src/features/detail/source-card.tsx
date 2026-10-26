import { FileX } from 'lucide-react';
import { safeHref } from '@gab/release/safe-href';
import { useId, useState } from 'react';

import { ExtractionControl } from '@/shared/extraction-control';
import { cn } from '@/shared/lib/utils';
import { WhenWriterOnline } from '@/shared/write/when-writer-online';

import type { SourceCardModel } from './dossier';
import { CAPTION, DATA, GHOST_LINK } from './style';

export interface SourceCardProps {
  readonly source: SourceCardModel;
}

// An address that safeHref refuses is text, so it has no underline.
const TEXT = 'min-w-0 break-all';

const NAME = `${CAPTION} break-words`;

// A control of the card that opens or closes a part is a GhostLink too: text on a hairline.
const TOGGLE = `${GHOST_LINK} shrink-0 cursor-pointer bg-transparent text-body-sm`;

export function SourceCard({ source }: SourceCardProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [addressOpen, setAddressOpen] = useState<boolean>(false);
  const addressId = useId();
  const panelId = useId();
  // An address comes from an untrusted page. A refused address stays text.
  const href = source.uri === null ? null : safeHref(source.uri);
  const shown = addressOpen ? source.uri : (source.uriShort ?? source.uri);
  const factCount = source.backs.length + source.holdsUp.length;

  return (
    <article
      aria-label={`Source ${source.number} — ${source.title}`}
      data-source={source.id}
      className="flex flex-col gap-1 px-3 py-2"
    >
      <div className="flex items-baseline gap-2">
        <span className={`shrink-0 ${DATA} text-muted-foreground`}>{source.number}</span>
        <span className="min-w-0 flex-1 text-body-sm break-words">{source.title}</span>
        {source.kind === null ? null : <span className={`shrink-0 ${CAPTION}`}>{source.kind}</span>}
        {source.missing ? (
          <FileX size={14} aria-hidden="true" className="shrink-0 text-dissent" />
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {source.uri === null ? (
          <span className="min-w-0 flex-1 text-body-sm text-muted-foreground">
            {source.imported ? 'Import dataset, no web address' : 'No web address recorded'}
          </span>
        ) : (
          <>
            {href === null ? (
              <span
                id={addressId}
                className={cn(TEXT, DATA, addressOpen ? 'basis-full' : 'flex-1')}
              >
                {shown}
              </span>
            ) : (
              <a
                id={addressId}
                href={href}
                aria-label={
                  addressOpen
                    ? `Open the original document at ${source.uri}`
                    : `${source.uriShort ?? source.uri}, open the original document`
                }
                className={cn(
                  GHOST_LINK,
                  TEXT,
                  DATA,
                  'w-fit max-w-full text-body-sm',
                  addressOpen && 'basis-full',
                )}
              >
                {`${shown ?? ''} →`}
              </a>
            )}
            {source.uriCut ? (
              <button
                type="button"
                aria-expanded={addressOpen}
                aria-controls={addressId}
                aria-label={`${addressOpen ? 'Show less of' : 'Show more of'} address of source ${String(source.number)}`}
                onClick={() => {
                  setAddressOpen(!addressOpen);
                }}
                className={TOGGLE}
              >
                {addressOpen ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        )}
        <span className={`shrink-0 ${DATA} text-muted-foreground`}>
          {source.retrievedAt === null
            ? 'No retrieval date recorded'
            : `Retrieved on ${source.retrievedAt}`}
        </span>
        {factCount === 0 ? (
          <p className="shrink-0 text-body-sm text-muted-foreground">
            This document backs no fact on this page.
          </p>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              setOpen(!open);
            }}
            className={TOGGLE}
          >
            {`Facts (${factCount})`}
          </button>
        )}
      </div>

      {source.missing ? (
        <p className="text-body-sm text-dissent">
          This document is cited and it has no row in the record.
        </p>
      ) : null}

      {open ? (
        <div id={panelId} className="flex flex-col gap-3 text-body-sm">
          {source.backs.length === 0 ? null : (
            <div className="flex flex-col gap-1">
              <p className={NAME}>{`Facts this document backs (${source.backs.length})`}</p>
              <ul className="space-y-1">
                {source.backs.map((fact) => (
                  <li key={fact.key} className="min-w-0 break-words">
                    {fact.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {source.holdsUp.length === 0 ? null : (
            <div className="flex flex-col gap-1">
              <p className={NAME}>{`Attributes this document backs (${source.holdsUp.length})`}</p>
              <ul className="space-y-1">
                {source.holdsUp.map((claim) => (
                  <li key={claim.key} className="flex gap-3">
                    <span className={`w-24 shrink-0 ${NAME}`}>{claim.label}</span>
                    <span className="min-w-0 break-words">{claim.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {source.extractable ? (
            <WhenWriterOnline>
              <p className="text-muted-foreground">
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
