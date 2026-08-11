/**
 * **PROTOTYPE — throwaway.** The bar that switches the variants.
 *
 * It is deliberately ugly and high contrast, so that nobody mistakes it for the design under
 * review. It is not rendered in a production build.
 */

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The composed layout beside another surface was dropped on 11 August 2026. What is compared now
// is three readings of the same page: the same data, the same keys, the same words on the
// buttons, and three different structures.
// The keys are words and not numbers on purpose: the router serialises search values as JSON, so
// `variant=1` reaches the address as `variant=%221%22`.
export const VARIANTS = ['ledger', 'inspector', 'record'] as const;
export type VariantKey = (typeof VARIANTS)[number];

export const VARIANT_NAME: Readonly<Record<VariantKey, string>> = {
  ledger: 'Ledger — the node’s changes as one aligned table',
  inspector: 'Inspector — one change open, the controls never move',
  record: 'In place — the node’s record, changes on the lines they touch',
};

export const isVariantKey = (value: unknown): value is VariantKey =>
  VARIANTS.includes(value as VariantKey);

export function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: VariantKey;
  onChange: (next: VariantKey) => void;
}) {
  const step = (delta: number): void => {
    const at = VARIANTS.indexOf(current);
    const next = VARIANTS[(at + delta + VARIANTS.length) % VARIANTS.length];
    if (next !== undefined) onChange(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-1.5 text-neutral-50 shadow-lg ring-1 ring-white/20 dark:bg-neutral-50 dark:text-neutral-900">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => {
          step(-1);
        }}
        className="rounded-full p-1 hover:bg-white/15 dark:hover:bg-black/10"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 text-xs font-medium whitespace-nowrap">
        PROTOTYPE · {VARIANT_NAME[current]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => {
          step(1);
        }}
        className="rounded-full p-1 hover:bg-white/15 dark:hover:bg-black/10"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
