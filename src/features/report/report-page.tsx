import { parts, ui } from './content';
import { PartBar } from './part-bar';
import { PartDefault } from './parts/part-default';
import { partComponents } from './parts';
import { ReportCover } from './report-cover';
import { ReportFrame } from './report-frame';

/** The report at the root of the site: the cover, the part bar, the parts in their order, and
 * every node in the annex. The page is the width container of the full-width blocks, and it sets
 * the height of the view under the part bar. */
export function ReportPage() {
  return (
    <ReportFrame label={ui.reportLabel}>
      {/* The site header takes 3.5rem; the part bar takes 2rem on a phone and 2.75rem above. */}
      <div className="@container [--report-bar:2rem] [--report-view:calc(100svh-5.5rem)] md:[--report-bar:2.75rem] md:[--report-view:calc(100svh-6.25rem)]">
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
