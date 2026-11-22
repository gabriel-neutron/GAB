import type { ReportPart } from '../content';
import { Blocks } from '../blocks';
import { ChapterBreak } from '../primitives/chapter-break';
import { useContent } from '../use-content';

/** The recommendations: the chapter break of the closing parts, then the list in the column of
 * the conclusion. */
export function RecommendationsPart({ part }: { readonly part: ReportPart }) {
  const { parts } = useContent();
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} />
      <div className="py-16 text-report-body/[1.65] md:py-24 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8 lg:col-start-3">
          <Blocks blocks={part.blocks} partSlug={part.slug} />
        </div>
      </div>
    </section>
  );
}
