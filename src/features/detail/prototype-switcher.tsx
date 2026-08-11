/**
 * **PROTOTYPE — throwaway.** The floating bar that flips between the three layouts and between
 * the two surfaces. It is deliberately ugly, so that nobody mistakes it for the design under
 * review, and it is absent from a production build.
 *
 * It navigates through a callback and never through the router, so this feature knows no route
 * address. The route owns the navigation, as it owns the composition.
 */

import { useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import {
  nextVariant,
  SURFACE_NAMES,
  VARIANT_NAMES,
  type Surface,
  type VariantKey,
} from './prototype-variants';

export interface PrototypeSwitcherProps {
  readonly variant: VariantKey;
  readonly surface: Surface;
  readonly onSelect: (variant: VariantKey, surface: Surface) => void;
}

export function PrototypeSwitcher({ variant, surface, onSelect }: PrototypeSwitcherProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      // An arrow key inside a field belongs to the field. The controls of this prototype are
      // disabled, so this guard is for the day one is not.
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      onSelect(nextVariant(variant, event.key === 'ArrowLeft' ? -1 : 1), surface);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [variant, surface, onSelect]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="flex items-center gap-2 rounded-4xl border-2 border-foreground bg-background px-2 py-1.5 shadow-lg">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous layout"
          onClick={() => {
            onSelect(nextVariant(variant, -1), surface);
          }}
        >
          ←
        </Button>
        <span className="px-1 text-xs">
          <strong className="font-mono">{variant}</strong> — {VARIANT_NAMES[variant]}
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next layout"
          onClick={() => {
            onSelect(nextVariant(variant, 1), surface);
          }}
        >
          →
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          size="sm"
          variant={surface === 'page' ? 'default' : 'ghost'}
          onClick={() => {
            onSelect(variant, 'page');
          }}
        >
          {SURFACE_NAMES.page}
        </Button>
        <Button
          size="sm"
          variant={surface === 'sidebar' ? 'default' : 'ghost'}
          onClick={() => {
            onSelect(variant, 'sidebar');
          }}
        >
          {SURFACE_NAMES.sidebar}
        </Button>
      </div>
    </div>
  );
}
