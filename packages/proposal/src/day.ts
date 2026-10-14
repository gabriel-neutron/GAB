import { z } from 'zod';

/** A day of the calendar, written as 2026-01-31. It refuses a day that the calendar lacks, such
 * as 2026-02-30. */
export const day = z.iso.date({
  error: 'a day is written YYYY-MM-DD and is a day of the calendar',
});

/** True when the value is a day of the calendar. Each check of a day reads this one rule. */
export const isDay = (value: unknown): value is string => day.safeParse(value).success;
