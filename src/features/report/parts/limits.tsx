import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock, ReportPart } from '../content';
import { accent } from '../primitives/accent';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';
import { useContent } from '../use-content';
import { ClosingBreak, OUTLINE } from './closing-art';

// A list item opens with its claim in bold; the rest of the item explains it.
const KEY = /^\*\*(.+?)\s?:?\*\*\s*/; // A French key has a space before its colon.
const PROSE = 'max-w-[64ch] text-report-body/[1.65] ';
// The widths of the redaction bars of the break: what the data cannot say.
const BARS = ['w-[38%]', 'w-[62%]', 'w-[24%]', 'w-[48%]'];

function Item({ block, index, partSlug }: { block: ReportBlock; index: number; partSlug: string }) {
  const match = KEY.exec(block.text);
  const rest = match === null ? block.text : block.text.slice(match[0].length);
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-t border-border py-8 md:grid-cols-[6rem_minmax(0,1fr)] lg:grid-cols-[6rem_minmax(0,19rem)_minmax(0,1fr)] lg:gap-x-10">
      <span
        aria-hidden="true"
        className={cn(
          'row-span-2 font-mono text-report-number leading-[0.8] tracking-[-0.06em] tabular-nums ',
          OUTLINE,
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      {match === null ? null : (
        <p className="text-report-lead leading-[1.15] tracking-[-0.02em] text-balance">
          {match[1]}
        </p>
      )}
      <p
        className={cn(
          'mt-3 max-w-[60ch] text-report-body/[1.6] text-foreground/80 lg:mt-0',
          match === null ? 'lg:col-span-2' : 'col-start-2 lg:col-start-3',
        )}
      >
        <RichText text={rest} partSlug={partSlug} />
      </p>
    </li>
  );
}

/** The limits: a break with the four limits as a redacted register, the limits of the evidence as
 * a ruled list, the one check that every fact needs as a pull statement, then the leads. */
export function LimitsPart({ part }: { readonly part: ReportPart }) {
  const { closingUi, parts } = useContent();
  const { limits: copy } = closingUi;
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const claims = part.blocks
    .filter((block) => block.kind === 'li')
    .slice(0, 4)
    .map((block) => KEY.exec(block.text)?.[1] ?? '');
  // The part reads as: intro, limits, check, heading, leads intro, leads.
  const out: ReactNode[] = [];
  let list: ReportBlock[] = [];
  let lists = 0;
  const flush = () => {
    if (list.length === 0) return;
    const label = lists === 0 ? copy.limitsLabel : copy.leadsLabel;
    out.push(
      <ol key={`list-${String(lists)}`} aria-label={label} className="my-10 border-b border-border">
        {list.map((block, index) => (
          <Item key={index} block={block} index={index} partSlug={part.slug} />
        ))}
      </ol>,
    );
    list = [];
    lists += 1;
  };
  for (const block of part.blocks) {
    if (block.kind === 'li') {
      list.push(block);
      continue;
    }
    // The paragraph just after the four limits is the check that every fact needs.
    const check = lists === 0 && list.length > 0 && block.kind === 'p';
    flush();
    const text = <RichText text={block.text} partSlug={part.slug} />;
    if (block.kind === 'h3')
      out.push(
        <h3
          key={block.text}
          className="mt-24 border-t border-foreground pt-3 font-mono text-report-label uppercase text-label"
        >
          {block.text}
        </h3>,
      );
    else if (check)
      out.push(
        <Reveal key={block.text}>
          {/* The rule of the list above and the rule of the heading below frame the check. */}
          <aside aria-label={copy.checkLabel} className="my-16 py-6 md:py-10">
            <div className={cn('border-l-4 pl-5 md:pl-8', accent.border)}>
              <p className="max-w-[40ch] text-report-lead leading-[1.2] tracking-[-0.025em] text-balance">
                {text}
              </p>
            </div>
          </aside>
        </Reveal>,
      );
    else
      out.push(
        <p key={block.text} className={cn('my-6', PROSE)}>
          {text}
        </p>,
      );
  }
  flush();
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ClosingBreak
        number={number}
        title={part.title}
        className="top-[22%] right-[6%] w-[44%]"
        art={
          <ol className="font-mono text-report-label/[1.5] uppercase  ">
            {claims.map((claim, index) => (
              <li
                key={claim}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-border py-2 md:py-4"
              >
                <span className="text-label tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-foreground/45">
                  {claim}
                  <span
                    className={cn('mt-1.5 block h-[1em] md:mt-2 bg-foreground/25', BARS[index])}
                  />
                </span>
              </li>
            ))}
          </ol>
        }
      />
      <div className="py-16 md:py-24">{out}</div>
    </section>
  );
}
