/** A throwaway prototype. No route imports it, and it draws three separations of the four parts
 * of the entity detail page so that one can be picked by eye. Every control is read-only. */

import { useState, type ReactNode } from 'react';

import type { DocId } from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';

import { recordCells } from './draft';
import type { Dossier, SourceRef } from './dossier';
import { SourceMark } from './mark';
import { Pending } from './pending';
import { Rail } from './rail';
import { EntityRecord } from './record';
import { Relations } from './relations';

export interface SeparationProps {
  readonly dossier: Dossier;
  /** Where the trail of documents stands. The narrow pane cannot hold it beside the record. */
  readonly trail: 'beside' | 'below';
}

const SHELL = 'flex h-full min-w-0 flex-1 gap-4 p-4';

const COLUMN = 'min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain';

const CAPS = 'text-small/4 tracking-caps text-label uppercase';

const COUNT = 'font-mono text-small/4 tabular-nums text-label';

const RAIL_PANE = 'w-96 min-h-0 shrink-0';

type Mark = (sources: readonly SourceRef[]) => ReactNode;

function useMark(): Mark {
  const [active, setActive] = useState<DocId | null>(null);
  return (sources) => (
    <SourceMark sources={sources} activeSource={active} onSelectSource={setActive} />
  );
}

function Head({ dossier }: { readonly dossier: Dossier }) {
  return (
    <h1 className="flex min-w-0 items-baseline gap-2">
      <span className="min-w-0 truncate text-base" title={dossier.label}>
        {dossier.label}
      </span>
      <span className="shrink-0 text-xs text-label">{dossier.type}</span>
    </h1>
  );
}

function EntitySources({ dossier, mark }: { readonly dossier: Dossier; readonly mark: Mark }) {
  return (
    <div className="flex items-center gap-2">
      <span className={CAPS}>Sources of this entity</span>
      {mark(dossier.entitySources)}
    </div>
  );
}

// A band states the name of one part, and never a grouping of the claims inside the record:
// the vocabulary declares a key, a kind and a label for each claim, and it declares no group.
function Band({
  label,
  count,
  children,
}: {
  readonly label: string | null;
  readonly count: number | null;
  readonly children: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-2">
      {label === null ? null : (
        <p className="flex items-baseline gap-2 pb-1">
          <span className={CAPS}>{label}</span>
          {count === null ? null : <span className={COUNT}>{count}</span>}
        </p>
      )}
      {children}
    </div>
  );
}

/** Separation A. One hairline and one stated name for each part. Every part stays in view. */
export function SeparationRuled({ dossier, trail }: SeparationProps) {
  const mark = useMark();

  return (
    <div className={SHELL}>
      <div data-pane="record" className={COLUMN}>
        <Head dossier={dossier} />
        <Band label="Record" count={dossier.claimCount}>
          <EntityRecord mode="reading" cells={recordCells(dossier.rows, null)} mark={mark} />
        </Band>
        <Band label="Relations" count={dossier.relations.length}>
          <Relations relations={dossier.relations} mark={mark} deleting={{ offered: false }} />
        </Band>
        {/* The pending part states its own name and its own count, so this band adds the rule
            alone. Two headings for one part is the defect this shape must not carry. */}
        <Band label={null} count={null}>
          <Pending proposals={dossier.pending} mark={mark} />
        </Band>
        <Band label="Sources" count={dossier.sources.length}>
          <EntitySources dossier={dossier} mark={mark} />
          {trail === 'below' ? (
            <div className="mt-1 border-t border-border">
              <Rail sources={dossier.sources} activeSource={null} />
            </div>
          ) : null}
        </Band>
      </div>
      {trail === 'beside' ? (
        <div className={RAIL_PANE}>
          <Rail sources={dossier.sources} activeSource={null} />
        </div>
      ) : null}
    </div>
  );
}

type TailTab = 'relations' | 'pending' | 'sources';

const FIRST_TAB: TailTab = 'relations';

const TABS: readonly { readonly key: TailTab; readonly label: string }[] = [
  { key: 'relations', label: 'Relations' },
  { key: 'pending', label: 'Pending' },
  { key: 'sources', label: 'Sources' },
];

const TAB_CONTROL =
  'flex items-center gap-1.5 border-b-2 px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** Separation B. The record stands, and the three other parts share one panel behind a strip of
 * names. The count rides on the name, so a part that is out of view drops no evidence. */
export function SeparationTabbed({ dossier }: SeparationProps) {
  const mark = useMark();
  const [open, setOpen] = useState<TailTab>(FIRST_TAB);

  const counts: Readonly<Record<TailTab, number>> = {
    relations: dossier.relations.length,
    pending: dossier.pending.length,
    sources: dossier.sources.length,
  };

  return (
    <div className={SHELL}>
      <div data-pane="record" className={COLUMN}>
        <Head dossier={dossier} />
        <EntityRecord mode="reading" cells={recordCells(dossier.rows, null)} mark={mark} />

        <div role="tablist" aria-label="The parts under the record" className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={open === tab.key}
              className={cn(
                TAB_CONTROL,
                open === tab.key ? 'border-b-foreground' : 'border-b-transparent text-label',
              )}
              onClick={() => {
                setOpen(tab.key);
              }}
            >
              <span>{tab.label}</span>
              <span className={COUNT}>{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={open}>
          {open === 'relations' ? (
            <Relations relations={dossier.relations} mark={mark} deleting={{ offered: false }} />
          ) : null}
          {open === 'pending' ? <Pending proposals={dossier.pending} mark={mark} /> : null}
          {open === 'sources' ? (
            <div className="space-y-1">
              <EntitySources dossier={dossier} mark={mark} />
              <div className="border-t border-border">
                <Rail sources={dossier.sources} activeSource={null} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const TAIL_PANE =
  'w-96 min-h-0 shrink-0 space-y-2 overflow-y-auto overscroll-contain border-l border-border pl-4';

/** Separation C. Space separates the parts, and no rule and no name is added. At the width of the
 * rail one column is left, so the shape falls back to the page as it stands today. */
export function SeparationColumns({ dossier, trail }: SeparationProps) {
  const mark = useMark();

  const record = (
    <>
      <Head dossier={dossier} />
      <EntityRecord mode="reading" cells={recordCells(dossier.rows, null)} mark={mark} />
    </>
  );

  const tail = (
    <>
      <Relations relations={dossier.relations} mark={mark} deleting={{ offered: false }} />
      <Pending proposals={dossier.pending} mark={mark} />
      <EntitySources dossier={dossier} mark={mark} />
    </>
  );

  if (trail === 'below') {
    return (
      <div className={SHELL}>
        <div data-pane="record" className={COLUMN}>
          {record}
          {tail}
          <div className="border-t border-border">
            <Rail sources={dossier.sources} activeSource={null} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <div data-pane="record" className={COLUMN}>
        {record}
      </div>
      <div className={TAIL_PANE}>{tail}</div>
      <div className={RAIL_PANE}>
        <Rail sources={dossier.sources} activeSource={null} />
      </div>
    </div>
  );
}
