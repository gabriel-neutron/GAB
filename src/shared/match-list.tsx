import { cn } from '@/shared/lib/utils';
import { matchParts } from '@/shared/match-span';
import type { ScreenMatches } from '@/shared/screen-matches';

interface MatchListProps {
  readonly id: string;
  readonly matches: ScreenMatches;
  readonly query: string;
  readonly active: number | null;
  readonly onChoose: (id: string) => void;
}

export const matchOptionId = (listId: string, index: number): string =>
  `${listId}-${String(index)}`;

export function MatchList({ id, matches, query, active, onChoose }: MatchListProps) {
  return (
    <div
      className={cn(
        'absolute top-full left-0 z-50 mt-1 w-72 rounded-sm border border-border bg-popover py-1',
        'text-body-sm text-popover-foreground shadow-(--shadow-hairline)',
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
              'flex min-h-8 cursor-pointer items-center px-3 py-0.5 break-words transition-colors duration-150',
              index === active
                ? 'bg-surface-secondary outline-2 -outline-offset-2 outline-ring'
                : 'hover:bg-surface-secondary',
            )}
          >
            <span>
              {matchParts(match.label, query).map((part, at) =>
                part.matched ? (
                  <mark
                    key={at}
                    className="rounded-sm bg-surface-secondary px-0 text-inherit underline underline-offset-2"
                  >
                    {part.text}
                  </mark>
                ) : (
                  part.text
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
      {matches.more === 0 ? null : (
        <p className="flex h-8 items-center px-3 font-mono text-caption uppercase text-label">
          {matches.more === 1
            ? '1 more name matches.'
            : `${String(matches.more)} more names match.`}
        </p>
      )}
    </div>
  );
}
