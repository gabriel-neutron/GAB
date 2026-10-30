import type { ReactNode } from 'react';
import { ui } from './content';
import { RichText } from './rich-text';

interface FigureFrameProps {
  readonly number: number;
  readonly title: string;
  readonly unit?: string | undefined;
  readonly period?: string | undefined;
  /** Report text: it can hold note markers of `partSlug`. */
  readonly sources: string;
  readonly note?: string | undefined;
  readonly partSlug?: string | undefined;
  /** The chart. */
  readonly children: ReactNode;
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
}: FigureFrameProps) {
  const facts = [
    [ui.figure.unit, unit ?? ''],
    [ui.figure.period, period ?? ''],
  ] as const;
  return (
    <figure className="my-12 border-t border-foreground pt-3">
      <p className="font-mono text-caption uppercase text-label">
        {ui.figure.name} {number}
      </p>
      <h3 className="mt-2 text-heading-sm text-balance">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-divider pb-3 md:grid-cols-[auto_auto_1fr]">
        {facts.map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="font-mono text-caption uppercase text-label">{term}</dt>
            <dd className="font-mono text-data break-words">{value}</dd>
          </div>
        ))}
        <div className="col-span-2 min-w-0 md:col-span-1">
          <dt className="font-mono text-caption uppercase text-label">{ui.figure.sources}</dt>
          <dd className="text-body-sm break-words text-muted-foreground">
            <RichText text={sources} partSlug={partSlug} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">{children}</div>
      {note === undefined || note === '' ? null : (
        <figcaption className="mt-3 text-body-sm text-muted-foreground">
          <span className="mr-2 font-mono text-caption uppercase text-label">{ui.figure.note}</span>
          <RichText text={note} partSlug={partSlug} />
        </figcaption>
      )}
    </figure>
  );
}
