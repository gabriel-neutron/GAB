/**
 * PROTOTYPE — throwaway. The chrome of every variant is built with these two helpers.
 *
 * **Why plain DOM and not React.** ADR 0004 §3 refuses React state and a React re-render inside
 * this folder. A search field, a list and a legend all change on a keystroke, so in React each
 * one is state, and the tree that holds the live canvas would re-render on every character. The
 * rule leaves one honest reading: the chrome is DOM, like the map it sits on.
 *
 * The styles are inline, and they read the theme tokens of `src/index.css`. Inline is right for
 * throwaway code — nothing to delete from a stylesheet, and no class name that outlives the
 * prototype.
 */

/**
 * A style is a plain record and not `Partial<CSSStyleDeclaration>`, because that interface is
 * iterable and `no-misused-spread` refuses to spread it into an object literal. Every key below
 * is a real camel-case CSS property; nothing checks that, and nothing needs to in throwaway code.
 */
export type Style = Readonly<Record<string, string>>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Style,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The theme forbids a radius, a shadow away from a true overlay, and a gradient. */
export const PANEL: Style = {
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '0',
  fontSize: '12px',
  lineHeight: '20px',
};

/** Rule 12: every identifier, coordinate, count, date and code is monospace. */
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** A 14px line icon, per rule 20. A dot is the one exception the map needs. */
export function dot(colour: string): HTMLSpanElement {
  return el('span', {
    width: '8px',
    height: '8px',
    flex: '0 0 8px',
    background: colour,
    display: 'inline-block',
  });
}

/** A row that truncates instead of wrapping, per rule 16. */
export const TRUNCATE: Style = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
