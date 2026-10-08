import type { Lane, LaneCounts } from './unit-page';

const counted = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

/** The one sentence at the head of the queue: what the rules decided, and what is left in each
 * list. */
export function laneSummary({ decided, doubt, waiting }: LaneCounts): string {
  const doubts = counted(doubt, 'doubt waits', 'doubts wait');
  const units = counted(waiting, 'unit waits', 'units wait');
  return (
    `The rules decided ${counted(decided, 'unit', 'units')}. ` +
    `${doubts} for you. ${units} for a source.`
  );
}

/** The two lists of the queue, with the name of each on its button. */
export const LISTS: readonly { readonly lane: Lane; readonly words: string }[] = [
  { lane: 'doubt', words: 'Doubts' },
  { lane: 'waiting', words: 'Waiting' },
];

/** The line of a unit says the reason of a doubt, or the source that a waiting unit needs. */
export const SAID_LABEL: Readonly<Record<Lane, string>> = { doubt: 'Doubt', waiting: 'Needs' };

/** The sentence of an empty list. */
export const NO_UNIT: Readonly<Record<Lane, string>> = {
  doubt: 'No doubt needs a decision of the operator.',
  waiting: 'No unit waits for a source.',
};

/** The count of a whole list, after its number. */
export const WHOLE: Readonly<Record<Lane, string>> = {
  doubt: 'doubts',
  waiting: 'units wait for a source',
};
