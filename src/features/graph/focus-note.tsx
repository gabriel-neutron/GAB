import { cn } from '@/shared/lib/utils';

interface FocusNoteProps {
  /** How many nodes the focus draws. */
  readonly drawn: number;
  /** How many of those, and how many relations, stand without a name. */
  readonly unnamed: number;
  readonly unnamedRelations: number;
}

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

// The line appears only where the cap bites. A node without a name reads as a node that the
// record does not name, and the reader must not take it for one.
export function FocusNote({ drawn, unnamed, unnamedRelations }: FocusNoteProps) {
  if (unnamed <= 0 && unnamedRelations <= 0) return null;

  const without = [
    unnamed > 0 ? plural(unnamed, 'node', 'nodes') : null,
    unnamedRelations > 0 ? plural(unnamedRelations, 'relation', 'relations') : null,
  ]
    .filter((part) => part !== null)
    .join(' and ');

  return (
    <p
      role="status"
      data-focus-note={unnamed + unnamedRelations}
      className={cn('max-w-prose text-muted-foreground')}
    >
      The focus draws {plural(drawn, 'node', 'nodes')}. It names the most connected first, and{' '}
      {without} {unnamed + unnamedRelations === 1 ? 'stands' : 'stand'} without a name.
    </p>
  );
}
