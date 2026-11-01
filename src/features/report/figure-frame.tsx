import type { ReactNode } from 'react';
import { RichText } from './rich-text';
import { useContent } from './use-content';

interface FigureFrameProps {
  /** No number: a figure of the page that the final text does not have. */
  readonly number?: number | undefined;
  readonly title: string;
  readonly unit?: string | undefined;
  readonly period?: string | undefined;
  /** Report text: it can hold note markers of `partSlug`. */
  readonly sources: string;
  readonly note?: string | undefined;
  readonly partSlug?: string | undefined;
  /** The chart. */
  readonly children: ReactNode;
  /** A plate of a book: a display title. */
  readonly plate?: boolean | undefined;
}

/** The frame of one figure. The unit, the period and the sources show at all times, beside the
 * chart; an empty value stays a blank cell under its name. */
export function FigureFrame({
  number,
  title,
  unit,
  period,
  sources,
  note,
  partSlug,
  children,
  plate = false,
}: FigureFrameProps) {
  const { ui } = useContent();
  const facts = [
    [ui.figure.unit, unit ?? ''],
    [ui.figure.period, period ?? ''],
  ] as const;
  return (
    <figure className="my-12 border-t border-foreground pt-3">
      {/* The number of the figure leads the title: the text names each figure by it. */}
      <h3
        className={
          plate
            ? 'max-w-[24ch] text-report-heading leading-[1.02] tracking-[-0.035em] text-balance'
            : 'text-report-lead text-balance'
        }
      >
        {number === undefined ? null : (
          <span className="mr-3 font-mono text-label tabular-nums">
            <span className="sr-only">{ui.figure.name} </span>
            {number}
            <span className="sr-only">. </span>
          </span>
        )}
        {title}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-divider pb-3 md:grid-cols-[auto_auto_1fr]">
        {facts.map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="font-mono text-report-label uppercase text-label">{term}</dt>
            <dd className="font-mono text-report-label break-words">{value}</dd>
          </div>
        ))}
        <div className="col-span-2 min-w-0 md:col-span-1">
          <dt className="font-mono text-report-label uppercase text-label">{ui.figure.sources}</dt>
          <dd className="text-report-small break-words text-muted-foreground">
            <RichText text={sources} partSlug={partSlug} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">{children}</div>
      {note === undefined || note === '' ? null : (
        <figcaption className="mt-3 text-report-small text-muted-foreground">
          <span className="mr-2 font-mono text-report-label uppercase text-label">
            {ui.figure.note}
          </span>
          <RichText text={note} partSlug={partSlug} />
        </figcaption>
      )}
    </figure>
  );
}
