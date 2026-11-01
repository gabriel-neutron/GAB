import { Fragment, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock, ReportPart } from '../content';
import { NodeIndex } from '../node-index';
import { CountUp } from '../primitives/count-up';
import { recordCounts } from '../record-counts';
import { RichText } from '../rich-text';
import { reportGraph } from '../report-graph';
import nodes from '../nodes-data';
import { sources } from '../source';
import { useContent } from '../use-content';
import { ClosingBreak } from './closing-art';

const KEY = /^\*\*(.+?):?\*\*:?\s*/;
const CODE = /^(A\.\d+)\s+(.*)$/;
const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
const REGISTER_ROWS = 14;
// The spec takes the record counts from the final English text in every locale.
const record = recordCounts(sources.en);
// The anchor of a section of the annex, from its code: A.1 is "annex-a-1".
const anchor = (code: string) => `annex-${code.toLowerCase().replace('.', '-')}`;

interface Section {
  readonly heading: string;
  readonly blocks: ReportBlock[];
}

/** One numbered list of the annex: the rules of A.2 or the conditions of A.3, as a grid of cells. */
function Cells({
  items,
  partSlug,
}: {
  readonly items: readonly ReportBlock[];
  readonly partSlug: string;
}) {
  const three = items.length === 3;
  return (
    <ol
      className={cn(
        'my-6 grid gap-px border border-border bg-border',
        three ? 'md:grid-cols-3' : 'md:grid-cols-2',
      )}
    >
      {items.map((block, index) => {
        const match = KEY.exec(block.text);
        const rest = match === null ? block.text : block.text.slice(match[0].length);
        return (
          <li key={index} className="bg-background p-4 md:p-5">
            {match === null ? null : (
              <p className="mb-3 font-mono text-report-label uppercase text-signal">{match[1]}</p>
            )}
            <p className="text-report-small/6">
              <RichText text={rest} partSlug={partSlug} />
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The annex: the method as a compact technical sheet (one row per section, mono codes, grids of
 * rules and conditions), every node of the report, the scale of the research in small, and the
 * way to the notes as the end of the page. */
export function AnnexMethodPart({ part }: { readonly part: ReportPart }) {
  const { closingUi, parts, ui } = useContent();
  const { annex: copy } = closingUi;
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const sections: Section[] = [];
  for (const block of part.blocks) {
    if (block.kind === 'h3') sections.push({ heading: block.text, blocks: [] });
    else sections.at(-1)?.blocks.push(block);
  }
  // The final text gives the date of the counts in A.1, with no note: the date line links there.
  const dated = CODE.exec(sections[0]?.heading ?? '')?.[1];
  const { counts } = reportGraph;
  const groups = [
    {
      label: copy.record,
      counts: [
        [copy.entities, record.entities],
        [copy.critical, record.critical],
        [copy.official, record.official],
      ],
    },
    {
      label: copy.report,
      counts: [
        [ui.counters.nodes, counts.nodes],
        [ui.counters.relations, counts.relations],
        [ui.counters.documents, counts.documents],
        [ui.counters.sources, counts.sources],
      ],
    },
  ] as const;
  const count = new Intl.NumberFormat(copy.locale);
  const format = (value: number) => count.format(Math.round(value));
  const date = new Intl.DateTimeFormat(copy.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(record.date);
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ClosingBreak
        number={number}
        title={part.title}
        className="top-[8%] right-8 w-[46%]"
        art={
          // A page of the register: the first rows of the node data, as they are written.
          // The right edge fades out, so a cut name reads as the edge of a longer page.
          <ol className="mask-r-from-70% font-mono text-report-label/[1.9] text-foreground/35 ">
            {nodes.slice(0, REGISTER_ROWS).map((node) => (
              <li
                key={node.node_id}
                className="grid grid-cols-[4.5rem_6rem_2rem_minmax(0,1fr)] gap-x-3 border-b border-border whitespace-nowrap max-md:nth-[n+11]:hidden md:grid-cols-[5.5rem_8rem_2.5rem_minmax(0,1fr)]"
              >
                <span className="text-label">{node.node_id}</span>
                <span className="truncate">{node.type}</span>
                <span>{node.country_code}</span>
                <span className="truncate">{node.name}</span>
              </li>
            ))}
          </ol>
        }
      />
      <div className="py-16 md:py-24">
        {sections.map((section, sectionIndex) => {
          const match = CODE.exec(section.heading);
          const body: ReactNode[] = [];
          let list: ReportBlock[] = [];
          const flush = () => {
            if (list.length === 0) return;
            body.push(<Cells key={list[0]?.text} items={list} partSlug={part.slug} />);
            list = [];
          };
          for (const block of section.blocks) {
            if (block.kind === 'li') {
              list.push(block);
              continue;
            }
            flush();
            body.push(
              <p key={block.text} className="my-4 max-w-[64ch] text-report-body/[1.6]">
                <RichText text={block.text} partSlug={part.slug} />
              </p>,
            );
          }
          flush();
          return (
            <Fragment key={section.heading}>
              <div
                id={match === null ? undefined : anchor(match[1] ?? '')}
                className={cn(
                  'grid scroll-mt-[calc(var(--report-bar,0px)+3rem)] gap-x-8 py-8 lg:grid-cols-12',
                  // The chapter break above already draws the first rule.
                  sectionIndex > 0 && 'border-t border-border',
                )}
              >
                <h3 className="lg:col-span-3">
                  <span className="block font-mono text-report-label text-label tabular-nums">
                    {match?.[1]}
                  </span>
                  <span className="mt-2 block text-report-lead leading-tight tracking-[-0.02em] text-balance">
                    {match?.[2] ?? section.heading}
                  </span>
                </h3>
                <div className="min-w-0 lg:col-span-9">{body}</div>
              </div>
            </Fragment>
          );
        })}
      </div>
      <NodeIndex />
      <footer className="border-t border-foreground pt-6 pb-24">
        <section aria-label={ui.counters.label} className="grid gap-8 md:grid-cols-2">
          {groups.map((group, index) => (
            <div
              key={group.label}
              className={cn(index > 0 && 'md:border-l md:border-border md:pl-8')}
            >
              <h3 className="font-mono text-report-label uppercase text-label">{group.label}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                {group.counts.map(([term, value]) => (
                  <div
                    key={term}
                    className="flex flex-col-reverse gap-1 border-t border-divider pt-2"
                  >
                    <dt className="font-mono text-report-label text-label">{term}</dt>
                    <dd className="font-mono text-report-lead text-foreground tabular-nums">
                      <CountUp value={value} format={format} />
                    </dd>
                  </div>
                ))}
              </dl>
              {index > 0 ? null : (
                <p className="mt-3 max-w-[64ch] font-mono text-report-label text-label">
                  {copy.recordSource.replace('{date}', date)}
                  {dated === undefined ? null : (
                    <>
                      {' · '}
                      <a href={`#${anchor(dated)}`} className={cn('underline', FOCUS)}>
                        {dated}
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          ))}
        </section>
        <Link
          to="/bibliography"
          className={cn(
            'group mt-16 flex min-h-11 items-end justify-between gap-6 border-b border-foreground pb-4',
            FOCUS,
          )}
        >
          <span className="text-report-number leading-[0.95] tracking-[-0.045em] text-balance">
            {ui.bibliography.title}
          </span>
          <span
            aria-hidden="true"
            className="font-mono text-report-number leading-none transition-transform duration-150 group-hover:translate-x-2 motion-reduce:transition-none"
          >
            →
          </span>
        </Link>
      </footer>
    </section>
  );
}
