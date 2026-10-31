/** One run of report text: plain words, a reference to a node, or a note marker. */
export type Mark =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly bold: boolean;
      readonly italic: boolean;
    }
  | {
      readonly kind: 'node';
      readonly id: string;
      readonly text: string;
      readonly bold: boolean;
      readonly italic: boolean;
    }
  | { readonly kind: 'note'; readonly id: string };

// `[[id|text]]` a node, `[^id]` a note, `**` bold, `*` italic (the titles in the notes).
const MARKS = /\[\[([^|\]]+)\|([^\]]+)\]\]|\[\^([^\]]+)\]|\*\*|\*/g;

const isWord = (char: string | undefined) => char !== undefined && char.trim() !== '';

/** The positions of the `**` and `*` that have a pair in the block. An opener comes before a
 * word, a closer after a word; any other star stays text. */
function pairedStars(text: string): ReadonlySet<number> {
  const paired = new Set<number>();
  const open = new Map<string, number>();
  for (const { 0: star, index } of text.matchAll(MARKS)) {
    if (star !== '*' && star !== '**') continue;
    const start = open.get(star);
    if (start !== undefined && isWord(text[index - 1])) {
      paired.add(start).add(index);
      open.delete(star);
    } else if (isWord(text[index + star.length])) open.set(star, index);
  }
  return paired;
}

/** Split one block of report text into runs. A paired `**` or `*` turns its style on or off. */
export function parseMarks(text: string): readonly Mark[] {
  const runs: Mark[] = [];
  const stars = pairedStars(text);
  let bold = false;
  let italic = false;
  let last = 0;
  for (const match of text.matchAll(MARKS)) {
    // A lone star joins the text run around it.
    if (match[0].startsWith('*') && !stars.has(match.index)) continue;
    if (match.index > last)
      runs.push({ kind: 'text', text: text.slice(last, match.index), bold, italic });
    last = match.index + match[0].length;
    const [whole, node, words, note] = match;
    if (whole === '**') bold = !bold;
    else if (whole === '*') italic = !italic;
    else if (note !== undefined) runs.push({ kind: 'note', id: note });
    else if (node !== undefined && words !== undefined)
      runs.push({ kind: 'node', id: node, text: words, bold, italic });
  }
  if (last < text.length) runs.push({ kind: 'text', text: text.slice(last), bold, italic });
  return runs;
}
