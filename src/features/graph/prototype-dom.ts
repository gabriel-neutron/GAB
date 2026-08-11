/**
 * PROTOTYPE — throwaway. Hand-built DOM, because ADR 0004 §3 forbids a React re-render here.
 *
 * A variant renders its shell once, in JSX, and never again. Everything that changes with the
 * selection or the filter is written into the shell by these functions.
 */

import type { Detail, Selection } from './prototype-detail';

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

function section(title: string, tone = 'text-muted-foreground'): HTMLElement {
  return el('h3', `mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${tone}`, title);
}

const ROW = 'flex items-baseline justify-between gap-3 border-b border-border/60 py-1 text-sm';
const LINK =
  'w-full rounded px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground';

export type DetailMode = 'stacked' | 'columns';

/**
 * Paints one detail into `host`. `navigate` is how the panel reaches a relation that the graph
 * refuses to draw — M4, ADR 0004 §4.
 */
export function renderDetail(
  host: HTMLElement,
  detail: Detail,
  navigate: (selection: Selection) => void,
  mode: DetailMode,
): void {
  host.replaceChildren();

  const head = el('div', 'shrink-0');
  head.append(el('div', 'text-base font-semibold leading-tight', detail.title));
  const sub = el('div', 'mt-0.5 flex flex-wrap items-center gap-1.5');
  sub.append(el('span', 'text-xs text-muted-foreground', detail.subtitle));
  if (detail.synthetic) {
    sub.append(
      el(
        'span',
        'rounded-sm bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground',
        'synthetic',
      ),
    );
  }
  if (detail.pending.length > 0) {
    sub.append(
      el(
        'span',
        'rounded-sm border border-amber-500 px-1 py-px text-[10px] font-medium text-amber-600 dark:text-amber-400',
        `${detail.pending.length} pending`,
      ),
    );
  }
  head.append(sub);
  host.append(head);

  const body = el(
    'div',
    mode === 'columns'
      ? 'mt-2 grid min-h-0 flex-1 grid-cols-4 gap-x-6 overflow-y-auto'
      : 'mt-2 min-h-0 flex-1 overflow-y-auto pr-1',
  );

  // Attributes
  const attrs = el('div', '');
  attrs.append(section('Attributes'));
  if (detail.fields.length === 0) {
    attrs.append(el('p', 'text-sm text-muted-foreground', 'None recorded.'));
  }
  for (const field of detail.fields) {
    const row = el('div', ROW);
    row.append(el('span', 'text-muted-foreground', field.label));
    const right = el('span', 'text-right');
    right.append(el('span', 'font-medium', field.value));
    if (field.sources.length > 0) {
      right.append(el('span', 'ml-2 text-[11px] text-muted-foreground', field.sources.join(' · ')));
    }
    row.append(right);
    attrs.append(row);
  }
  attrs.append(section('Sources'));
  attrs.append(el('p', 'text-sm', detail.sources.length === 0 ? '—' : detail.sources.join(' · ')));
  body.append(attrs);

  // M4 and the pending proposals come **before** the drawn relations. A hub carries sixty
  // relations and one M4 relation, and the one that the graph cannot draw is the one that must
  // not be below the fold.
  const drawn = el('div', '');
  drawn.append(section('On the graph'));
  if (detail.drawn.length === 0) {
    drawn.append(el('p', 'text-sm text-muted-foreground', 'No drawn relation.'));
  }
  for (const link of detail.drawn) {
    const target = link.target;
    const row = button(
      '',
      LINK,
      target === null
        ? () => {
            /* nothing to reach */
          }
        : () => navigate(target),
    );
    row.textContent = '';
    row.append(el('span', 'font-medium', link.label));
    row.append(el('span', 'ml-2 text-muted-foreground', link.detail));
    drawn.append(row);
  }
  if (detail.drawnOverflow > 0) {
    drawn.append(
      el('p', 'mt-1 text-xs text-muted-foreground', `+ ${detail.drawnOverflow} more, not listed.`),
    );
  }
  // M4 — the only route to a relation with a relation at one end
  const hidden = el('div', '');
  hidden.append(
    section(
      'Not on the graph (M4)',
      detail.hidden.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
    ),
  );
  if (detail.hidden.length === 0) {
    hidden.append(el('p', 'text-sm text-muted-foreground', 'None.'));
  }
  for (const link of detail.hidden) {
    const target = link.target;
    const row = button(
      '',
      `${LINK} border-l-2 border-amber-500`,
      target === null
        ? () => {
            /* nothing to reach */
          }
        : () => navigate(target),
    );
    row.textContent = '';
    row.append(el('span', 'font-medium', link.label));
    row.append(el('span', 'ml-2 text-muted-foreground', link.detail));
    hidden.append(row);
  }
  body.append(hidden);

  // Pending proposals
  const pending = el('div', '');
  pending.append(section('Pending proposals'));
  if (detail.pending.length === 0) {
    pending.append(el('p', 'text-sm text-muted-foreground', 'None.'));
  }
  for (const line of detail.pending) {
    const row = el('div', 'border-b border-border/60 py-1');
    row.append(el('div', 'text-sm font-medium', line.summary));
    row.append(
      el(
        'div',
        'text-[11px] text-muted-foreground',
        `${line.op} · confidence ${line.confidence.toFixed(2)}${line.dissent ? ' · dissent' : ''}`,
      ),
    );
    pending.append(row);
  }
  body.append(pending);
  body.append(drawn);

  host.append(body);

  for (const note of detail.notes) {
    host.append(
      el(
        'p',
        'mt-2 shrink-0 border-l-2 border-amber-500 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug',
        note,
      ),
    );
  }
}

export function renderEmpty(host: HTMLElement, message: string): void {
  host.replaceChildren(el('p', 'text-sm text-muted-foreground', message));
}
