/**
 * PROTOTYPE — throwaway. The bar that cycles the three visual vocabularies of
 * `./direction.prototype.ts`.
 *
 * It is deliberately unlike the surfaces it sits over, so that nobody judges it as part of the
 * design. It never reaches a production build: the guard below is `import.meta.env.PROD`.
 *
 * It is deleted with `./direction.prototype.ts` once the operator has chosen.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

import { DIRECTIONS, DIRECTION_VARIANTS, type DirectionVariant } from './direction.prototype';

export interface VariantSwitcherProps {
  readonly current: DirectionVariant;
  readonly onChange: (next: DirectionVariant) => void;
}

export function VariantSwitcher({ current, onChange }: VariantSwitcherProps) {
  const at = DIRECTION_VARIANTS.indexOf(current);
  const step = (by: number): void => {
    const next =
      DIRECTION_VARIANTS[(at + by + DIRECTION_VARIANTS.length) % DIRECTION_VARIANTS.length];
    if (next !== undefined) onChange(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      // A prototype must not steal the arrow keys from a field.
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  if (import.meta.env.PROD) return null;

  const vocabulary = DIRECTIONS[current];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center">
      <div className="pointer-events-auto flex max-w-[46rem] items-center gap-2 rounded-full bg-yellow-300 px-2 py-1 text-xs text-black shadow-lg">
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => {
            step(-1);
          }}
          className="flex size-6 items-center justify-center rounded-full hover:bg-black/10"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="font-mono font-bold">{current}</span>
        <span className="font-medium">{vocabulary.name}</span>
        <span className="min-w-0 truncate opacity-70">{vocabulary.says}</span>
        <span className="min-w-0 truncate opacity-50">{vocabulary.cost}</span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => {
            step(1);
          }}
          className="flex size-6 items-center justify-center rounded-full hover:bg-black/10"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
