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

/** The parts of a text, with each address as one link. A long address takes many lines when it
 * is drawn as text, and the host says enough to choose it. */
export function linkedText(text: string): readonly TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const found of text.matchAll(ADDRESS)) {
    if (found.index > at) parts.push({ kind: 'text', text: text.slice(at, found.index) });
    parts.push({ kind: 'link', href: found[0], host: hostOf(found[0]) });
    at = found.index + found[0].length;
  }
  if (at < text.length || parts.length === 0) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
