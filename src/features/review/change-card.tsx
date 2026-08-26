import { Split, TrendingDown, TriangleAlert } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import { ChangeMark } from './change-mark';
import { Confidence } from './confidence';
import { Difference } from './difference';
import { Holes } from './holes';
import type { Change, Routing } from './queue';
import { SourceBadge } from './sources';

export interface ChangeCardProps {
  readonly change: Change;
  /** The act the controls at the foot act on. Two cards stand open when a key is contested. */
  readonly current: boolean;
}

/** A mark and never a sentence. `unstated` draws no mark: while no threshold reaches this screen
 * almost every act carries it, and a mark on every card marks nothing. It draws the words. */
const ROUTING_GLYPH: Readonly<Record<Routing, typeof Split | null>> = {
  dissent: Split,
  'low-confidence': TrendingDown,
  both: Split,
  neither: TriangleAlert,
  unstated: null,
};

const ROUTING_PAINT: Readonly<Record<Routing, string>> = {
  dissent: 'text-dissent',
  'low-confidence': 'text-candidate',
  both: 'text-dissent',
  neither: 'text-candidate',
  unstated: 'text-label',
};

export function ChangeCard({ change, current }: ChangeCardProps) {
  const Routed = ROUTING_GLYPH[change.routing];
  const low = change.routing === 'low-confidence' || change.routing === 'both';
  // A relation, a merge, and a deletion whose row is absent name no value. Only then do the
  // documents of the act stand on the card: a row that is drawn already carries its own.
  const actSources = change.rows.length === 0 && change.sources.length > 0;

  return (
    <article
      data-change={change.id}
      aria-current={current ? 'true' : undefined}
      className={cn(
        // The left rule and the raised ground say which card the controls act on. A word cannot:
        // at the width of two cards it is clipped, and it is clipped where it matters most.
        'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2',
        'overscroll-contain border border-border border-l-2',
        current ? 'border-l-primary bg-card' : 'border-l-transparent',
      )}
    >
      <span className="sr-only">
        {current ? 'The controls act on this one' : 'Read beside the act under the controls'}
      </span>

      <div className="flex h-6 shrink-0 items-center gap-2">
        <ChangeMark kind={change.kind} kindWords={change.kindWords} />
        <Confidence report={change.confidenceReport} low={low} />
        {Routed === null ? (
          <span
            data-routing={change.routing}
            title={change.routingWords}
            className="min-w-0 truncate text-small/4 text-label"
          >
            {change.routingWords}
          </span>
        ) : (
          <span
            data-routing={change.routing}
            title={change.routingWords}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 text-small/4',
              ROUTING_PAINT[change.routing],
            )}
          >
            <Routed size={14} aria-hidden="true" />
            {change.routingShort}
            <span className="sr-only">{change.routingWords}</span>
          </span>
        )}
      </div>

      {change.headline === '' ? null : <p className="text-xs">{change.headline}</p>}

      {/* One source display, and never two. A value carries its own documents; the act carries
          them only where it asks for no value. */}
      {actSources ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="sr-only">The documents this act stands on</span>
          {change.sources.map((source) => (
            <SourceBadge key={source.id} source={source} />
          ))}
        </div>
      ) : null}

      {change.rows.length === 0 ? null : <Difference rows={change.rows} />}

      <Holes holes={change.holes} />
    </article>
  );
}
