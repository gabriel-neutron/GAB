import type { Lane } from './unit-page';
import { NO_UNIT, WHOLE } from './lane-words';

/** The counts of the units that the left column holds. */
export interface QueueCounts {
  /** The units read and shown. */
  readonly read: number;
  /** The units of the filter that come before the first unit shown. */
  readonly before: number;
  /** The units that the filter keeps. */
  readonly matched: number;
  /** Every unit of the list, the doubts or the units that wait. */
  readonly total: number;
  readonly filtered: boolean;
  readonly lane: Lane;
}

/** The count line of the left column, and the sentence that says why it shows no unit. */
export interface QueueWords {
  readonly count: string;
  readonly empty: string | null;
}

const emptyOf = ({ read, matched, total, lane }: QueueCounts): string | null => {
  if (total === 0) return NO_UNIT[lane];
  if (matched === 0) return 'No unit matches this filter.';
  if (read === 0) return 'No unit comes after this place in the queue.';
  return null;
};

export function queueWords(counts: QueueCounts): QueueWords {
  const { read, before, matched, total, filtered, lane } = counts;
  const kept = `${String(matched)} of ${String(total)} units match the filter`;
  const whole = filtered ? kept : `${String(matched)} ${WHOLE[lane]}`;
  const suffix = filtered ? `. ${kept}` : '';
  const count =
    read === 0 || (before === 0 && read === matched)
      ? whole
      : before === 0
        ? `${String(read)} of ${String(matched)} units read${suffix}`
        : `Units ${String(before + 1)} to ${String(before + read)} of ${String(matched)}${suffix}`;
  return { count, empty: emptyOf(counts) };
}
