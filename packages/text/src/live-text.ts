// A reader must never quote text that a visitor cannot see, so each hidden code point becomes one
// placeholder and keeps its place. The offsets of a reader then point at the same characters of the
// stored page, and a span that touches a placeholder is a span on hidden text.

import { parseHTML } from 'linkedom';

/** The character that stands for one hidden code point in a stored page. */
export const HIDDEN = '\uFFFC';

// Text that is never shown, so it is no part of the page.
const SKIPPED = new Set([
  'HEAD',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'IFRAME',
  'OBJECT',
  'NAV',
  'FOOTER',
  'ASIDE',
]);

// Struck-through text is visible, but it says that the words are withdrawn, so it is no live text.
const STRUCK = new Set(['S', 'DEL', 'STRIKE']);

const BLOCK = new Set([
  'ADDRESS',
  'ARTICLE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'UL',
]);

interface Node {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly textContent: string | null;
  readonly childNodes: ArrayLike<Node>;
  getAttribute?(name: string): string | null;
  hasAttribute?(name: string): boolean;
}

const ELEMENT = 1;
const TEXT = 3;
const COMMENT = 8;

const styleOf = (node: Node): string =>
  (node.getAttribute?.('style') ?? '').toLowerCase().replace(/\s+/gu, '');

// The inline signs of hidden text. A style sheet is not read, so a class that hides text is not
// seen: the cost is a hidden span that passes as live, and only an inline style is caught.
const isHidden = (node: Node): boolean => {
  if (node.hasAttribute?.('hidden') === true) return true;
  if ((node.getAttribute?.('aria-hidden') ?? '').toLowerCase() === 'true') return true;
  const style = styleOf(node);
  return (
    /(^|;)display:none/u.test(style) ||
    /(^|;)visibility:hidden/u.test(style) ||
    /(^|;)font-size:0(px|em|rem|pt|%)?(;|$)/u.test(style) ||
    (/(^|;)width:0(px)?(;|$)/u.test(style) && /(^|;)height:0(px)?(;|$)/u.test(style)) ||
    /(^|;)opacity:0(;|$)/u.test(style)
  );
};

const isStruck = (node: Node): boolean =>
  STRUCK.has(node.nodeName) || /text-decoration(-line)?:[^;]*line-through/u.test(styleOf(node));

const collapse = (text: string): string => text.replace(/\s+/gu, ' ');

const placeholder = (text: string): string => HIDDEN.repeat(Array.from(collapse(text)).length);

/** The live text of an HTML document, one string. Each block starts a line, each table row is one
 * line with its cells between bars, and each hidden code point is one placeholder. */
export const liveText = (source: string): string => {
  // A placeholder in the source is not a mark of hidden text, so it becomes a space first.
  const { document } = parseHTML(source.replaceAll(HIDDEN, ' '));
  const parts: string[] = [];
  const newline = (): void => {
    if (parts.length > 0 && parts.at(-1) !== '\n') parts.push('\n');
  };

  const walk = (node: Node): void => {
    if (node.nodeType === TEXT) {
      parts.push(collapse(node.textContent ?? ''));
      return;
    }
    if (node.nodeType === COMMENT) {
      parts.push(placeholder(node.textContent ?? ''));
      return;
    }
    if (node.nodeType !== ELEMENT) return;
    const name = node.nodeName.toUpperCase();
    if (SKIPPED.has(name)) return;
    if (isHidden(node) || isStruck(node)) {
      parts.push(placeholder(node.textContent ?? ''));
      return;
    }
    if (name === 'TR') {
      newline();
      parts.push('|');
      for (const cell of Array.from(node.childNodes)) {
        if (cell.nodeType !== ELEMENT) continue;
        parts.push(' ');
        walk(cell);
        parts.push(' |');
      }
      parts.push('\n');
      return;
    }
    const block = BLOCK.has(name);
    if (block) newline();
    for (const child of Array.from(node.childNodes)) walk(child);
    if (block) newline();
  };

  walk(document.body);

  // Each line loses the spaces at its two ends, and a run of empty lines becomes one line end.
  return parts
    .join('')
    .split('\n')
    .map((line) => line.replace(/^ +| +$/gu, ''))
    .filter((line) => line !== '')
    .join('\n');
};
