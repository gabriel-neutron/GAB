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

/** Split one block of report text into runs. A `**` or `*` turns its style on or off. */
export function parseMarks(text: string): readonly Mark[] {
  const runs: Mark[] = [];
  let bold = false;
  let italic = false;
  let last = 0;
  for (const match of text.matchAll(MARKS)) {
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
