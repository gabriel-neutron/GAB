import { Layers2, Satellite } from 'lucide-react';
import { useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';

import type { MapHandle } from './adapter';
import type { Ground } from './workspace';

export interface GroundControlProps {
  readonly map: RefObject<MapHandle | null>;
}

const GROUND_NAME: Readonly<Record<Ground, string>> = { plan: 'plan', imagery: 'imagery' };

export function GroundControl({ map }: GroundControlProps) {
  const [ground, setGround] = useState<Ground>(() => map.current?.ground ?? 'plan');

  const other: Ground = ground === 'plan' ? 'imagery' : 'plan';
  const says = `Ground: ${GROUND_NAME[ground]}. Change to ${GROUND_NAME[other]}.`;

  return (
    <button
      type="button"
      data-ground={ground}
      aria-label={says}
      title={says}
      onClick={() => {
        const live = map.current;
        if (live === null) return;
        live.setGround(other);
        setGround(live.ground);
      }}
      className={cn(
        // It floats over a canvas, so `pointer-events-auto` takes the pointer back from it.
        'pointer-events-auto absolute top-2 right-2 z-10 flex size-8 items-center justify-center',
        'border border-border bg-popover text-popover-foreground',
        'transition-colors duration-100 hover:bg-muted',
        'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {/* Icon-only, so the `aria-label` names both grounds. The icon shows the ground a
          click brings, and not the one in force. */}
      {other === 'imagery' ? (
        <Satellite size={16} aria-hidden="true" />
      ) : (
        <Layers2 size={16} aria-hidden="true" />
      )}
    </button>
  );
}
