import { folded } from './text-fold';

export interface MatchPart {
  readonly text: string;
  readonly matched: boolean;
}

// Departure: `folded` works on a whole text, and a highlight needs the place of the match in the
// original text. So the name is folded one character at a time, and each folded character keeps
// the index of the character that it came from.
function foldedWithOrigin(name: string): { readonly text: string; readonly origin: number[] } {
  let text = '';
  const origin: number[] = [];
  let index = 0;
  for (const char of name) {
    const piece = /\s/u.test(char) ? ' ' : folded(char);
    for (const unit of piece) {
      text += unit;
      origin.push(index);
    }
    index += char.length;
  }
  return { text, origin };
}

/** Splits a name into the text before, in and after the first match of the query. The match
 * ignores case and accents, as the filter does. A name with no match is one unmarked part. */
export function matchParts(name: string, query: string): readonly MatchPart[] {
  const needle = folded(query);
  const whole: readonly MatchPart[] = [{ text: name, matched: false }];
  if (needle === '') return whole;
  const { text, origin } = foldedWithOrigin(name);
  const at = text.indexOf(needle);
  if (at === -1) return whole;
  const from = origin[at] ?? 0;
  const last = origin[at + needle.length - 1] ?? name.length - 1;
  const to = last + String.fromCodePoint(name.codePointAt(last) ?? 0).length;
  return [
    { text: name.slice(0, from), matched: false },
    { text: name.slice(from, to), matched: true },
    { text: name.slice(to), matched: false },
  ].filter((part) => part.text !== '');
}
