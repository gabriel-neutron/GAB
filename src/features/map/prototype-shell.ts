/**
 * PROTOTYPE — throwaway. The switcher, and the plan.
 *
 * > Three variants of the map, switchable with `?variant=`, on the existing `/map` route.
 *
 * ------------------------------------------------------------------------------------------
 * The question
 * ------------------------------------------------------------------------------------------
 *
 * The analyst is **locating**: finding one entity and seeing where it sits. The three variants
 * disagree about the affordance that does the finding — a search field (A), a list (B), or the
 * map and the keyboard (C). They also disagree about where the type control goes, which is the
 * same question as "what is the layer panel", and that reports to **#36**.
 *
 * The camera and the layer visibility persist through `@/shared/storage`, which reports to
 * **#33**.
 *
 * ------------------------------------------------------------------------------------------
 * Why the router is not used for `?variant=`
 * ------------------------------------------------------------------------------------------
 *
 * A `validateSearch` on the route plus `useSearch` would put the variant in React state, and
 * every switch would re-render the tree that holds the live canvas. ADR 0004 §3 refuses that
 * inside this folder. So the parameter is read and written with the History API, outside React,
 * and the route file stays the one line it was. **This is prototype scaffolding and not a
 * proposal**: the switcher dies with the prototype, and ADR 0004 §7 still holds — the URL
 * carries identity, and this is not identity.
 */

import { el, MONO } from './prototype-dom';
import { mountVariantA, NAME_A } from './prototype-variant-a';
import { mountVariantB, NAME_B } from './prototype-variant-b';
import { mountVariantC, NAME_C } from './prototype-variant-c';

interface Variant {
  readonly key: string;
  readonly name: string;
  readonly mount: (host: HTMLElement) => () => void;
}

const VARIANTS: readonly Variant[] = [
  { key: 'A', name: NAME_A, mount: mountVariantA },
  { key: 'B', name: NAME_B, mount: mountVariantB },
  { key: 'C', name: NAME_C, mount: mountVariantC },
];

function indexFromUrl(): number {
  const wanted = new URLSearchParams(window.location.search).get('variant');
  const found = VARIANTS.findIndex((variant) => variant.key === wanted);
  return found === -1 ? 0 : found;
}

function writeUrl(key: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  // `replaceState`, so the browser back button still leaves the prototype. ADR 0004 §7 records
  // the rate limit on this call; an arrow click cannot approach it.
  window.history.replaceState(null, '', url);
}

export function mountPrototype(root: HTMLElement): () => void {
  // Idempotence, cheaply. React 19 double-invokes an effect in development, and the cleanup
  // below runs between the two, but a stray child from any other cause dies here too.
  root.replaceChildren();

  const stage = el('div', { position: 'absolute', inset: '0' });
  root.appendChild(stage);

  let index = indexFromUrl();
  let unmount: (() => void) | null = null;

  const label = el('span', { minWidth: '200px', textAlign: 'center' });

  const show = (next: number): void => {
    index = (next + VARIANTS.length) % VARIANTS.length;
    const variant = VARIANTS[index];
    if (variant === undefined) return;

    unmount?.();
    stage.replaceChildren();
    stage.removeAttribute('style');
    Object.assign(stage.style, { position: 'absolute', inset: '0' });

    unmount = variant.mount(stage);
    label.textContent = `${variant.key} — ${variant.name}`;
    writeUrl(variant.key);
  };

  // ---- the floating bar ------------------------------------------------------------------

  const bar = el('div', {
    position: 'fixed',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    // Deliberately unlike the page: this bar is not part of any design under judgement.
    background: '#111111',
    color: '#f5f5f5',
    border: '1px solid #444444',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    fontFamily: MONO,
    fontSize: '12px',
    zIndex: '40',
  });

  const arrow = (text: string, delta: number): HTMLButtonElement => {
    const button = el(
      'button',
      {
        background: 'transparent',
        border: '0',
        color: 'inherit',
        cursor: 'pointer',
        padding: '2px 8px',
        font: 'inherit',
      },
      text,
    );
    button.addEventListener('click', () => {
      show(index + delta);
    });
    return button;
  };

  bar.append(arrow('<', -1), label, arrow('>', 1));

  const onKey = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    if (event.key === 'ArrowLeft') show(index - 1);
    else if (event.key === 'ArrowRight') show(index + 1);
  };

  // A stray merge cannot ship the bar. The variants would still be reachable, which is why the
  // whole set leaves `main` when the prototype is captured.
  if (!import.meta.env.PROD) {
    document.body.appendChild(bar);
    window.addEventListener('keydown', onKey);
  }

  show(index);

  return () => {
    window.removeEventListener('keydown', onKey);
    unmount?.();
    bar.remove();
    root.replaceChildren();
  };
}
