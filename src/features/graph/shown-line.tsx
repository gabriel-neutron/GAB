import { cn } from '@/shared/lib/utils';

import type { ShownOfTotal } from './shown-counts';

interface ShownLineProps {
  readonly entities: ShownOfTotal;
  readonly relations: ShownOfTotal;
}

const figure = (count: ShownOfTotal, one: string, many: string): string =>
  `${String(count.shown)} of ${String(count.total)} ${count.total === 1 ? one : many}`;

// The line states the part of the record that the drawing shows. A type switch dims and never hides, so the
// hint says what a switch does to this count.
export function ShownLine({ entities, relations }: ShownLineProps) {
  return (
    <p
      data-shown-entities={entities.shown}
      data-total-entities={entities.total}
      className={cn('max-w-prose text-muted-foreground')}
    >
      {`Showing ${figure(entities, 'entity', 'entities')}, ${figure(relations, 'relation', 'relations')}.`}{' '}
      A type switch dims that type and takes it out of this count. The filter box narrows the lists
      only.
    </p>
  );
}
