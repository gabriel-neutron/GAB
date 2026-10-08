import { useId, useRef, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { proposerWords } from '@/shared/proposer-words';
import { Input } from '@/shared/ui/input';

import { documentName } from './document-name';
import { faultWords } from './fault-marks';
import { filterIsOn, NO_FILTER, type QueueFilter } from './review-workspace';
import { FAULT_KINDS, type FaultKind, type FilterChoices } from './unit-page';

export interface QueueFilterProps {
  readonly filter: QueueFilter;
  readonly choices: FilterChoices;
  /** A part of the filter that changed. The page merges it into the newest filter, so a late
   * name never undoes a choice that came after it. */
  readonly onFilter: (patch: Partial<QueueFilter>) => void;
}

const CHOOSER = cn(
  'h-6 w-full min-w-0 rounded-none border border-input bg-background px-1 text-xs text-foreground',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

type ChipKey = 'group' | 'proposer' | 'fault' | 'document';

const CLEAR: Readonly<Record<ChipKey, Partial<QueueFilter>>> = {
  group: { group: null },
  proposer: { proposer: null },
  fault: { fault: null },
  document: { document: null },
};

// Origin: decided, not calibrated. A pause of this length ends a word, and a fast typist reads the
// queue once per word, not once per key.
const TYPING_PAUSE_MS = 300;

// A value from a list of choices is one of the choices, or "every unit" for the empty value.
const chosen = <T extends string>(value: string, allowed: readonly T[]): T | null =>
  allowed.find((one) => one === value) ?? null;

/** The filters of the queue, at the head of the left column. The name applies after a short
 * pause in the typing, on Enter, or when the field loses the focus, so the queue is not read again
 * at each key. The proposer offers only the proposers that have a unit in the queue. */
export function QueueFilterBar({ filter, choices, onFilter }: QueueFilterProps) {
  const ids = useId();
  // The text in the field dies with the view: the filter that applies is in the workspace.
  const [name, setName] = useState(filter.name);
  // The panel of choices is closed at rest, and it dies with the view.
  const [open, setOpen] = useState(false);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const on = (patch: Partial<QueueFilter>): void => {
    onFilter(patch);
  };
  const stopPause = (): void => {
    if (pause.current !== null) clearTimeout(pause.current);
    pause.current = null;
  };
  const applyName = (typed: string = name): void => {
    stopPause();
    if (typed.trim() !== filter.name) on({ name: typed.trim() });
  };
  const groups = choices.groups.map((group) => group.id);
  const documents = choices.documents.map((document) => document.id);
  const groupName = (id: string): string =>
    choices.groups.find((group) => group.id === id)?.subject ?? 'with no subject';
  const documentOf = (id: string): string => {
    const held = choices.documents.find((document) => document.id === id);
    return held === undefined ? id : documentName({ ...held, uri: null, mime: null });
  };
  const chips: readonly { readonly key: ChipKey; readonly words: string }[] = [
    ...(filter.group === null ? [] : [{ key: 'group' as const, words: groupName(filter.group) }]),
    ...(filter.proposer === null
      ? []
      : [{ key: 'proposer' as const, words: proposerWords(filter.proposer) }]),
    ...(filter.fault === null ? [] : [{ key: 'fault' as const, words: faultWords(filter.fault) }]),
    ...(filter.document === null
      ? []
      : [{ key: 'document' as const, words: documentOf(filter.document) }]),
  ];

  const count = chips.length;
  const select = (
    id: string,
    label: string,
    value: string,
    every: string,
    options: readonly { readonly value: string; readonly words: string }[],
    onChange: (value: string) => void,
  ) => (
    <div className="min-w-0 space-y-0.5">
      <label htmlFor={id} className="text-small/4 text-label">
        {label}
      </label>
      <select
        id={id}
        className={CHOOSER}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">{every}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.words}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      aria-label="Filter the queue"
      className="shrink-0 space-y-1 border-b border-border p-1 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        applyName();
      }}
    >
      <div className="flex gap-1">
        <label htmlFor={`${ids}-name`} className="sr-only">
          Name
        </label>
        <Input
          id={`${ids}-name`}
          type="search"
          className="h-6 min-w-0 flex-1 rounded-none px-1.5 py-0 text-xs md:text-xs"
          placeholder="Search by name"
          value={name}
          onChange={(event) => {
            const typed = event.target.value;
            setName(typed);
            stopPause();
            pause.current = setTimeout(() => {
              applyName(typed);
            }, TYPING_PAUSE_MS);
          }}
          onBlur={() => {
            applyName();
          }}
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${ids}-choices`}
          className={cn(
            CONTROL,
            'h-6 shrink-0 border border-input px-2 text-xs',
            open && 'bg-muted',
          )}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {count === 0 ? 'Filters' : `Filters · ${String(count)}`}
        </button>
      </div>
      {open ? (
        <div id={`${ids}-choices`} className="grid grid-cols-2 gap-1 pb-1">
          {select(
            `${ids}-group`,
            'Group',
            filter.group ?? '',
            'Every group',
            choices.groups.map((group) => ({
              value: group.id,
              words: group.subject ?? 'with no subject',
            })),
            (value) => {
              on({ group: chosen(value, groups) });
            },
          )}
          {select(
            `${ids}-proposer`,
            'Proposer',
            filter.proposer ?? '',
            'Every proposer',
            choices.proposers.map((proposer) => ({
              value: proposer,
              words: proposerWords(proposer),
            })),
            (value) => {
              on({ proposer: chosen(value, choices.proposers) });
            },
          )}
          {select(
            `${ids}-fault`,
            'Fault',
            filter.fault ?? '',
            'Every fault',
            FAULT_KINDS.map((kind) => ({ value: kind, words: faultWords(kind) })),
            (value) => {
              on({ fault: chosen<FaultKind>(value, FAULT_KINDS) });
            },
          )}
          {select(
            `${ids}-document`,
            'Source document',
            filter.document ?? '',
            'Every document',
            choices.documents.map((document) => ({
              value: document.id,
              words: documentName({ ...document, uri: null, mime: null }),
            })),
            (value) => {
              on({ document: chosen(value, documents) });
            },
          )}
        </div>
      ) : null}
      {count === 0 && !filterIsOn(filter) ? null : (
        <div className="flex flex-wrap items-center gap-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`Remove the filter ${chip.words}`}
              title={chip.words}
              className={cn(
                CONTROL,
                'flex h-5 min-w-0 max-w-full items-center gap-1 border border-border px-1 text-small/4',
              )}
              onClick={() => {
                on(CLEAR[chip.key]);
              }}
            >
              <span className="truncate">{chip.words}</span>
              <span aria-hidden="true" className="text-label">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            className={cn(CONTROL, 'h-5 px-1 text-small/4 text-label underline underline-offset-2')}
            onClick={() => {
              stopPause();
              setName('');
              onFilter({ ...NO_FILTER, lane: filter.lane });
            }}
          >
            Show every unit
          </button>
        </div>
      )}
    </form>
  );
}
