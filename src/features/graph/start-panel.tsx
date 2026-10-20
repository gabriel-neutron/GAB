import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import { startChoices, type ChoosableEntity } from './start-choice';

interface StartPanelProps {
  /** Every entity that may start the graph, the most connected first. */
  readonly named: readonly ChoosableEntity[];
  readonly onChoose: (id: string) => void;
  readonly onShowWholeGraph: () => void;
}

// How many names the list holds. Origin: invented; they fill the height of the island.
const SHOWN = 8;

const ROW_CLASS = cn(
  'flex h-6 w-full items-baseline justify-between gap-2 px-1 text-left text-xs',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

export function StartPanel({ named, onChoose, onShowWholeGraph }: StartPanelProps) {
  const [text, setText] = useState('');
  const choice = startChoices(named, text, SHOWN);
  const searching = text.trim() !== '';

  return (
    <section
      aria-label="Start the graph"
      className={cn(
        'absolute top-2 left-2 z-10 flex max-h-[calc(100%-1rem)] w-72 max-w-[calc(100%-1rem)]',
        'flex-col gap-2 overflow-y-auto border border-border bg-background p-2 text-xs',
      )}
    >
      <p>Choose an entity. The graph draws it with its neighbours.</p>
      <Input
        type="search"
        autoComplete="off"
        aria-label="Search an entity by name"
        placeholder="Search an entity by name"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className="h-7"
      />
      <p className="text-muted-foreground">
        {searching
          ? `${String(choice.shown.length)} of ${String(choice.total)} entities match.`
          : 'The most connected entities:'}
      </p>
      <ul>
        {choice.shown.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => {
                onChoose(row.id);
              }}
              className={ROW_CLASS}
            >
              <span className="min-w-0 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 text-right font-mono text-muted-foreground tabular-nums">
                {row.degree}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onShowWholeGraph}
        className={cn(
          'h-6 border border-input bg-background px-2 text-left text-xs text-foreground',
          'transition-colors duration-100 hover:bg-muted',
          'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      >
        Show the whole graph
      </button>
    </section>
  );
}
