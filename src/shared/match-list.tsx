import { cn } from '@/shared/lib/utils';
import type { ScreenMatches } from '@/shared/screen-matches';

interface MatchListProps {
  readonly id: string;
  readonly matches: ScreenMatches;
  readonly active: number | null;
  readonly onChoose: (id: string) => void;
}

export const matchOptionId = (listId: string, index: number): string =>
  `${listId}-${String(index)}`;

export function MatchList({ id, matches, active, onChoose }: MatchListProps) {
  return (
    <div
      className={cn(
        'absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-border bg-popover py-1',
        'text-xs text-popover-foreground shadow-md',
      )}
    >
      <ul id={id} role="listbox" aria-label="Names that match the filter">
        {matches.shown.map((match, index) => (
          <li
            key={match.id}
            id={matchOptionId(id, index)}
            role="option"
            aria-selected={index === active}
            // External constraint: a press moves the focus before the click lands, and the field
            // closes this list when it loses the focus. So the press keeps the focus in the field.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              onChoose(match.id);
            }}
            className={cn(
              'flex h-6 cursor-pointer items-center truncate px-2',
              index === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
            title={match.label}
          >
            {match.label}
          </li>
        ))}
      </ul>
      {matches.more === 0 ? null : (
        <p className="flex h-6 items-center px-2 text-label">
          {matches.more === 1
            ? '1 more name matches.'
            : `${String(matches.more)} more names match.`}
        </p>
      )}
    </div>
  );
}
