import { cn } from '@/shared/lib/utils';

import { typeCountLine, type TypeCount } from './type-counts';

interface TypeCountListProps {
  readonly counts: readonly TypeCount[];
}

// The map draws the entities with a position only. The list gives each type its part on the map,
// against the whole that the graph counts, so the two screens state the same totals.
export function TypeCountList({ counts }: TypeCountListProps) {
  if (counts.length === 0) return null;
  return (
    <ul aria-label="Entities on the map, by type" className={cn('flex max-w-prose flex-col')}>
      {counts.map((count) => {
        const line = typeCountLine(count);
        return (
          <li key={count.type} data-type={count.type} className={cn('flex gap-2')}>
            <span className={cn('w-32 shrink-0')}>{count.label}</span>
            <span className={cn('font-mono tabular-nums')}>{line.figure}</span>
            {line.note === null ? null : (
              <span className={cn('text-muted-foreground')}>{line.note}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
