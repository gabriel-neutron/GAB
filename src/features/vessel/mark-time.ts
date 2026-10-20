import { releaseDay } from '@gab/release/release-day';
import type { MarkTime } from '@gab/release/vessel-timeline';
/** What a mark says of its time, in words. An open interval says that no end date is recorded,
 * which is not the same as an ended relation. */
export const markTimeWords = (time: MarkTime): string => {
  if (time.kind === 'day') return `On ${time.key}: ${releaseDay(time.day)}.`;
  if (time.kind === 'no date') return 'The release gives no date.';
  const from = time.from === null ? 'Start unknown.' : `From ${releaseDay(time.from)}`;
  const to = time.to === null ? 'open: no end date recorded.' : `to ${releaseDay(time.to)}.`;
  return time.from === null ? `${from} End ${to}` : `${from}, ${to}`;
};
