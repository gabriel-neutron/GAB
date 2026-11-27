// THE END OF A RELATION THAT AN EU ACT ENDS: the day before its entry into force (ADR 0038). The
// article on the entry into force gives a day, or a day that counts from the publication in the
// Official Journal. Code computes the day from ONE passage, which must hold the article and, for
// a day that counts from the publication, exactly one date of the Official Journal. A passage
// with two dates of the Official Journal, as a footnote that cites an earlier act, gives no day.

const MONTHS: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const ORDINALS: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fifth: 5,
  seventh: 7,
  tenth: 10,
  fifteenth: 15,
  twentieth: 20,
  thirtieth: 30,
};

const isoDay = (year: number, month: number, date: number): string | null => {
  const day = new Date(Date.UTC(year, month - 1, date));
  if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month - 1 || day.getUTCDate() !== date)
    return null;
  return day.toISOString().slice(0, 10);
};

/** The day `days` after an ISO day, as an ISO day. */
export const plusDays = (iso: string, days: number): string => {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

/** Each distinct day of the Official Journal that the passage writes: "OJ L, 22.9.2026",
 * "OJ L 229, 31.7.2014" or "OJ L, 2024/1745, 24.6.2024". */
const journalDays = (text: string): readonly string[] => {
  const days = new Set<string>();
  for (const found of text.matchAll(
    /\bOJ\s+[LC](?:\s+\d+[A-Z]?)?,\s*(?:\d{4}\/\d+,\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})\b/gu,
  )) {
    const day = isoDay(Number(found[3]), Number(found[2]), Number(found[1]));
    if (day !== null) days.add(day);
  }
  return [...days];
};

const SPACE = String.raw`\s+`;
const IN_FORCE = String.raw`enter${SPACE}into${SPACE}force${SPACE}on${SPACE}`;

/** The day of the entry into force that one passage of an EU act gives, or null. */
export const entryIntoForce = (passage: string): string | null => {
  const text = passage.normalize('NFKC');
  if (!/\b(?:OJ\s+[LC]\b|Official\s+Journal)/u.test(text)) return null;
  const fixed = new RegExp(
    String.raw`\b${IN_FORCE}(?:the${SPACE})?(\d{1,2})${SPACE}([A-Za-z]+)${SPACE}(\d{4})\b`,
    'iu',
  ).exec(text);
  if (fixed !== null) {
    const month = MONTHS[(fixed[2] ?? '').toLowerCase()];
    return month === undefined ? null : isoDay(Number(fixed[3]), month, Number(fixed[1]));
  }
  const counted = new RegExp(
    String.raw`\b${IN_FORCE}the${SPACE}(?:(date)${SPACE}of|(?:([a-z]+)${SPACE})?day${SPACE}following${SPACE}that${SPACE}of)${SPACE}its${SPACE}publication\b`,
    'iu',
  ).exec(text);
  if (counted === null) return null;
  const days = journalDays(text);
  if (days.length !== 1) return null;
  const [published] = days;
  if (published === undefined) return null;
  if (counted[1] !== undefined) return published;
  const after = counted[2] === undefined ? 1 : ORDINALS[counted[2].toLowerCase()];
  return after === undefined ? null : plusDays(published, after);
};

/** True when one passage gives an entry into force on the day after `validTo`. */
export const endBeforeEntryIntoForce = (validTo: string, passages: readonly string[]): boolean =>
  passages.some((passage) => entryIntoForce(passage) === plusDays(validTo, 1));
