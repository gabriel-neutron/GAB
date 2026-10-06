import type { ActPassages } from './passages';

export interface CitedPassagesProps {
  readonly cited: ActPassages;
}

/** The words of each page that the act cites, as the stored page states them. The operator decides
 * on the proof itself, and never on a summary of it. */
export function CitedPassages({ cited }: CitedPassagesProps) {
  if (cited.state === 'private')
    return (
      <p data-passages="private" className="text-small/4 text-label">
        {cited.why}
      </p>
    );
  if (cited.passages.length === 0) return null;

  return (
    <section aria-label="The cited passages" className="space-y-1">
      {cited.passages.map((passage) => (
        <figure key={`${passage.document} ${String(passage.page)} ${passage.text}`} data-passage>
          <blockquote className="border-l border-border pl-2 text-xs whitespace-pre-line">
            {passage.text}
          </blockquote>
          <figcaption className="truncate min-w-0 text-small/4 text-label" title={passage.title}>
            {passage.title}, page {passage.page}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
