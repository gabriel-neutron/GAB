import { ArrowRight, Minus, Pencil, Plus } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { CitedDocument, DifferenceRow, RowOp } from './queue';
import { SourceBadge } from './sources';

export interface DifferenceProps {
  readonly rows: readonly DifferenceRow[];
}

/** A value takes the flat fill of a read-only control, and keeps its own contrast. */
const VALUE = 'block min-w-0 flex-1 truncate px-1.5 font-mono text-xs tabular-nums';

const STANDING_SIDE = 'the value the record holds';
const PROPOSED_SIDE = 'the value this act asks for';

const OP_GLYPH: Readonly<Record<RowOp, typeof Plus>> = {
  add: Plus,
  edit: Pencil,
  remove: Minus,
};

const OP_PAINT: Readonly<Record<RowOp, string>> = {
  add: 'text-added',
  edit: 'text-candidate',
  remove: 'text-dissent',
};

const OP_WORDS: Readonly<Record<RowOp, string>> = {
  add: 'a key the record does not hold',
  edit: 'a key the record holds',
  remove: 'a key this act takes away',
};

interface SideProps {
  readonly value: string | null;
  readonly sources: readonly CitedDocument[];
  readonly side: string;
  readonly className: string;
}

function Side({ value, sources, side, className }: SideProps) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <span className="sr-only">{side}</span>
      <span className={cn(VALUE, className)} title={value ?? undefined}>
        {value}
      </span>
      {sources.map((source) => (
        <SourceBadge key={source.id} source={source} />
      ))}
    </span>
  );
}

/** The mark before the key says what the act does to it, so no header names a column, and each
 * side that is drawn says its own name to a reader who hears the row. Each side carries the
 * documents that hold that side up, and the two are never one list. */
export function Difference({ rows }: DifferenceProps) {
  return (
    <div className="max-w-[32rem] space-y-1.5">
      {rows.map((row) => {
        const Glyph = OP_GLYPH[row.op];
        return (
          <div key={row.key} data-difference={row.key} data-op={row.op} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Glyph size={14} aria-hidden="true" className={cn('shrink-0', OP_PAINT[row.op])} />
              <span className="sr-only">{OP_WORDS[row.op]}</span>
              <span
                className="min-w-0 flex-1 truncate font-mono text-small/4 text-label"
                title={row.key}
              >
                {row.key}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* An addition holds nothing on the left, so it draws nothing there, and it names
                  no side there: a name over a blank reads as a value. */}
              {row.op === 'add' ? null : (
                <>
                  <Side
                    value={row.standing}
                    sources={row.standingSources}
                    side={STANDING_SIDE}
                    // A tint under the figure took it under 4.5 on the dark ground. The rule
                    // through the value is the mark, and the chrome ground holds 6.12 at worst.
                    className={
                      row.op === 'remove' ? 'bg-muted text-dissent line-through' : 'bg-muted'
                    }
                  />
                  {row.op === 'remove' ? null : (
                    <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-label" />
                  )}
                </>
              )}
              {row.proposed === null ? null : (
                <Side
                  value={row.proposed}
                  sources={row.proposedSources}
                  side={PROPOSED_SIDE}
                  className={cn('border', row.op === 'add' ? 'border-added' : 'border-input')}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
