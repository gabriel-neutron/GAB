/** The value of one finding of the summary: words, or a number read from its list item. */
export type SummaryValue =
  | { readonly kind: 'words'; readonly label: string; readonly text: string }
  | {
      readonly kind: 'number';
      readonly label: string;
      readonly value: number;
      readonly format: (value: number) => string;
    };

// The first percentage of the item, with the space of its locale before the sign.
const PERCENT = /(\d+)(\s?%)/;

/** The value of each finding, from the text of its list item, which the parity test ties to the
 * source text. A finding with words (no number) keeps the words of its copy. The label is the bold
 * key of the item. */
export function summaryValues(
  items: readonly string[],
  copy: readonly { readonly words: string }[],
): readonly SummaryValue[] {
  return items.map((item, index) => {
    // A French key has a space before its colon.
    const label = /^\*\*([^*]+?)\s?:?\*\*/.exec(item)?.[1] ?? '';
    const words = copy[index]?.words ?? '';
    const match = PERCENT.exec(item);
    if (words !== '' || match === null) return { kind: 'words', label, text: words };
    const sign = match[2] ?? '%';
    return {
      kind: 'number',
      label,
      value: Number(match[1]),
      format: (value) => `${String(Math.round(value))}${sign}`,
    };
  });
}
