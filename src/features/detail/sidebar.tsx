import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import { entityHref } from './address';
import type { Dossier, RelationDossier, SourceRef } from './dossier';
import { SourceCount } from './mark';
import { Pending } from './pending';
import { EntityRecord } from './record';
import { Relations } from './relations';

export interface SidebarProps {
  readonly dossier: Dossier;
}

const WAY_OUT = 'Open the page';

/** 24 rem, which is `w-96`. It states no height: the route states the geometry of the row. */
const PANE =
  'w-96 min-h-0 shrink-0 space-y-3 overflow-y-auto overscroll-contain border-l border-border bg-sidebar p-2 text-sidebar-foreground';

export function Sidebar({ dossier }: SidebarProps) {
  // The sidebar states the count of documents, and not a number. A number would point at a
  // rail, and this surface has no rail.
  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceCount sources={sources} cards={dossier.sources} entityId={dossier.entityId} />
  );

  return (
    <aside aria-label={dossier.label} className={PANE}>
      <div className="flex items-baseline gap-2">
        <h1 className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate text-base" title={dossier.label}>
            {dossier.label}
          </span>
          <span className="shrink-0 text-xs text-label">{dossier.type}</span>
        </h1>
        {/* A panel beside a canvas holds a record and not the whole dossier. The page carries
            the rail of documents, which no panel of 24 rem can hold beside a canvas. */}
        <a
          href={entityHref(dossier.entityId, null)}
          className="ml-auto shrink-0 text-small/4 text-primary underline underline-offset-2"
        >
          {WAY_OUT}
        </a>
      </div>

      {/* Every control is read-only and draws with `defaultValue`, which React reads once. A
          selection swaps the dossier under the same mounted element, so a field kept the
          previous value. The key makes React build a new record. Do not remove it. */}
      <EntityRecord key={dossier.entityId} rows={dossier.rows} mark={mark} />

      <Relations relations={dossier.relations} mark={mark} />
      <Pending proposals={dossier.pending} mark={mark} />
    </aside>
  );
}

export interface RelationSidebarProps {
  readonly relation: RelationDossier;
}

export function RelationSidebar({ relation }: RelationSidebarProps) {
  return (
    <aside aria-label={relation.sentence} className={PANE}>
      {/* **The name of the heading is the sentence, and not the three lines.** The arrow is a
          picture of the direction. A reader who is given the lines hears "down arrow", and the
          order of the words in the sentence says the same thing in words. */}
      <h1 aria-label={relation.sentence} className="space-y-0.5">
        {relation.rows.map((row) => (
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
      <div className="flex items-baseline gap-2 text-small/4">
        <span className="w-20 shrink-0 text-label">Validity</span>
        <span
          title={relation.interval ?? undefined}
          className="min-w-0 flex-1 truncate font-mono tabular-nums"
        >
          {relation.interval}
        </span>
      </div>

      {/* S2: the source is listed at entity, relation and attribute level. M8: `src` is never
          empty, and `./dossier.ts` holds the correction. */}
      <div className="flex items-center gap-2">
        <span className="text-small/4 tracking-caps text-label uppercase">
          Sources of this relation
        </span>
        {/* A relation has no full page, so the popover carries no way out. */}
        <SourceCount sources={relation.sources} cards={relation.cards} entityId={null} />
      </div>
    </aside>
  );
}
