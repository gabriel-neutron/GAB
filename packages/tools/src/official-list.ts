// The parts that the tools of an official list share: the excerpt of an entry and the day of the
// file.

// The same cap as the excerpt of a proposal, so the excerpt is cited as it is given.
const MAX_EXCERPT = 600;

/** The start of a text, clipped to the cap of an excerpt. The start of a part of the page is still
 * a quote of the page. */
export const clippedExcerpt = (text: string): string => {
  // The cap of a proposal counts UTF-16 units, and a clip never splits a character.
  let clipped = '';
  for (const character of text) {
    if (clipped.length + character.length > MAX_EXCERPT) break;
    clipped += character;
  }
  return clipped;
};

/** The line of the page that starts at this index, clipped to the cap of an excerpt. */
export const lineExcerpt = (page: string, from: number): string => {
  const end = page.indexOf('\n', from);
  return clippedExcerpt(page.slice(from, end === -1 ? undefined : end).replace(/\r$/u, ''));
};

/** The day of an HTTP date, such as the Last-Modified date of an answer, or null. */
export const dayOf = (date: string | null): string | null => {
  if (date === null) return null;
  const read = new Date(date);
  return Number.isNaN(read.getTime()) ? null : read.toISOString().slice(0, 10);
};
