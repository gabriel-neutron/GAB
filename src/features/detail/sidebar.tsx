/**
 * The panel beside the map or the graph, 24 rem wide.
 *
 * **Two exports, and they are one job.** A canvas selects one of two things, an entity or a
 * relation, and this file draws whichever was selected in the one pane that sits beside the
 * canvas. `PANE` below is the geometry of that pane, and one copy of it is what keeps the two
 * panels the same width, the same ground and the same scroll.
 *
 * **`Sidebar` draws the entity.** UC5 is the use case: the analyst reads one entity in a narrow
 * sidebar, and audits its provenance on the full page. **`RelationSidebar` draws the relation.**
 * Each one carries its own note below.
 *
 * **Neither carries a rail.** There is no room for one, so a mark opens its source in a popover,
 * and that popover carries one way out to the full page.
 *
 * **Neither knows anything about its neighbour.** Each takes no `className`, no width and no
 * callback to a canvas. Each carries its own width, and the route composes it beside the
 * canvas.
 *
 * They draw and they derive nothing: `./dossier` decided every list, every word and every order.
 */

import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { Dossier, RelationDossier, SourceRef } from './dossier';
import { SourceCount } from './mark';
import { Pending } from './pending';
import { EntityRecord } from './record';
import { Relations } from './relations';

export interface SidebarProps {
  readonly dossier: Dossier;
}

/**
 * 24 rem, which is `w-96`. The sidebar holds its own scroll and its own hairline.
 *
 * It states **no height**. The route states the geometry of the row, and the sidebar stretches
 * to that row, so it states nothing about its neighbour.
 */
const PANE =
  'w-96 min-h-0 shrink-0 space-y-3 overflow-y-auto overscroll-contain border-l border-border bg-sidebar p-2 text-sidebar-foreground';

export function Sidebar({ dossier }: SidebarProps) {
  // The mark of every claim, relation and proposal. It opens the source in a popover, with the
  // cards of the whole dossier behind it and one way out to the full page.
  //
  // The sidebar states the **count** of documents and opens every one of them. A number here
  // would point at a rail, and this surface has no rail to point at.
  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceCount sources={sources} cards={dossier.sources} entityId={dossier.entityId} />
  );

  return (
    <aside aria-label={dossier.label} className={PANE}>
      {/* The name and the type, and nothing else at the top. No identifier and no
          coordinate: the analyst arrived from the map or from the graph, and he already knows
          which point he selected. */}
      <h1 className="flex items-baseline gap-2">
        <span className="text-base">{dossier.label}</span>
        <span className="text-xs text-label">{dossier.type}</span>
      </h1>

      {/* **The defect this key exists to not repeat.** Every control is read-only, so each one
          draws its value with `defaultValue`, and React reads that once. In the sidebar the
          entity changes with **no navigation at all** — a selection on the map swaps the whole
          dossier under the same mounted element — so React reconciled the record and a field
          kept the previous entity's value under the correct label. The key makes React build a
          new record instead. **Do not remove it.** */}
      <EntityRecord key={dossier.entityId} rows={dossier.rows} mark={mark} />

      <Relations relations={dossier.relations} mark={mark} />
      <Pending proposals={dossier.pending} mark={mark} />
    </aside>
  );
}

export interface RelationSidebarProps {
  readonly relation: RelationDossier;
}

/**
 * The relation, in the same pane.
 *
 * **A click on a line selects a relation on both canvases, and nothing was drawn for it.** The
 * graph route held one provisional sentence, which told the analyst how this application is cut
 * into surfaces, and the map held nothing at all after the footer of its rail was removed.
 *
 * **It is simpler than the entity panel, and the operator asked for exactly that**: the entity at
 * each end, the type, and the sources. There is no record of claims, no list of relations and no
 * proposal here.
 *
 * **The direction comes from `shared/canvas-label.ts`**, which both canvases already draw over a
 * line. The panel writes no second wording for it: one arrow, one order of the words, and three
 * surfaces that say one thing.
 */
export function RelationSidebar({ relation }: RelationSidebarProps) {
  return (
    <aside aria-label={relation.sentence} className={PANE}>
      {/* **The name of the heading is the sentence, and not the three lines.** The arrow is a
          picture of the direction. A reader who is given the lines hears "down arrow", and the
          order of the words in the sentence says the same thing in words. */}
      <h1 aria-label={relation.sentence} className="space-y-0.5">
        {relation.rows.map((row) => (
          // Rule 16: each line truncates on its own and none of them wraps, exactly as the label
          // over a canvas does. The full line is under `title`.
          <span
            key={row.key}
            title={row.text}
            className={cn(
              'block truncate',
              row.key === 'type' ? 'text-xs text-label' : 'text-base',
            )}
          >
            {row.text}
          </span>
        ))}
      </h1>

      {/* M6 and M9: the interval is written at both ends, and a relation that carries none draws
          a blank under a header that names the key. An absence must never read as a fault, and a
          row that vanishes tells the analyst nothing about what the record holds. */}
      <div className="flex items-baseline gap-2 text-[11px]/4">
        <span className="w-20 shrink-0 text-label">Validity</span>
        <span
          title={relation.interval ?? undefined}
          className="min-w-0 flex-1 truncate font-mono tabular-nums"
        >
          {relation.interval}
        </span>
      </div>

      {/* **The presentation is the one the entity view already uses** — the count of documents,
          which opens every card in one popover, under the header the full page writes over the
          sources of an entity. **What "the sources of a relation" are is open, and the tracker
          carries the question.** This panel answers nothing: it draws the documents the relation
          cites. The entry that carries that list is **S2**: the source is listed at entity,
          relation and attribute level. The tracker also names M8: `src` is never empty.
          `./dossier.ts` holds the correction, and it is reported to the operator. */}
      <div className="flex items-center gap-2">
        <span className="text-[11px]/4 tracking-[0.06em] text-label uppercase">
          Sources of this relation
        </span>
        {/* A relation has no full page, so the popover carries no way out — see
            `SourceCountProps.entityId`. */}
        <SourceCount sources={relation.sources} cards={relation.cards} entityId={null} />
      </div>
    </aside>
  );
}
