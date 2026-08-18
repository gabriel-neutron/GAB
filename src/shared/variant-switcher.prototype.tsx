/**
 * PROTOTYPE — throwaway. The bar that cycles the three visual vocabularies of
 * `./marks.prototype.ts`.
 *
 * It is deliberately unlike the surfaces it sits over, so that nobody judges it as part of the
 * design. It never reaches a production build: the guard below is `import.meta.env.PROD`.
 *
 * It is deleted with `./marks.prototype.ts` once the operator has chosen.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

import { MARKS, MARK_VARIANTS, type MarkVariant } from './marks.prototype';

export interface VariantSwitcherProps {
  readonly current: MarkVariant;
  readonly onChange: (next: MarkVariant) => void;
}

export function VariantSwitcher({ current, onChange }: VariantSwitcherProps) {
  const at = MARK_VARIANTS.indexOf(current);
  const step = (by: number): void => {
    const next = MARK_VARIANTS[(at + by + MARK_VARIANTS.length) % MARK_VARIANTS.length];
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

  const mark = MARKS[current];

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
        <span className="font-medium">{mark.name}</span>
        <span className="min-w-0 truncate opacity-70">{mark.says}</span>
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
