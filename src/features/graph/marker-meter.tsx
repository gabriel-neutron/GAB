import { cn } from '@/shared/lib/utils';

interface MarkerMeterProps {
  /** The elements that carry a marker on the canvas. */
  readonly drawn: number;
  /** The elements that carry pending evidence and no marker, because of the cap. */
  readonly hidden: number;
}

/** The share of the pending markers that the canvas draws, as a bar: the filled part is drawn, the
 * hollow part is cut by the cap. It is absent when the cap cuts nothing. */
export function MarkerMeter({ drawn, hidden }: MarkerMeterProps) {
  if (hidden <= 0) return null;
  const total = drawn + hidden;
  return (
    <div
      role="status"
      title={`${String(hidden)} markers not drawn`}
      className={cn(
        'pointer-events-auto absolute right-2 bottom-20 z-10 flex h-6 items-center gap-1.5',
        'border border-border bg-background px-1.5 text-small/4',
      )}
    >
      {/* The same square as a marker on the canvas, so the bar names what it counts. */}
      <span aria-hidden="true" className="size-2 shrink-0 border border-background bg-candidate" />
      <span aria-hidden="true" className="flex h-2 w-20 border border-candidate">
        <span
          className="h-full bg-candidate"
          style={{ width: `${String((drawn / total) * 100)}%` }}
        />
      </span>
      <span aria-hidden="true" className="font-mono tabular-nums">
        +{hidden}
      </span>
      <span className="sr-only">{`Markers: ${String(drawn)} drawn, ${String(hidden)} not drawn`}</span>
    </div>
  );
}
