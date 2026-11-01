import type { ReactNode } from 'react';
import type { ReportPart } from '../../content';
import { cn } from '@/shared/lib/utils';
import { AsciiImage } from '../../primitives/ascii-image';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { SettlementFigure } from './settlement-figure';

const PROSE = 'max-w-[64ch] text-report-body/[1.65] ';

/** The chapter break: the rouble coin as a decorative ASCII band behind the numeral, down to its
 * baseline. */
function FinanceBreak({ number, title }: { readonly number: string; readonly title: string }) {
  const { financeUi } = useContent();
  return (
    // The break packs to its content, so the title sits under the numeral at every width.
    <div className={cn(layout.bleed, 'isolate [&>div]:min-h-0')}>
      {/* The band ends at the baseline of the numeral: its top padding, 0.78 of its size, and its
          bottom padding, as the chapter break sets them. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[calc(4rem+0.78*clamp(8rem,56vw,26rem))] opacity-70 [mask-image:linear-gradient(to_bottom,black_60%,transparent)] md:h-[calc(5rem+0.78*clamp(8rem,56vw,26rem))] lg:opacity-60">
        <AsciiImage src={financeUi.image} />
      </div>
      <ChapterBreak number={number} title={title} />
    </div>
  );
}

/** One payment relay: an outlined index and the text. */
function RelayRow({
  text,
  index,
  partSlug,
}: {
  readonly text: string;
  readonly index: number;
  readonly partSlug: string;
}) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 border-b border-border py-8 pl-4 md:grid-cols-[6rem_minmax(0,1fr)] md:gap-x-8 md:pl-6">
      <span className="font-mono text-report-number leading-[0.85] tracking-[-0.06em] text-transparent tabular-nums [-webkit-text-stroke:1px_var(--color-foreground)]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <p className={cn(PROSE, '[&_strong]:font-medium')}>
        <RichText text={text} partSlug={partSlug} />
      </p>
    </li>
  );
}

/** Part 6, finance: an ASCII chapter break on a rouble coin of 1771, figure 10 as a scroll
 * scene, and the payment relays as a ledger. */
export function FinancePart({ part }: { readonly part: ReportPart }) {
  const { financeUi, parts } = useContent();
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const body: ReactNode[] = [];
  let relays: ReactNode[] = [];
  const closeRelays = (key: string) => {
    if (relays.length === 0) return;
    body.push(
      <ol
        key={`relays-${key}`}
        aria-label={financeUi.relays.label}
        className="my-14 border-t border-l border-foreground/40"
      >
        {relays}
      </ol>,
    );
    relays = [];
  };
  part.blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'li') {
      relays.push(
        <RelayRow key={key} text={block.text} index={relays.length} partSlug={part.slug} />,
      );
      return;
    }
    closeRelays(key);
    if (block.kind === 'figure') {
      body.push(<SettlementFigure key={key} block={block} partSlug={part.slug} />);
      return;
    }
    if (block.kind === 'h3') {
      body.push(
        <h3
          key={key}
          className="mt-16 mb-2 max-w-[64ch] text-report-lead text-balance lg:ml-[calc(100%/6)]"
        >
          {block.text}
        </h3>,
      );
      return;
    }
    body.push(
      <Reveal key={key}>
        <p className={`my-6 lg:ml-[calc(100%/6)] ${PROSE}`}>
          <RichText text={block.text} partSlug={part.slug} />
        </p>
      </Reveal>,
    );
  });
  closeRelays('end');
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <FinanceBreak number={number} title={part.title} />
      <div className="py-16 md:py-24">{body}</div>
    </section>
  );
}
