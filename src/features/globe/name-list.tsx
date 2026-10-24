import { cn } from '@/shared/lib/utils';

import type { MapName } from './map-rail';

interface NameListProps {
  readonly names: readonly MapName[];
  /** The id of the selected entity, or null. */
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}

const LINE = cn(
  'pointer-events-auto flex min-h-6 w-full min-w-0 items-center px-1 py-0.5 text-left',
  'border border-transparent transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** The names of one type in the rail of the map. A press selects the point and opens its card. */
export function NameList({ names, selected, onSelect }: NameListProps) {
  return (
    <ul>
      {names.map((one) => (
        <li key={one.id}>
          <button
            type="button"
            aria-current={one.id === selected ? 'true' : undefined}
            onClick={() => {
              onSelect(one.id);
            }}
            className={cn(
              LINE,
              one.id === selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            <span className="min-w-0 break-words">{one.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
