import type { ReactNode } from 'react';
import { financeUi, parts, type ReportPart } from '../../content';
import { parseMarks } from '../../marks';
import { NodeRef } from '../../node-ref';
import { NoteRef } from '../../note-ref';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { AsciiImage } from '../../primitives/ascii-image';
import { monoLabel } from '../../primitives/label';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { SettlementFigure } from './settlement-figure';

const PROSE = 'max-w-[64ch] text-[18px]/[1.65] md:text-[20px]/[1.65]';

/** The distinct nodes that one block of text names, in the order of the text. */
const namedNodes = (text: string): readonly string[] => [
  ...new Set(parseMarks(text).flatMap((mark) => (mark.kind === 'node' ? [mark.id] : []))),
];

/** The crossover of the yuan and the rouble at the end of 2023, after the paragraph that names it.
 * Each value is written exactly as in the note. */
function CurrencyTie() {
  const { tie } = financeUi;
  return (
    <div className="my-16 border-y border-border py-10 lg:ml-[calc(100%/6)]">
      <p className={monoLabel}>
        {tie.label}
        <NoteRef partSlug={tie.note.partSlug} id={tie.note.id} />
      </p>
      <dl className="mt-6 grid grid-cols-2">
        {tie.values.map((one, place) => (
          <div
            key={one.label}
            className="min-w-0 border-l border-border pl-3 first:border-l-0 first:pl-0 md:pl-6"
          >
            <dt className={monoLabel}>{one.label}</dt>
            <dd
              className={cn(
                'mt-2 text-[clamp(3rem,12vw,10rem)] leading-[0.82] tracking-[-0.06em] tabular-nums',
                // The rouble keeps the accent of figure 9.
                place === 1 ? accent.text : 'text-foreground',
              )}
            >
              {one.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The chapter break: the bed curtain border as an ASCII band behind the numeral, down to its
 * baseline, and its credit as a mono caption in the flow under the deck, at every width. */
function FinanceBreak({ number, title }: { readonly number: string; readonly title: string }) {
  const { image } = financeUi;
  return (
    // The break packs to its content, so the title sits under the numeral at every width.
    <div className={cn(layout.bleed, 'isolate [&>div]:min-h-0')}>
      {/* The band ends at the baseline of the numeral: its top padding, 0.78 of its size, and its
          bottom padding, as the chapter break sets them. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[calc(4rem+0.78*clamp(8rem,56vw,26rem))] opacity-70 [mask-image:linear-gradient(to_bottom,black_60%,transparent)] md:h-[calc(5rem+0.78*clamp(8rem,56vw,26rem))] lg:opacity-60">
        <AsciiImage src={image.src} alt={image.alt} />
      </div>
      <ChapterBreak number={number} title={title} quote={financeUi.quote}>
        <p className="mt-10 max-w-[60ch] border-t border-border pt-3 font-mono text-[12px]/[1.5] text-label">
          <span className="block tracking-[0.08em] text-foreground uppercase">{image.label}</span>
          {image.credit}
        </p>
      </ChapterBreak>
    </div>
  );
}

/** One payment relay: an outlined index, the text, the nodes it names, and the sanctions that
 * follow it, as the text dates them. */
function RelayRow({
  text,
  index,
  partSlug,
}: {
  readonly text: string;
  readonly index: number;
  readonly partSlug: string;
}) {
  const nodes = namedNodes(text);
  const stamps = financeUi.relays.stamps[index] ?? [];
  return (
    <li className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-4 border-b border-border py-8 pl-4 md:grid-cols-[6rem_minmax(0,1fr)] md:gap-x-8 md:pl-6 lg:grid-cols-[6rem_minmax(0,1fr)_15rem]">
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-10 -left-[5px] size-[9px]',
          stamps.length > 0 ? accent.bg : 'bg-border',
        )}
      />
      <span className="font-mono text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.85] tracking-[-0.06em] text-transparent tabular-nums [-webkit-text-stroke:1px_var(--color-foreground)]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <p className={cn(PROSE, '[&_strong]:font-medium')}>
        <RichText text={text} partSlug={partSlug} />
      </p>
      {stamps.length === 0 && nodes.length === 0 ? null : (
        <div className="col-start-2 flex flex-col gap-4 md:flex-row md:flex-wrap md:gap-x-10 lg:col-start-3 lg:flex-col lg:gap-4">
          {stamps.length === 0 ? null : (
            <div>
              <p className="font-mono text-caption uppercase text-label">
                {financeUi.relays.sanctions}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {stamps.map((stamp, place) => (
                  // The stamps are fixed report text, so their place is their identity.
                  <li
                    key={`${stamp.body}-${String(place)}`}
                    className={cn(
                      'border px-2 py-1 font-mono text-data uppercase tabular-nums',
                      accent.border,
                      accent.text,
                    )}
                  >
                    {stamp.body}
                    {stamp.when === '' ? null : (
                      <span className="text-foreground"> · {stamp.when}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {nodes.length === 0 ? null : (
            <div>
              <p className="font-mono text-caption uppercase text-label">
                {financeUi.relays.nodes} · <span className="tabular-nums">{nodes.length}</span>
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-4 text-body-sm">
                {nodes.map((id) => (
                  <li key={id} className="flex min-h-11 items-center">
                    <NodeRef id={id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Part 6, finance: an ASCII chapter break on a Russian bed curtain border, figure 9 as a scroll
 * scene, the crossover of the yuan and the rouble, and the payment relays as a ledger with the nodes that
 * each relay names. */
export function FinancePart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const body: ReactNode[] = [];
  let relays: ReactNode[] = [];
  const closeRelays = (key: string) => {
    if (relays.length === 0) return;
    body.push(
      <section key={`relays-${key}`} aria-label={financeUi.relays.label} className="my-14">
        <p className="border-b border-foreground pb-3 font-mono text-caption uppercase text-label">
          {financeUi.relays.label}
        </p>
        <ol className="border-l border-border">{relays}</ol>
      </section>,
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
    body.push(
      <Reveal key={key}>
        <p className={`my-6 lg:ml-[calc(100%/6)] ${PROSE}`}>
          <RichText text={block.text} partSlug={part.slug} />
        </p>
      </Reveal>,
    );
    if (block.text.includes(`[^${financeUi.tie.note.id}]`)) body.push(<CurrencyTie key="tie" />);
  });
  closeRelays('end');
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <FinanceBreak number={number} title={part.title} />
      <div className="py-16 md:py-24">{body}</div>
    </section>
  );
}
