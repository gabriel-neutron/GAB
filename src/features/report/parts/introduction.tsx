import type { ReactNode } from 'react';
import type { ReportPart } from '../content';
import { ChapterBreak } from '../primitives/chapter-break';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';
import { useContent } from '../use-content';

/** The introduction: a chapter break over the tanker photograph in ASCII,
 * then a calm reading column with the three questions. */
export function IntroductionPart({ part }: { readonly part: ReportPart }) {
  const { openingUi, parts } = useContent();
  const { introduction: copy } = openingUi;
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
          <span className="text-report-lead text-balance">{text}</span>
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
  });
  if (questions.length > 0) body.push(<ol key="questions-end">{questions}</ol>);
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} image={copy.art} />
      <div className="py-16 md:py-24 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="max-w-[64ch] text-report-body/[1.65]  lg:col-span-8 lg:col-start-3">
          {body}
        </div>
      </div>
    </section>
  );
}
