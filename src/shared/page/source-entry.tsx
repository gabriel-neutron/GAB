import { EmptyState } from './empty-state';
import { KeyValue } from './key-value';
import { READING_LINK } from './reading-link';
import { safeHref } from './safe-href';

export interface SourcePassage {
  readonly page: string;
  readonly excerpt: string;
  /** How the passage was read: the words of the release, for example "text" or "image". */
  readonly modality: string;
  /** True when an AI read the passage from an image of the page. */
  readonly transcribed: boolean;
}

export interface SourceEntryModel {
  readonly documentId: string;
  readonly title: string;
  readonly address: string | null;
  /** The day when the project read the document, as the record gives it. */
  readonly readOn: string | null;
  /** The passages that hold one claim. Null on a page that cites the document for many claims. */
  readonly passages: readonly SourcePassage[] | null;
}

export interface SourceEntryProps {
  readonly source: SourceEntryModel;
}

function SourceAddress({ address }: { readonly address: string | null }) {
  if (address === null) return null;
  const href = safeHref(address);
  if (href === null) return address;
  return (
    <a className={READING_LINK} href={href} rel="noreferrer">
      {address}
    </a>
  );
}

/** One public document that a page cites: its title, its address, the day it was read and, for
 * one claim, the passages that hold the claim. It carries no grade and no letter (S1). */
export function SourceEntry({ source }: SourceEntryProps) {
  return (
    <article
      aria-label={source.title}
      className="flex min-w-0 flex-col gap-1 border-l border-input pl-3"
    >
      <h3 className="font-medium break-words">{source.title}</h3>
      <div className="text-xs/5">
        <KeyValue
          entries={[
            { key: 'Address', value: <SourceAddress address={source.address} /> },
            { key: 'Read on', value: source.readOn, figure: true },
            { key: 'Document', value: source.documentId, figure: true },
          ]}
        />
      </div>
      {source.passages === null ? null : source.passages.length === 0 ? (
        <EmptyState sentence="The release holds no passage of this document for this claim." />
      ) : (
        source.passages.map((passage, index) => (
          // A passage has no identifier of its own. Its page and its place in the list name it.
          <figure key={`${passage.page} ${String(index)}`} className="flex flex-col gap-1">
            <blockquote className="max-w-prose bg-muted px-3 py-2">{passage.excerpt}</blockquote>
            <figcaption className="text-xs/5 text-muted-foreground">
              Page {passage.page}, {passage.modality}
              {passage.transcribed ? ', read by an AI from an image of the page' : ''}
            </figcaption>
          </figure>
        ))
      )}
    </article>
  );
}
