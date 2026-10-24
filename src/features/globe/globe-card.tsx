import type { ReactNode, RefObject } from 'react';

import { askPanelFocus } from '@/shared/panel-focus';
import { SelectionPanel } from '@/shared/selection-panel';

import type { GlobeStore, Target } from './globe-store';
import { useGlobeState } from './use-globe-state';

export interface GlobeCardProps {
  readonly store: GlobeStore;
  /** The card of one target. The route gives the panel of the graph for an entity and a relation,
   * so the two pages show one card. */
  readonly cardOf: (target: Target) => ReactNode;
  /** Where the focus goes when the control that opened the card is gone. */
  readonly fallback?: RefObject<HTMLElement | null> | undefined;
}

/** The card of what the reader selected on the map, or the list of the features under one click.
 * It stands beside the map on a wide screen and over it on a phone. */
export function GlobeCard({ store, cardOf, fallback }: GlobeCardProps) {
  const { panel, available } = useGlobeState(store);
  if (!available) return null;
  return (
    <SelectionPanel
      shown={
        panel.kind === 'none'
          ? null
          : panel.kind === 'target'
            ? `${panel.target.kind}:${panel.target.id}`
            : `choice:${panel.choices.map((one) => one.target.id).join(',')}`
      }
      onClose={() => {
        store.select(null);
      }}
      fallback={fallback}
      className="border-t md:col-start-3 md:row-start-1 md:border-t-0 md:border-l"
    >
      {panel.kind === 'target' ? cardOf(panel.target) : null}
      {panel.kind === 'choice' ? (
        <div className="flex flex-col gap-1 p-2">
          <h2 className="font-medium">{panel.choices.length} points under the click</h2>
          <ul className="flex flex-col">
            {panel.choices.map((one) => (
              <li key={`${one.target.kind}:${one.target.id}`}>
                <button
                  type="button"
                  className="w-full px-1 py-0.5 text-left transition-colors duration-100 outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => {
                    askPanelFocus();
                    store.select(one.target);
                  }}
                >
                  {one.label}
                  {one.target.kind === 'exit' ? ' (exit point)' : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SelectionPanel>
  );
}
