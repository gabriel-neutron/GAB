import { Fragment, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/utils';
import { closingUi, openingUi, parts, ui, type ReportBlock, type ReportPart } from '../content';
import { NodeIndex } from '../node-index';
import { NoteRef } from '../note-ref';
import { RichText } from '../rich-text';
import { reportGraph } from '../report-graph';
import nodes from '../nodes-data';
import { ClosingBreak } from './closing-art';

const { annex: copy } = closingUi;
const KEY = /^\*\*(.+?)\*\*:?\s*/;
const CODE = /^(A\.\d+)\s+(.*)$/;
const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
const count = new Intl.NumberFormat('en-GB');
const REGISTER_ROWS = 14;

interface Section {
  readonly heading: string;
  readonly blocks: ReportBlock[];
}

/** One numbered list of the annex: the rules of A.2 or the conditions of A.3, as a grid of cells. */
function Cells({
  items,
  label,
  partSlug,
}: {
  readonly items: readonly ReportBlock[];
  readonly label: string;
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
            <p className="font-mono text-report-label uppercase text-label">
              {label} <span className="text-foreground tabular-nums">{index + 1}</span>
            </p>
            {match === null ? null : (
              <p className="mt-3 font-mono text-report-label uppercase text-signal">{match[1]}</p>
            )}
            <p className="mt-3 text-report-small/6">
              <RichText text={rest} partSlug={partSlug} />
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The annex: the method as a compact technical sheet (one row per section, mono codes, grids of
 * rules and conditions), the scale of the research in small, every node of the report, and the
 * way to the notes as the end of the page. */
export function AnnexMethodPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const sections: Section[] = [];
  for (const block of part.blocks) {
    if (block.kind === 'h3') sections.push({ heading: block.text, blocks: [] });
    else sections.at(-1)?.blocks.push(block);
  }
  const { counts } = reportGraph;
  const scale = [
    [ui.counters.nodes, counts.nodes],
    [ui.counters.relations, counts.relations],
    [ui.counters.documents, counts.documents],
    [ui.counters.sources, counts.sources],
  ] as const;
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ClosingBreak
        number={number}
        title={part.title}
        quote={copy.quote}
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
            body.push(
              <Cells
                key={list[0]?.text}
                items={list}
                label={list.length === 3 ? copy.condition : copy.rule}
                partSlug={part.slug}
              />,
            );
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
                className={cn(
                  'grid gap-x-8 py-8 lg:grid-cols-12',
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
              {sectionIndex === 0 ? (
                <figure className="mb-12 border-t border-foreground pt-6">
                  <dl className="grid gap-y-8 sm:grid-cols-3 sm:gap-x-6">
                    {copy.figures.map((one) => (
                      <div key={one.value} className="flex flex-col-reverse justify-end gap-3">
                        <dt className="font-mono text-report-label/4 uppercase text-label">
                          {one.label}
                        </dt>
                        <dd className="text-report-number leading-none tracking-[-0.045em] whitespace-nowrap tabular-nums">
                          {one.qualifier === undefined ? null : (
                            <span className="mr-2 font-mono text-report-label tracking-normal text-label uppercase">
                              {one.qualifier}
                            </span>
                          )}
                          {one.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <figcaption className="mt-6 border-t border-border pt-3 font-mono text-report-label text-label">
                    {copy.figuresDate}
                    <NoteRef partSlug={part.slug} id={copy.figuresNote} />
                  </figcaption>
                </figure>
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <NodeIndex />
      <footer className="border-t border-foreground pt-6 pb-24">
        <section aria-label={copy.scale}>
          <p className="font-mono text-report-label uppercase text-label">{copy.scale}</p>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {scale.map(([term, value]) => (
              <div key={term} className="flex flex-row-reverse items-baseline gap-2 font-mono">
                <dt className="text-report-label uppercase text-label">{term}</dt>
                <dd className="text-report-label text-foreground tabular-nums">
                  {count.format(value)}
                </dd>
              </div>
            ))}
          </dl>
          {/* The nodes are not the entities of A.1: the tie line and note S-3 say which they are. */}
          <p className="mt-3 max-w-[64ch] font-mono text-report-label text-label">
            {closingUi.conclusion.dataDate}
            <NoteRef partSlug="summary" id={openingUi.summary.entities.note} />
          </p>
          <p className="mt-3 max-w-[64ch] text-report-small/6 text-foreground/75">
            {openingUi.counters.tie}
          </p>
        </section>
        <Link
          to="/bibliography"
          className={cn(
            'group mt-16 flex min-h-11 items-end justify-between gap-6 border-b border-foreground pb-4',
            FOCUS,
          )}
        >
          <span>
            <span className="block font-mono text-report-label text-label">{copy.notes}</span>
            <span className="mt-3 block text-report-number leading-[0.95] tracking-[-0.045em] text-balance">
              {ui.bibliography.title}
            </span>
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
