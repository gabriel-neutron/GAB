import type { ReactNode } from 'react';
import { figureTexts, methodUi, parts, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { LayersFigure } from './layers-figure';
import { NodeField } from './node-field';
import { TimelineFigure, type ChartProps } from './timeline-figure';

const figureNotes: Readonly<Partial<Record<string, { readonly note: string }>>> =
  figureTexts.figures;

const charts: Readonly<Record<number, (props: ChartProps) => ReactNode>> = {
  1: LayersFigure,
  2: TimelineFigure,
};

const NOTE = /\[\^([^\]]+)\]/g;

/** Method and chronology: a chapter break over the field of the critical nodes, the reading
 * column with its notes in the left margin, the layer diagram across the page, and the sanctions
 * timeline on scroll. */
export function MethodChronologyPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  // The blocks of a part never move, so their place is their identity.
  const body = part.blocks.map((block, index) => {
    const key = `${part.slug}-${String(index)}`;
    const figure = block.figure;
    if (block.kind === 'figure' && figure !== undefined) {
      const Chart = charts[figure.number];
      return (
        <FigureFrame
          key={key}
          number={figure.number}
          title={figure.title}
          unit={
            figure.number === 1
              ? methodUi.layers.unit
              : figure.unit === ''
                ? methodUi.timeline.unit
                : figure.unit
          }
          period={figure.period === '' ? methodUi.layers.period : figure.period}
          sources={figure.number === 1 ? methodUi.layers.sources : figure.sources}
          note={figureNotes[String(figure.number)]?.note}
          partSlug={part.slug}
        >
          {Chart === undefined ? null : <Chart figure={figure} partSlug={part.slug} />}
        </FigureFrame>
      );
    }
    const ids = [...block.text.matchAll(NOTE)].map((match) => match[1] ?? '');
    const notes = part.notes.filter((note) => ids.includes(note.id));
    return (
      <div key={key} className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="max-w-[40rem] text-report-body/[1.65]  lg:col-span-8 lg:col-start-4">
          <Reveal>
            <p>
              <RichText text={block.text} partSlug={part.slug} />
            </p>
          </Reveal>
        </div>
        {/* The margin repeats what the note markers open, so a phone does without it. */}
        {notes.length === 0 ? null : (
          <aside
            aria-hidden="true"
            className="hidden space-y-4 border-t border-divider pt-2 font-mono text-report-label/5 text-label lg:row-start-1 lg:col-span-3 lg:col-start-1 lg:block"
          >
            {notes.map((note) => (
              <p key={note.id}>
                <span className="text-foreground">{note.id.slice(note.id.indexOf('-') + 1)}</span>{' '}
                <RichText text={note.text} />
              </p>
            ))}
          </aside>
        )}
      </div>
    );
  });
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <div className="relative isolate">
        <NodeField />
        <ChapterBreak number={number} title={part.title} />
      </div>
      <div className="space-y-8 py-16 md:py-24">{body}</div>
    </section>
  );
}
