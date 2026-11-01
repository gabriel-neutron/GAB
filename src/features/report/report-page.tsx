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
          {parts.map((part) => {
            const Part = partComponents[part.slug] ?? PartDefault;
            return <Part key={part.slug} part={part} />;
          })}
        </article>
      </div>
    </ReportFrame>
  );
}
