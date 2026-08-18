/**
 * The same entity, 24 rem wide, beside the map or the graph.
 *
 * Built from `docs/detail-surface.md` §4.5, and from §4.1, §4.6, §4.7, §5.1 and §5.5. UC5 is
 * the use case: the analyst reads one entity in a narrow sidebar, and audits its provenance on
 * the full page.
 *
 * **It carries no rail** (§4.5). There is no room for one, so a mark opens its source in a
 * popover, and that popover carries one way out to the full page.
 *
 * **It knows nothing about its neighbour** (§4.5). It takes no `className`, no width and no
 * callback to a canvas. It carries its own width, and the route composes it beside the canvas.
 *
 * It draws and it derives nothing: `./dossier` decided every list, every word and every order,
 * so this file holds no `.map` at all. Each list belongs to a child.
 */

import type { ReactNode } from 'react';

import type { Dossier, SourceRef } from './dossier';
import { SourceCount } from './mark';
import { Pending } from './pending';
import { EntityRecord } from './record';
import { Relations } from './relations';

export interface SidebarProps {
  readonly dossier: Dossier;
}

/**
 * §4.5: 24 rem, which is `w-96`. The sidebar holds its own scroll and its own hairline.
 *
 * It states **no height**. The route states the geometry of the row (§4.5), and the sidebar
 * stretches to that row, so it states nothing about its neighbour.
 */
const PANE =
  'w-96 min-h-0 shrink-0 space-y-3 overflow-y-auto overscroll-contain border-l border-border bg-sidebar p-2 text-sidebar-foreground';

export function Sidebar({ dossier }: SidebarProps) {
  // §5.1: the mark of every claim, relation and proposal. §4.5 makes it open the source in a
  // popover, with the cards of the whole dossier behind it and one way out to the full page.
  //
  // #68: the sidebar states the **count** of documents and opens every one of them. A number
  // here would point at a rail, and §4.5 gives this surface no rail to point at.
  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceCount sources={sources} cards={dossier.sources} entityId={dossier.entityId} />
  );

  return (
    <aside aria-label={dossier.label} className={PANE}>
      {/* §4.5: the name and the type, and nothing else at the top. No identifier and no
          coordinate: the analyst arrived from the map or from the graph, and he already knows
          which point he selected. */}
      <h1 className="flex items-baseline gap-2">
        <span className="text-base">{dossier.label}</span>
        <span className="text-xs text-label">{dossier.type}</span>
      </h1>

      {/* **The defect this key exists to not repeat.** §5.3 makes every control read-only, so
          each one draws its value with `defaultValue`, and React reads that once. In the
          sidebar the entity changes with **no navigation at all** — a selection on the map
          swaps the whole dossier under the same mounted element — so React reconciled the
          record and a field kept the previous entity's value under the correct label. The key
          makes React build a new record instead. **Do not remove it.** */}
      <EntityRecord key={dossier.entityId} rows={dossier.rows} mark={mark} />

      <Relations relations={dossier.relations} mark={mark} />
      <Pending proposals={dossier.pending} mark={mark} />
    </aside>
  );
}
