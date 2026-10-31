import type { ReactNode } from 'react';
import { openingUi, parts, type ReportPart } from '../content';
import { BigNumber } from '../primitives/big-number';
import { ChapterBreak } from '../primitives/chapter-break';
import { monoLabel } from '../primitives/label';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';

const { introduction: copy } = openingUi;

/** The introduction: a typographic chapter break with a dithered illustration in its empty half,
 * then a calm reading column with the sanctions
 * context from 2014 to 2026 in the margin, two key values and the three questions. */
export function IntroductionPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const body: ReactNode[] = [];
  const questions: ReactNode[] = [];
  part.blocks.forEach((block, index) => {
    const text = <RichText text={block.text} partSlug={part.slug} />;
    if (block.kind === 'li') {
      questions.push(
        <li key={block.text} className="grid grid-cols-[3rem_1fr] border-t border-border py-5">
          <span className="pt-2 font-mono text-report-label text-label tabular-nums">
            {String(questions.length + 1).padStart(2, '0')}
          </span>
          <span className="text-report-heading leading-[1.08] tracking-[-0.03em] text-balance">
            {text}
          </span>
        </li>,
      );
      return;
    }
    if (questions.length > 0) {
      body.push(
        <ol key={`questions-${String(index)}`} className="my-8 border-b border-border">
          {questions.splice(0)}
        </ol>,
      );
    }
    body.push(
      <Reveal key={block.text}>
        <p className="my-6">{text}</p>
      </Reveal>,
    );
    // The two values of the second paragraph stand alone after it.
    if (index === 1)
      body.push(
        <div key="numbers" className="my-14 grid gap-14 border-y border-border py-10">
          {copy.numbers.map((one) => (
            <BigNumber
              key={one.value}
              value={one.value}
              label={one.label}
              note={{ partSlug: part.slug, id: one.note }}
            />
          ))}
        </div>,
      );
  });
  if (questions.length > 0) body.push(<ol key="questions-end">{questions}</ol>);
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} quote={copy.quote}>
        {/* In the flow on a phone; in the empty right half of the break on a wide screen. */}
        <figure className="m-0 mt-10 lg:absolute lg:top-16 lg:right-8 lg:mt-0 lg:w-[46%]">
          <img
            src={copy.art.src}
            alt={copy.art.alt}
            width={1440}
            height={546}
            loading="lazy"
            decoding="async"
            // The dither is black on white: it multiplies onto paper, and inverts onto the dark.
            className="block h-auto w-full mix-blend-multiply [image-rendering:pixelated] dark:mix-blend-screen dark:invert"
          />
          <figcaption className="mt-2 font-mono text-report-label/4 text-label ">
            <span className=" text-foreground">{copy.art.label}</span>{' '}
            <a
              href={copy.art.href}
              className="underline decoration-border underline-offset-2 hover:text-foreground"
            >
              {copy.art.credit}
            </a>
          </figcaption>
        </figure>
      </ChapterBreak>
      <div className="py-16 md:py-24 lg:grid lg:grid-cols-12 lg:gap-8">
        <aside aria-label={copy.timelineLabel} className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-[calc(var(--report-bar,0px)+2rem)]">
            <p className={monoLabel}>{copy.timelineLabel}</p>
            <ol className="mt-4 border-l border-border">
              {copy.timeline.map((mark) => (
                <li key={mark.date} className="relative py-3 pl-4">
                  <span
                    aria-hidden="true"
                    className="absolute top-[1.1rem] -left-[3px] size-[5px] bg-foreground"
                  />
                  <span className="block font-mono text-report-label text-foreground">
                    {mark.date}
                  </span>
                  <span className="block text-report-small text-foreground/75">{mark.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
        <div className="max-w-[64ch] text-report-body/[1.65]  lg:col-span-8 lg:col-start-5">
          {body}
        </div>
      </div>
    </section>
  );
}
