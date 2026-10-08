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
  readonly onFilter: (filter: QueueFilter) => void;
}

const CHOOSER = cn(
  'h-6 w-full min-w-0 rounded-none border border-input bg-background px-1 text-xs text-foreground',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

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
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const on = (patch: Partial<QueueFilter>): void => {
    onFilter({ ...filter, ...patch });
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

  return (
    <form
      aria-label="Filter the queue"
      className="grid shrink-0 grid-cols-2 gap-1 border-b border-border p-1 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        applyName();
      }}
    >
      <label htmlFor={`${ids}-name`} className="sr-only">
        Name
      </label>
      <Input
        id={`${ids}-name`}
        type="search"
        className="col-span-2 h-6 min-w-0 rounded-none px-1.5 py-0 text-xs md:text-xs"
        placeholder="Name"
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
      <label htmlFor={`${ids}-group`} className="sr-only">
        Group
      </label>
      <select
        id={`${ids}-group`}
        className={CHOOSER}
        value={filter.group ?? ''}
        onChange={(event) => {
          on({ group: chosen(event.target.value, groups) });
        }}
      >
        <option value="">Every group</option>
        {choices.groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.subject ?? 'with no subject'}
          </option>
        ))}
      </select>
      <label htmlFor={`${ids}-proposer`} className="sr-only">
        Proposer
      </label>
      <select
        id={`${ids}-proposer`}
        className={CHOOSER}
        value={filter.proposer ?? ''}
        onChange={(event) => {
          on({ proposer: chosen(event.target.value, choices.proposers) });
        }}
      >
        <option value="">Every proposer</option>
        {choices.proposers.map((proposer) => (
          <option key={proposer} value={proposer}>
            {proposerWords(proposer)}
          </option>
        ))}
      </select>
      <label htmlFor={`${ids}-fault`} className="sr-only">
        Fault
      </label>
      <select
        id={`${ids}-fault`}
        className={CHOOSER}
        value={filter.fault ?? ''}
        onChange={(event) => {
          on({ fault: chosen<FaultKind>(event.target.value, FAULT_KINDS) });
        }}
      >
        <option value="">Every fault</option>
        {FAULT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {faultWords(kind)}
          </option>
        ))}
      </select>
      <label htmlFor={`${ids}-document`} className="sr-only">
        Source document
      </label>
      <select
        id={`${ids}-document`}
        className={CHOOSER}
        value={filter.document ?? ''}
        onChange={(event) => {
          on({ document: chosen(event.target.value, documents) });
        }}
      >
        <option value="">Every document</option>
        {choices.documents.map((document) => (
          <option key={document.id} value={document.id}>
            {documentName({ ...document, uri: null, mime: null })}
          </option>
        ))}
      </select>
      {filterIsOn(filter) ? (
        <button
          type="button"
          className={cn(CONTROL, 'col-span-2 h-6 border border-input px-2 text-xs')}
          onClick={() => {
            stopPause();
            setName('');
            onFilter(NO_FILTER);
          }}
        >
          Show every unit
        </button>
      ) : null}
    </form>
  );
}
