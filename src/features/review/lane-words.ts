import type { LaneCounts } from './unit-page';

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
