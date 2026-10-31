import { cn } from '@/shared/lib/utils';
import { closingUi, parts, type ReportPart } from '../content';
import { NoteRef } from '../note-ref';
import { accent } from '../primitives/accent';
import { layout } from '../primitives/layout';
import { NumberRoll } from '../primitives/number-roll';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';
import { ClosingBreak, OUTLINE } from './closing-art';

const { conclusion: copy } = closingUi;
const PROSE = 'max-w-[64ch] text-[18px]/[1.65] md:text-[20px]/[1.65]';
const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
// The third paragraph is the answer: the question, two sentences on the money, one on the goods.
const SENTENCE = /(?<=[.?])\s+/;

/** The conclusion: the effect and the two ways around it in prose, the share of the shadow fleet
 * across the page, the answer to the starting question split into its two routes, the advice, then
 * the end mark of the text. */
export function ConclusionPart({ part }: { readonly part: ReportPart }) {
  const index = parts.indexOf(part);
  const number = String(index + 1).padStart(2, '0');
  const next = parts[index + 1];
  const [effect, around, answer, advice] = part.blocks.map((block) => block.text);
  const [question, ...routes] = answer === undefined ? [] : answer.split(SENTENCE);
  const { last } = copy;
  const paragraph = (text: string | undefined) =>
    text === undefined ? null : (
      <p className={cn('my-6', PROSE)}>
        <RichText text={text} partSlug={part.slug} />
      </p>
    );
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ClosingBreak
        number={number}
        title={part.title}
        quote={copy.quote}
        className="top-[12%] -right-[4vw] text-right"
        // The label keeps clear of the bleed of the words.
        labelClassName="pr-[10vw]"
        art={
          <p
            className={cn(
              'font-mono text-[22vw] leading-[0.82] tracking-[-0.08em] uppercase lg:text-[19vw]',
              OUTLINE,
              'opacity-40',
            )}
          >
            <span className="block">{copy.money}</span>
            <span className="block">{copy.goods}</span>
          </p>
        }
      />
      <div className="py-16 md:py-24 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-3">
          {paragraph(effect)}
          {paragraph(around)}
        </div>
      </div>
      {/* The share of the shadow fleet, just after the sentence that gives it. */}
      <figure className={cn(layout.bleed, 'border-t border-foreground')}>
        <div className="mx-auto w-full max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
          <p className="font-mono text-caption uppercase text-label">{last.kicker}</p>
          <p
            className={cn(
              'mt-6 font-mono text-[clamp(7rem,42vw,27rem)] leading-[0.8] tracking-[-0.07em] tabular-nums',
              accent.text,
            )}
          >
            <NumberRoll value={last.value} />
          </p>
          <figcaption className="mt-8 max-w-[60ch] border-t border-border pt-4 font-mono text-caption/5 uppercase text-label">
            {last.label}
            <NoteRef partSlug={part.slug} id={last.note} />
          </figcaption>
        </div>
      </figure>
      {routes.length === 3 ? (
        <Reveal>
          <div className="border-y border-foreground py-12 md:py-20">
            <p className="font-mono text-caption uppercase text-label">{copy.routesLabel}</p>
            <p className="mt-6 max-w-[30ch] text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.08] tracking-[-0.03em] text-balance">
              {question}
            </p>
            <dl className="mt-12 grid gap-px bg-border md:grid-cols-2">
              {[
                [copy.money, routes.slice(0, 2).join(' ')],
                [copy.goods, routes[2] ?? ''],
              ].map(([term, text]) => (
                <div key={term} className="bg-background pt-6 pb-2 md:pr-8 md:even:pl-8">
                  <dt className={cn('font-mono text-caption uppercase', accent.text)}>{term}</dt>
                  <dd className="mt-3 text-[clamp(1.25rem,2.4vw,1.625rem)] leading-[1.3] tracking-[-0.015em] text-balance">
                    {text}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      ) : (
        paragraph(answer)
      )}
      <div className="pt-10 pb-16 md:pt-14 md:pb-20 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-3">{paragraph(advice)}</div>
      </div>
      <footer className="grid gap-10 border-t border-foreground pt-6 pb-24 md:grid-cols-12 md:gap-8 md:pb-32">
        <p className="flex items-start gap-4 text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.045em] text-balance md:col-span-8">
          <span aria-hidden="true" className="mt-[0.12em] size-[0.6em] shrink-0 bg-foreground" />
          {copy.end}
        </p>
        <div className="font-mono text-caption uppercase text-label md:col-span-4 md:self-end">
          <p>{copy.dataDate}</p>
          {next === undefined ? null : (
            <a
              href={`#${next.slug}`}
              className={cn(
                'mt-4 flex min-h-11 items-center justify-between gap-4 border-y border-border text-foreground',
                FOCUS,
              )}
            >
              <span>
                {copy.next} {next.title}
              </span>
              <span aria-hidden="true">↓</span>
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}
