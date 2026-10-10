import { safeHref } from './safe-href.ts';
import type { SiteSource } from './site-release.ts';
import { LINK } from './site-style.ts';

function SourceAddress({ address }: { readonly address: string | null }) {
  if (address === null) return null;
  const href = safeHref(address);
  if (href === null) return <span>{address}</span>;
  return (
    <a className={LINK} href={href} rel="noreferrer">
      {address}
    </a>
  );
}

export interface SourceListProps {
  readonly sources: readonly SiteSource[];
  /** True on the page of one claim, where each document shows the passages of that claim. */
  readonly withPassages: boolean;
}

/** The public documents of one or more claims: the title, the address and the day when the
 * project read each one, and the passages of a claim when asked. */
export function SourceList({ sources, withPassages }: SourceListProps) {
  if (sources.length === 0) return <p>The release names no document here.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {sources.map((source) => (
        <li key={source.documentId} className="flex flex-col gap-1 border-l border-border pl-2">
          <p className="font-medium">{source.title}</p>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5">
            <dt className="text-label">Address</dt>
            <dd className="break-all">
              <SourceAddress address={source.address} />
            </dd>
            <dt className="text-label">Read on</dt>
            <dd className="font-mono tabular-nums">{source.readOn}</dd>
            <dt className="text-label">Document</dt>
            <dd className="font-mono">{source.documentId}</dd>
          </dl>
          {withPassages ? (
            source.passages.length === 0 ? (
              <p className="text-muted-foreground">
                The release holds no passage of this document for this claim.
              </p>
            ) : (
              source.passages.map((passage, index) => (
                <figure key={`${passage.page} ${String(index)}`} className="flex flex-col gap-0.5">
                  <blockquote className="max-w-prose bg-muted px-2 py-1">
                    {passage.excerpt}
                  </blockquote>
                  <figcaption className="text-muted-foreground">
                    Page {passage.page}, {passage.modality}
                    {passage.transcribed ? ', read by an AI from an image of the page' : ''}
                  </figcaption>
                </figure>
              ))
            )
          ) : null}
        </li>
      ))}
    </ol>
  );
}
