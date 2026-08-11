/**
 * PROTOTYPE — throwaway. Hand-built DOM, because ADR 0004 §3 forbids a React re-render here.
 *
 * The surface renders its shell once, in JSX, and never again. Everything that changes with the
 * selection or the filter is written into that shell by the rail and the legend.
 */

export function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}
