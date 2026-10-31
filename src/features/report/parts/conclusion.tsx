import { cn } from '@/shared/lib/utils';
import { parts, type ReportPart } from '../content';
import { ChapterBreak } from '../primitives/chapter-break';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';

const PROSE = 'max-w-[64ch] text-report-body/[1.65] ';
// The third paragraph is the answer: the question, two sentences on the money, one on the goods.
const SENTENCE = /(?<=[.?])\s+/;

/** The conclusion: the effect and the two ways around it in prose, the answer to the starting
 * question split into its two routes, and the advice. */
export function ConclusionPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const [effect, around, answer, advice] = part.blocks.map((block) => block.text);
  const [question, ...routes] = answer === undefined ? [] : answer.split(SENTENCE);
  const paragraph = (text: string | undefined) =>
    text === undefined ? null : (
      <p className={cn('my-6', PROSE)}>
        <RichText text={text} partSlug={part.slug} />
      </p>
    );
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} />
      <div className="py-16 md:py-24 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-3">
          {paragraph(effect)}
          {paragraph(around)}
        </div>
      </div>
      {routes.length === 3 ? (
        <Reveal>
          <div className="border-y border-foreground py-12 md:py-20">
            <p className="max-w-[30ch] text-report-heading leading-[1.08] tracking-[-0.03em] text-balance">
              {question}
            </p>
            <div className="mt-12 grid gap-px bg-border md:grid-cols-2">
              {[routes.slice(0, 2).join(' '), routes[2] ?? ''].map((text) => (
                <p
                  key={text}
                  className="bg-background pt-6 pb-2 text-report-lead leading-[1.3] tracking-[-0.015em] text-balance md:pr-8 md:even:pl-8"
                >
                  {text}
                </p>
              ))}
            </div>
          </div>
        </Reveal>
      ) : (
        paragraph(answer)
      )}
      <div className="pt-10 pb-24 md:pt-14 md:pb-32 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-3">{paragraph(advice)}</div>
      </div>
    </section>
  );
}
