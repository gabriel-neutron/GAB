import type { ReactNode } from 'react';

import { READING_LINK } from '@/shared/page/reading-link';

import type { FigureRow } from './figure-rows';
import { documentOf, type ValueSource } from './value-source';

export interface FigureFrameProps {
  readonly number: number;
  readonly title: string;
  readonly rows: readonly FigureRow[];
  readonly documents: ReadonlyMap<string, ValueSource>;
  readonly children: ReactNode;
}

const distinct = (words: readonly string[]): readonly string[] => [
  ...new Set(words.filter((one) => one !== '')),
];

/** A figure with its caption: the number, the title and the unit, then the documents that the
 * values come from, then the notes of the file. The caption is text on the page and not a part of
 * the image. */
export function FigureFrame({ number, title, rows, documents, children }: FigureFrameProps) {
  const units = distinct(rows.map((row) => row.unit));
  const sources = new Map(rows.map((row) => [row.document, documentOf(row, documents)]));
  const notes = distinct(rows.map((row) => row.note));
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className="flex flex-col gap-1 text-body-sm text-label">
        <p>
          <strong className=" text-foreground">
            {`Figure ${String(number)}. ${title}${units.length === 0 ? '' : ` (${units.join(', ')})`}.`}
          </strong>
        </p>
        {sources.size === 0 ? null : (
          <p>
            Source:{' '}
            {[...sources.values()].map((source, place) => (
              <span key={source.words}>
                {place === 0 ? '' : '; '}
                {source.href === null ? (
                  source.words
                ) : (
                  <a className={READING_LINK} href={source.href}>
                    {source.words}
                  </a>
                )}
              </span>
            ))}
            .
          </p>
        )}
        {notes.length === 0 ? null : <p>Note: {notes.join(' ')}</p>}
      </figcaption>
    </figure>
  );
}
