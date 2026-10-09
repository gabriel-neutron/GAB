// The text of an XML file. A data file such as a sanctions list holds its values in elements and
// has no page to show, so its text gives each element that holds a value on its own line, as
// "name: value", with two spaces of indent for each level. An element that holds other elements
// gives its name alone on a line, so a record starts with its own line. The names keep the
// structure, and a citation quotes one record whole. Attributes, comments and processing
// instructions give no text.

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const decoded = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

// A name without its prefix: "ns:entry" reads as "entry".
const localName = (tag: string): string => {
  const name = /^[^\s/>]+/u.exec(tag)?.[0] ?? '';
  return name.slice(name.indexOf(':') + 1);
};

const TOKEN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([^>]*?)(\/?)>|([^<]+)/gu;

/** The text of an XML document, as one string. */
export const xmlText = (source: string): string => {
  const lines: string[] = [];
  // The open elements: the name, and whether a child element was seen.
  const open: { name: string; parent: boolean; text: string }[] = [];
  for (const match of source.matchAll(TOKEN)) {
    const [, cdata, closing, tag, selfClosing, text] = match;
    const top = open.at(-1);
    if (cdata !== undefined || text !== undefined) {
      if (top !== undefined) top.text += cdata ?? decoded(text ?? '');
      continue;
    }
    if (tag === undefined) continue;
    const name = localName(tag);
    if (closing === '/') {
      const ended = open.pop();
      if (ended === undefined) continue;
      const value = ended.text.replace(/\s+/gu, ' ').trim();
      if (!ended.parent && value !== '')
        lines.push(`${'  '.repeat(open.length)}${ended.name}: ${value}`);
      continue;
    }
    if (top !== undefined && !top.parent) {
      top.parent = true;
      lines.push(`${'  '.repeat(open.length - 1)}${top.name}`);
    }
    if (selfClosing === '/') continue;
    open.push({ name, parent: false, text: '' });
  }
  return lines.join('\n');
};
