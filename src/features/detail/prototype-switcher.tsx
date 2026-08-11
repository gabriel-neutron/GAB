/**
 * **PROTOTYPE — throwaway.** The floating bar. It flips between the three readings of the record
 * and between the two surfaces, and it reaches the density probe. It is deliberately plain, so
 * that nobody reads it as part of the design, and it is absent from a production build.
 *
 * It navigates through a callback, so this feature knows no route address. The route owns the
 * navigation, as it owns the composition.
 */

import { useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { DENSE_ENTITY_ID } from './prototype-dense';
import {
  nextVariant,
  SURFACE_NAMES,
  VARIANT_NAMES,
  type Surface,
  type VariantKey,
} from './prototype-variants';

export function PrototypeSwitcher({
  variant,
  surface,
  onSelect,
}: {
  variant: VariantKey;
  surface: Surface;
  onSelect: (variant: VariantKey, surface: Surface) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      // An arrow key inside a field belongs to the field. Every control here is disabled, so
      // this guard is for the day one is not.
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
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 border-2 border-foreground bg-background px-2 py-1.5 shadow-lg">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous reading"
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
          aria-label="Next reading"
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

        <span className="mx-1 h-4 w-px bg-border" />

        <a
          className="px-1 text-xs underline underline-offset-2"
          href={`/entity/${DENSE_ENTITY_ID}?variant=${variant}&surface=${surface}`}
        >
          Probe
        </a>
        <a
          className="px-1 text-xs underline underline-offset-2"
          href={`/entity/x?variant=${variant}&surface=${surface}`}
        >
          All entities
        </a>
      </div>
    </div>
  );
}
