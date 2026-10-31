import type { ReactNode } from 'react';
import { figureTexts, methodUi, parts, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { BigNumber } from '../../primitives/big-number';
import { NumberRoll } from '../../primitives/number-roll';
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
const SCALE = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Method and chronology: a chapter break over the field of the critical nodes, the reading
 * column with its notes in the left margin, the layer diagram across the page, the sanctions
 * timeline on scroll, and the counts of the critical nodes. */
export function MethodChronologyPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const { total, layers, serve } = methodUi.numbers;
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
    const scale = block.text.includes('ADMIRALTY');
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
        {notes.length === 0 && !scale ? null : (
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
            {scale ? <AdmiraltyScale /> : null}
          </aside>
        )}
      </div>
    );
  });
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <div className="relative isolate">
        <NodeField />
        <ChapterBreak number={number} title={part.title}>
          <Reveal>
            <p className="mt-8 max-w-[52ch] border-l border-foreground pl-4 text-report-body text-balance text-foreground/85 md:text-report-lead">
              {methodUi.quote}
            </p>
          </Reveal>
        </ChapterBreak>
      </div>
      <div className="space-y-8 py-16 md:py-24">{body}</div>
      <div className="grid gap-12 border-y border-border py-12 md:py-16 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-5">
          <BigNumber
            value={total.value}
            label={total.label}
            note={{ partSlug: part.slug, id: total.note }}
          />
        </div>
        <div className="lg:col-span-7">
          <p className="font-mono text-report-label uppercase text-label">{serve}</p>
          <ul className="mt-3 grid grid-cols-3 gap-4">
            {layers.map((one) => (
              <li key={one.label} className="min-w-0 border-t border-foreground pt-3">
                {/* One size for the three values, so their lengths do not change their weight. */}
                <p
                  className={cn(
                    'font-mono text-report-number leading-[0.82] tracking-[-0.06em] tabular-nums',
                    accent.text,
                  )}
                >
                  <NumberRoll value={one.value} />
                </p>
                <p className="mt-4 font-mono text-report-label/4 uppercase text-label">
                  {one.label}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The six letters of the scale; the text of the part gives a meaning to A and F only. */
function AdmiraltyScale() {
  const { scale, a, f } = methodUi.margin;
  return (
    <div className="border-t border-divider pt-2">
      <p className="uppercase">{scale}</p>
      <ol className="mt-2 grid grid-cols-6 border-l border-divider">
        {SCALE.map((letter) => (
          <li
            key={letter}
            className={cn(
              'border-r border-divider py-1 text-center text-report-small',
              letter === 'A' ? 'text-foreground' : 'text-label',
            )}
          >
            {letter}
          </li>
        ))}
      </ol>
      <p className="mt-2 flex justify-between gap-4">
        <span>A · {a}</span>
        <span className="text-right">F · {f}</span>
      </p>
    </div>
  );
}
