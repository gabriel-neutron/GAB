// The text of an XML file. A data file such as a sanctions list holds its values in elements and
// attributes and has no page to show. So its text gives each element that holds only a value on
// its own line, as "name: value", and each attribute as "@name: value" under its element, with two
// spaces of indent for each level. An element that holds other elements gives its name alone on a
// line, so a record starts with its own line, and the text that it holds between its children
// stays on lines of its own. A citation quotes one record whole. Comments and processing
// instructions give no text.

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const LAST_CODE_POINT = 0x10ffff;

const decoded = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X';
      const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      // A number outside Unicode names no character, so the text keeps it as it stands.
      return point <= LAST_CODE_POINT ? String.fromCodePoint(point) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

// A name without its prefix: "ns:entry" reads as "entry".
const localName = (name: string): string => name.slice(name.indexOf(':') + 1);

// An attribute value can hold ">", so a tag reads its attributes as quoted strings.
const TOKEN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|</gu;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

const spaced = (text: string): string => text.replace(/\s+/gu, ' ').trim();

interface Open {
  readonly name: string;
  readonly depth: number;
  parent: boolean;
  text: string;
}

/** The text of an XML document, as one string. */
export const xmlText = (source: string): string => {
  const lines: string[] = [];
  const open: Open[] = [];
  const indent = (depth: number): string => '  '.repeat(depth);

  // The text that an element holds before a child, or after its last child, is a line of its own.
  const flush = (element: Open): void => {
    const value = spaced(element.text);
    element.text = '';
    if (value !== '') lines.push(`${indent(element.depth + 1)}${value}`);
  };
  const becomesParent = (element: Open): void => {
    if (element.parent) {
      flush(element);
      return;
    }
    element.parent = true;
    const value = spaced(element.text);
    element.text = '';
    lines.push(`${indent(element.depth)}${element.name}${value === '' ? '' : `: ${value}`}`);
  };
  const close = (element: Open): void => {
    if (element.parent) {
      flush(element);
      return;
    }
    const value = spaced(element.text);
    if (value !== '') lines.push(`${indent(element.depth)}${element.name}: ${value}`);
  };

  for (const match of source.matchAll(TOKEN)) {
    const [whole, cdata, closing, tag, attributes, selfClosing, text] = match;
    const top = open.at(-1);
    if (cdata !== undefined || text !== undefined || whole === '<') {
      if (top !== undefined) top.text += cdata ?? (text === undefined ? whole : decoded(text));
      continue;
    }
    if (tag === undefined) continue;
    if (closing === '/') {
      const ended = open.pop();
      if (ended !== undefined) close(ended);
      continue;
    }
    if (top !== undefined) becomesParent(top);
    const element: Open = { name: localName(tag), depth: open.length, parent: false, text: '' };
    const given = [...(attributes ?? '').matchAll(ATTRIBUTE)].filter(
      ([, name]) => name !== undefined && !name.startsWith('xmlns'),
    );
    if (given.length > 0) {
      becomesParent(element);
      for (const [, name, double, single] of given)
        lines.push(
          `${indent(element.depth + 1)}@${localName(name ?? '')}: ${spaced(decoded(double ?? single ?? ''))}`,
        );
    }
    if (selfClosing === '/') continue;
    open.push(element);
  }
  // An element that is never closed keeps its text.
  for (const element of open.reverse()) close(element);
  return lines.join('\n');
};
