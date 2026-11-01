import { Suspense } from 'react';
import { HydrateNear } from './hydrate-near';
import { PartBar } from './part-bar';
import { PartDefault } from './parts/part-default';
import { partComponents } from './parts';
import { ReportCover } from './report-cover';
import { ReportFrame } from './report-frame';
import { useContent } from './use-content';

/** The report at the root of the site: the cover, the part bar, the parts in their order, and
 * every node in the annex. The page is the width container of the full-width blocks, and it sets
 * the height of the view under the part bar. */
export function ReportPage() {
  const { parts, ui } = useContent();
  return (
    <ReportFrame label={ui.reportLabel}>
      {/* The view is the height of the scroll region (100cqh: the frame is a size container), so
          the site header and the foot bar are out of it; the part bar takes 2rem on a phone and
          2.75rem above. The clip keeps the visually hidden data tables from a horizontal scroll;
          it keeps sticky. */}
      <div className="@container overflow-x-clip [--report-bar:2rem] [--report-view:calc(100cqh-2rem)] md:[--report-bar:2.75rem] md:[--report-view:calc(100cqh-2.75rem)]">
        <ReportCover />
        <PartBar />
        <article className="mx-auto max-w-[1200px] px-4 md:px-8">
          {parts.map((part, index) => {
            const Part = partComponents[part.slug] ?? PartDefault;
            // The browser lays out and paints a part only near the view, and the client hydrates
            // it only near the view, so the first paint and the hydration do not do the work of
            // the whole page. The HTML holds the full text all the time. Measure the slot of a
            // part, not an element in it: a measure in a part far from the view lays it out. The
            // first part is in the first view, so it paints with the cover.
            return (
              <div
                key={part.slug}
                data-part={part.slug}
                className={
                  index === 0
                    ? undefined
                    : '[contain-intrinsic-size:auto_2000px] [content-visibility:auto]'
                }
              >
                <Suspense fallback={null}>
                  <HydrateNear slug={part.slug}>
                    <Part part={part} />
                  </HydrateNear>
                </Suspense>
              </div>
            );
          })}
        </article>
      </div>
    </ReportFrame>
  );
}
