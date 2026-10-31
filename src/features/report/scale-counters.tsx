import { Fragment } from 'react';
import { cn } from '@/shared/lib/utils';
import { openingUi, ui } from './content';
import { NoteRef } from './note-ref';
import { accent } from './primitives/accent';
import { BigNumber } from './primitives/big-number';
import { monoLabel } from './primitives/label';
import { NumberRoll } from './primitives/number-roll';
import { reportGraph } from './report-graph';

const number = new Intl.NumberFormat('en-GB');
const { counters: copy, summary } = openingUi;

/** The scale of the research: each count at display size in one sentence, then the entities of
 * the database as the one anchor value, and the line that ties the nodes to them. Each count is
 * read from the data and counts up like the values of the findings. */
export function ScaleCounters() {
  const { counts } = reportGraph;
  const values = [counts.nodes, counts.relations, counts.documents, counts.sources];
  return (
    <section aria-label={ui.counters.label} className="mt-16 md:mt-24">
      <h3 className={monoLabel}>{ui.counters.label}</h3>
      <p className="mt-8 max-w-[24ch] text-report-heading leading-[1.05] tracking-[-0.04em] text-balance text-foreground/55 md:mt-12">
        {copy.words.map((word, at) => (
          <Fragment key={word}>
            <span className={cn('tracking-[-0.06em] tabular-nums', accent.text)}>
              <NumberRoll value={number.format(values[at] ?? 0)} />
            </span>{' '}
            {word}
            {at === copy.words.length - 1 ? (
              // At display size the marker scales with the words, tight on the last word.
              <span className="[&_.note-ref]:ml-0 [&_.note-ref]:align-top [&_.note-ref]:text-report-label">
                <NoteRef partSlug="summary" id={summary.entities.note} />
              </span>
            ) : (
              ' '
            )}
          </Fragment>
        ))}
      </p>
      <div className="mt-12 grid gap-8 border-t border-border pt-8 md:mt-16 md:grid-cols-2 md:items-baseline-last md:gap-10">
        <BigNumber
          value={summary.entities.value}
          label={summary.entities.label}
          note={{ partSlug: 'summary', id: summary.entities.note }}
        />
        <p className="max-w-[44ch] text-report-body/[1.55] text-foreground/75">{copy.tie}</p>
      </div>
    </section>
  );
}
