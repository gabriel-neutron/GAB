/** One part of a text: words, or an address that the page draws as one short link. */
export type TextPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly href: string; readonly host: string };

// The v1 lines join their fields with a bar, so a bar ends an address.
const ADDRESS = /https?:\/\/[^\s|]+/gu;

const hostOf = (href: string): string => {
  try {
    return new URL(href).host.replace(/^www\./u, '');
  } catch {
    return href;
  }
};

const count = (text: string, sign: string): number => text.split(sign).length - 1;

// A sentence or a list puts its sign right after an address, so a sign at the end belongs to the
// text. A closing bracket stays where the address opened one.
const trimmed = (address: string): string => {
  let held = address.replace(/[.,;:!?'"]+$/u, '');
  while (held.endsWith(')') && count(held, ')') > count(held, '(')) held = held.slice(0, -1);
  return held.replace(/[.,;:!?'"]+$/u, '');
};

/** The parts of a text, with each address as one link. A long address takes many lines when it
 * is drawn as text, and the host says enough to choose it. */
export function linkedText(text: string): readonly TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const found of text.matchAll(ADDRESS)) {
    const href = trimmed(found[0]);
    if (found.index > at) parts.push({ kind: 'text', text: text.slice(at, found.index) });
    parts.push({ kind: 'link', href, host: hostOf(href) });
    at = found.index + href.length;
  }
  if (at < text.length || parts.length === 0) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
