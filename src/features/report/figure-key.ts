// Origin: the keys of the figure texts follow the numbers of the publication data, not of the
// page. The page swaps figures 1 and 2, adds figure 9, and gives no number to the routes chart
// (key 11), so figures 10 and 11 of the page take keys 9 and 10.
const MOVED: ReadonlyMap<number, string | undefined> = new Map([
  [1, '2'],
  [2, '1'],
  [9, undefined],
  [10, '9'],
  [11, '10'],
]);

/** The key of the figure texts for a figure number of the page, or undefined when it has none. */
export const figureKey = (number: number): string | undefined =>
  MOVED.has(number) ? MOVED.get(number) : String(number);
