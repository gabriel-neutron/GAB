import { ui } from './content';
import { reportGraph } from './report-graph';

const number = new Intl.NumberFormat('en-GB');

/** The scale of the research in four counts, each one read from the data of the report. */
export function ScaleCounters() {
  const { counts } = reportGraph;
  const items = [
    [ui.counters.nodes, counts.nodes],
    [ui.counters.relations, counts.relations],
    [ui.counters.documents, counts.documents],
    [ui.counters.sources, counts.sources],
  ] as const;
  return (
    <section aria-label={ui.counters.label} className="border-t border-border py-10">
      <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        {items.map(([term, value]) => (
          <div key={term} className="flex flex-col-reverse gap-2 bg-background py-4 pr-4">
            <dt className="font-mono text-caption uppercase text-label">{term}</dt>
            <dd className="font-mono text-heading tabular-nums md:text-heading-lg">
              {number.format(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
