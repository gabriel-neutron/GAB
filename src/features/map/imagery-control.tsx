import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import {
  describeImagery,
  isImagery,
  isImageryKind,
  SOURCE_NAME,
  stepImagery,
  withKind,
  type Imagery,
} from './imagery';

export interface ImageryControlProps {
  readonly imagery: Imagery;
  readonly onChange: (imagery: Imagery) => void;
}

// The kit select is a Radix control, and its list is a portal. A native select keeps its list in
// the browser and needs no portal over a live canvas, so it takes these classes by hand.
const CHOOSER = cn(
  'h-6 min-w-0 border border-input bg-transparent px-1 text-small/4 text-popover-foreground',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

// The kit writes `transition-all` with no duration, which runs above the 120 ms ceiling.
const STEP = cn('transition-colors duration-100');

export function ImageryControl({ imagery, onChange }: ImageryControlProps) {
  const words = describeImagery(imagery);
  const pick = words.pick;
  const previous = stepImagery(imagery, -1);
  const next = stepImagery(imagery, 1);

  return (
    <div
      className={cn(
        // It floats over a canvas, so `pointer-events-auto` takes the pointer back from it.
        'pointer-events-auto flex w-64 flex-col gap-1 p-2',
        'border border-border bg-popover text-popover-foreground',
      )}
    >
      <select
        aria-label="Imagery source"
        value={imagery.kind}
        className={CHOOSER}
        onChange={(event) => {
          const kind: unknown = event.target.value;
          if (isImageryKind(kind)) onChange(withKind(imagery, kind));
        }}
      >
        <option value="eox">{SOURCE_NAME.eox}</option>
        <option value="gibs-s30">{SOURCE_NAME['gibs-s30']}</option>
        <option value="gibs-l30">{SOURCE_NAME['gibs-l30']}</option>
      </select>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={`Previous ${pick.unit}`}
          disabled={previous === imagery}
          className={STEP}
          onClick={() => {
            onChange(previous);
          }}
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </Button>

        {pick.unit === 'year' ? (
          <select
            aria-label="Year"
            value={pick.year}
            className={cn(CHOOSER, 'flex-1 font-mono tabular-nums')}
            onChange={(event) => {
              const candidate: unknown = { kind: 'eox', year: Number(event.target.value) };
              if (isImagery(candidate)) onChange(candidate);
            }}
          >
            {pick.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        ) : (
          <Input
            type="date"
            aria-label="Day"
            min={pick.min}
            max={pick.max}
            value={pick.day}
            // The kit sets a 32 px height and a base text size. The density block asks for 24 px.
            className="h-6 flex-1 px-1 font-mono text-small/4 tabular-nums md:text-small/4"
            onChange={(event) => {
              const candidate: unknown = { kind: imagery.kind, day: event.target.value };
              if (isImagery(candidate)) onChange(candidate);
            }}
          />
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={`Next ${pick.unit}`}
          disabled={next === imagery}
          className={STEP}
          onClick={() => {
            onChange(next);
          }}
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <p data-citation className="text-small/4">
        {`${words.source} · ${words.date} · ${words.resolution} · ${words.licence}`}
      </p>
      {/* The credit is the obligation of the licence, whole. A citation by hand copies it. */}
      <p data-credit className="text-small/4 text-muted-foreground">
        {words.credit}
      </p>
      {words.caution === null ? null : (
        <p className="text-small/4 text-muted-foreground">{words.caution}</p>
      )}
    </div>
  );
}
