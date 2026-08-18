/**
 * The switch between the two grounds, placed on the map itself.
 *
 * **It left the rail** — #81 rows A2 and B8. The operator kept the two grounds and asked for the
 * control to be an icon button on top of the map, and not a line in the footer of a layer rail.
 * The rail lists the entity types; a ground is not one of them, and ADR 0005 §6 keeps the type
 * list a projection of the entity types.
 *
 * **It is a switch of two and never a list** — §4.3 gives the map two grounds, both in the style
 * with one hidden, so a change is a layout property and not a style that is built again.
 *
 * **The icon says which ground a click brings, and the name says both.** A glyph alone tells a
 * reader who cannot see it neither the ground in force nor the one they would get. The name
 * carries the two, and the icon carries the destination: the map is showing the plan, so the
 * button offers imagery.
 *
 * **It is a sibling of the live canvas, and never an ancestor of one** — `CANVAS.md`. So it holds
 * ordinary React state, exactly as `./rail.tsx` does, and it drives the map through the handle.
 * `adapter.ts` owns the workspace field, and this state is an echo that dies with the view.
 *
 * **The credit is not here.** MapLibre draws the attribution over the canvas, from the source of
 * whichever ground layer is visible. A credit beside this control would be a caption, and §5.5
 * says an attribution is an obligation of a licence and not a caption.
 */

import { Layers2, Satellite } from 'lucide-react';
import { useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';

import type { MapHandle } from './adapter';
import type { Ground } from './workspace';

export interface GroundControlProps {
  /**
   * The live map, in the ref that the caller holds. The act goes through it, and never through
   * the library — `CANVAS.md`.
   */
  readonly map: RefObject<MapHandle | null>;
}

/** What each ground is called for a reader, in the words §4.3 uses. */
const GROUND_NAME: Readonly<Record<Ground, string>> = { plan: 'plan', imagery: 'imagery' };

export function GroundControl({ map }: GroundControlProps) {
  /**
   * The ground the map draws. It is an echo of the handle: `adapter.ts` stores the choice, and
   * this dies with the view. The caller mounts this control after the map exists, so the ref is
   * full at the first read; the fallback states what a control with no map draws, and it invents
   * no setting.
   */
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
        // **The one writer** — §4.3. This control writes no workspace field: the adapter switches
        // the layout property of the two ground layers and stores the choice.
        live.setGround(other);
        setGround(live.ground);
      }}
      className={cn(
        // It floats over a canvas, so it takes the pointer back and states its own ground: the
        // element under it is a map, and a transparent control would be unreadable on it.
        'pointer-events-auto absolute top-2 right-2 z-10 flex size-8 items-center justify-center',
        'border border-border bg-popover text-popover-foreground',
        'transition-colors duration-100 hover:bg-muted',
        'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {/* The icon is the ground a click brings, and not the one in force: a control says what it
          does. It is hidden from a reader, because the name above carries both grounds. */}
      {other === 'imagery' ? (
        <Satellite size={16} aria-hidden="true" />
      ) : (
        <Layers2 size={16} aria-hidden="true" />
      )}
    </button>
  );
}
