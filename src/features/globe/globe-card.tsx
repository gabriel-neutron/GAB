import { cn } from '@/shared/lib/utils';
import { askPanelFocus, landOnPanel, returnPanelFocus } from '@/shared/panel-focus';
import { PHONE_SHEET, SheetClose } from '@/shared/phone-sheet';
import type { Card } from '@gab/release/chain-card';

import { AssetCard } from './asset-card';
import type { GlobeData } from './globe-data';
import type { GlobeStore, Target } from './globe-store';
import { ArcCard, ExitCard } from './link-card';
import { useGlobeState } from './use-globe-state';

export interface GlobeCardProps {
  readonly store: GlobeStore;
  readonly data: GlobeData;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
}

function TargetCard({
  target,
  data,
  entityHref,
}: {
  readonly target: Target;
  readonly data: GlobeData;
  readonly entityHref: (id: string) => string;
}) {
  if (target.kind === 'arc') {
    const arc = data.arcInfo[target.id];
    return arc === undefined ? null : <ArcCard arc={arc} />;
  }
  if (target.kind === 'exit') {
    const exit = data.exitInfo[target.id];
    return exit === undefined ? null : <ExitCard exit={exit} />;
  }
  const card: Card | undefined = data.cards[target.id];
  return card === undefined ? null : (
    <AssetCard
      id={target.id}
      card={card}
      stage={data.stages.get(target.id) ?? null}
      entityHref={entityHref}
    />
  );
}

/** The card of what the reader selected on the globe, or the list of the features under one
 * click. It stands beside the globe on a wide screen and under it on a narrow one. */
export function GlobeCard({ store, data, entityHref }: GlobeCardProps) {
  const { panel, available } = useGlobeState(store);
  if (!available) return null;
  return (
    <div
      role="region"
      aria-label="Card of the selected entity"
      className={cn(
        'max-h-96 overflow-y-auto border-t border-border lg:max-h-128 lg:border-t-0 lg:border-l',
        PHONE_SHEET,
        panel.kind === 'none' ? 'max-md:hidden' : null,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || panel.kind === 'none') return;
        store.select(null);
        returnPanelFocus();
      }}
    >
      {panel.kind === 'none' ? null : (
        <SheetClose
          onClose={() => {
            store.select(null);
          }}
        />
      )}
      <div className="p-2">
        {panel.kind === 'none' ? <p>Select a point on the map.</p> : null}
        {panel.kind === 'target' ? (
          <TargetCard target={panel.target} data={data} entityHref={entityHref} />
        ) : null}
        {panel.kind === 'choice' ? (
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">{panel.choices.length} points under the click</h2>
            <p>Select one for its card.</p>
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
      </div>
      {/* The marker mounts with each new card or list and moves the focus into it. */}
      {panel.kind === 'none' ? null : (
        <span
          key={
            panel.kind === 'target'
              ? `${panel.target.kind}:${panel.target.id}`
              : `choice:${String(panel.choices.length)}`
          }
          ref={landOnPanel}
          hidden
        />
      )}
    </div>
  );
}
