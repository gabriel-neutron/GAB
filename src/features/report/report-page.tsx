import { Fragment } from 'react';
import { parts, ui } from './content';
import { NodeIndex } from './node-index';
import { PartDefault } from './parts/part-default';
import { partComponents } from './parts';
import { ReportCover } from './report-cover';
import { ReportFrame } from './report-frame';
import { ScaleCounters } from './scale-counters';

/** The report at the root of the site: the cover, the parts in their order, the scale of the
 * research after the summary, and every node at the end. */
export function ReportPage() {
  return (
    <ReportFrame label={ui.reportLabel}>
      <ReportCover />
      <article className="mx-auto max-w-[1200px] px-4 pt-10 md:px-8">
        {parts.map((part) => {
          const Part = partComponents[part.slug] ?? PartDefault;
          return (
            <Fragment key={part.slug}>
              <Part part={part} />
              {part.slug === 'summary' ? <ScaleCounters /> : null}
            </Fragment>
          );
        })}
        <NodeIndex />
      </article>
    </ReportFrame>
  );
}
