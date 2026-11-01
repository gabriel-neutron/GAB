import type { ReactNode } from 'react';
import type { ReportPart } from '../../content';
import { cn } from '@/shared/lib/utils';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { SettlementFigure } from './settlement-figure';

const PROSE = 'max-w-[64ch] text-report-body/[1.65] ';

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
      <ChapterBreak number={number} title={part.title} image={financeUi.image} />
      <div className="py-16 md:py-24">{body}</div>
    </section>
  );
}
