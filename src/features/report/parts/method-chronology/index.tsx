import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock, ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { LayersFigure } from './layers-figure';
import { NodeField } from './node-field';
import { TimelineFigure, type ChartProps } from './timeline-figure';

const charts: Readonly<Record<number, (props: ChartProps) => ReactNode>> = {
  1: TimelineFigure,
  2: LayersFigure,
};

const COLUMN = 'max-w-[40rem] text-report-body/[1.65]  lg:col-span-8 lg:col-start-4';

/** Method and chronology: a chapter break over the field of the critical nodes, the reading
 * column, the layer diagram across the page, and the sanctions
 * timeline on scroll. */
export function MethodChronologyPart({ part }: { readonly part: ReportPart }) {
  const { figureTexts, methodUi, parts } = useContent();
  const figureNotes: Readonly<Partial<Record<string, { readonly note: string }>>> =
    figureTexts.figures;
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  // A paragraph, or a list of the items that follow each other. Its notes open from their markers,
  // as in all parts.
  const row = (key: string, text: ReactNode) => (
    <div key={key} className="lg:grid lg:grid-cols-12 lg:gap-8">
      <div className={COLUMN}>
        <Reveal>{text}</Reveal>
      </div>
    </div>
  );
  const body: ReactNode[] = [];
  let items: ReportBlock[] = [];
  const closeList = () => {
    if (items.length === 0) return;
    const list = items;
    body.push(
      row(
        `${part.slug}-list-${String(body.length)}`,
        <ul className="space-y-2 border-l border-divider pl-5">
          {list.map((block) => (
            <li key={block.text}>
              <RichText text={block.text} partSlug={part.slug} />
            </li>
          ))}
        </ul>,
      ),
    );
    items = [];
  };
  // The blocks of a part never move, so their place is their identity.
  part.blocks.forEach((block, index) => {
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'li') {
      items.push(block);
      return;
    }
    closeList();
    const figure = block.figure;
    if (block.kind === 'figure' && figure !== undefined) {
      const Chart = charts[figure.number];
      body.push(
        <FigureFrame
          key={key}
          number={figure.number}
          title={figure.title}
          unit={
            figure.number === 2
              ? methodUi.layers.unit
              : figure.unit === ''
                ? methodUi.timeline.unit
                : figure.unit
          }
          period={figure.period === '' ? methodUi.layers.period : figure.period}
          sources={figure.sources}
          note={figureNotes[String(figure.number)]?.note}
          partSlug={part.slug}
        >
          {Chart === undefined ? null : <Chart figure={figure} partSlug={part.slug} />}
        </FigureFrame>,
      );
      return;
    }
    if (block.kind === 'h3') {
      body.push(
        <div key={key} className="lg:grid lg:grid-cols-12 lg:gap-8">
          <h3 className={cn(COLUMN, 'pt-8 text-report-lead text-balance')}>{block.text}</h3>
        </div>,
      );
      return;
    }
    body.push(
      row(
        key,
        <p>
          <RichText text={block.text} partSlug={part.slug} />
        </p>,
      ),
    );
  });
  closeList();
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
