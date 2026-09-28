import { ChevronDown, ChevronRight } from 'lucide-react';

import type { NestedRow } from '@/shared/fold-subordinates';
import { cn } from '@/shared/lib/utils';

export interface FolderToggleProps {
  readonly unit: NestedRow;
  /** The name of the unit, so the control says whose subordinates it opens. */
  readonly name: string;
  readonly onOpen: (unit: string, open: boolean) => void;
}

// Origin: 12px per level is half a row, so ten levels still leave a name room in the narrowest
// rail.
const INDENT_PX = 12;

const CONTROL = cn(
  'pointer-events-auto flex size-6 shrink-0 items-center justify-center border border-transparent',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

// Departure: a line with no subordinate keeps an empty cell of the same width, so each name of
// one level starts at the same place.
export function FolderToggle({ unit, name, onOpen }: FolderToggleProps) {
  const count = unit.subordinates === 1 ? '1 subordinate' : `${unit.subordinates} subordinates`;
  return (
    <>
      {unit.depth === 0 ? null : (
        <span
          aria-hidden="true"
          style={{ width: unit.depth * INDENT_PX }}
          className="shrink-0"
          data-depth={unit.depth}
        />
      )}
      {unit.subordinates === 0 ? (
        <span aria-hidden="true" className="size-6 shrink-0" />
      ) : (
        <button
          type="button"
          aria-expanded={unit.open}
          aria-label={unit.open ? `Close the ${count} of ${name}` : `Open the ${count} of ${name}`}
          data-folder={unit.id}
          onClick={() => {
            onOpen(unit.id, !unit.open);
          }}
          className={CONTROL}
        >
          {unit.open ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </button>
      )}
    </>
  );
}
