// The same cap as the excerpt of a proposal, so the excerpt is cited as it is given.
const MAX_EXCERPT = 600;

/** The line of the page that starts at this index, clipped to the cap of an excerpt. A line is a
 * part of the page, so the clipped line is still a quote of it. */
export const lineExcerpt = (page: string, from: number): string => {
  const end = page.indexOf('\n', from);
  const line = page.slice(from, end === -1 ? undefined : end).replace(/\r$/u, '');
  // The cap of a proposal counts UTF-16 units, and a clip never splits a character.
  let clipped = '';
  for (const character of line) {
    if (clipped.length + character.length > MAX_EXCERPT) break;
    clipped += character;
  }
  return clipped;
};
