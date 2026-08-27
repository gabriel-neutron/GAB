import { useState } from 'react';
import type { ReactNode } from 'react';

import type { DocId } from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';

import { surfaceHref } from './address';
import type { TypedValue } from './claims';
import { DeleteControl } from './delete-control';
import { draftsAfterSave, pendingEdit, recordCells, typedInto, type Drafts } from './draft';
import type { Dossier, SourceRef } from './dossier';
import { SourceMark } from './mark';
import { NewRelation } from './new-relation';
import { Pending } from './pending';
import { Rail } from './rail';
import { EntityRecord } from './record';
import { Relations } from './relations';
import { SaveBar } from './save-bar';
import { saveClaims, saveWords, type SaveState } from './save';
import {
  changeStructure,
  structureSaid,
  type StructureAct,
  type StructureState,
} from './structure';

export interface DetailPageProps {
  readonly dossier: Dossier;
  /** The source named by `?src=`, read once by the route. `null` is the normal arrival. */
  readonly arrivedAtSource: DocId | null;
  /** Read the record again, so the page draws what landed. The route holds the router. */
  readonly onSaved: () => Promise<void>;
  /** The entity is gone, so this page draws nothing. The route decides where the analyst goes. */
  readonly onDeleted: () => Promise<void>;
}

const IDLE: SaveState = { step: 'idle' };
const NO_ACT: StructureState = { step: 'idle' };

// The route gives the main element the rest of the window height, so `h-full` settles a pane.
const SHELL = 'flex h-full gap-4 p-4';

const ON_A_SURFACE = 'shrink-0 text-small/4 text-primary underline underline-offset-2';

// Two live regions stand on this page, and a reader needs to know which one spoke.
const STRUCTURE_SAYS = 'The shape of the record';

const SAID = 'text-small/4';

export function DetailPage({ dossier, arrivedAtSource, onSaved, onDeleted }: DetailPageProps) {
  // The active source is never written back to the address. Two writers of one identity fight.
  const [activeSource, setActiveSource] = useState<DocId | null>(arrivedAtSource);

  // A half-typed value dies with the view. An identifier restored from storage three days later
  // is worse than one that was lost, because nothing on the screen says how old it is.
  const [drafts, setDrafts] = useState<Drafts>(() => new Map());
  const [save, setSave] = useState<SaveState>(IDLE);

  // Making a relation, destroying an element and saving a claim are one queue. Two acts in
  // flight at once would write two proposals against a record the first one has already moved,
  // and a delete that lands on a claim in flight destroys the row that claim was written to.
  const [structure, setStructure] = useState<StructureState>(NO_ACT);
  const busy = structure.step === 'working' || save.step === 'saving';

  const said = structureSaid(structure);

  const cells = recordCells(dossier.rows, drafts);
  const edit = pendingEdit(dossier.rows, drafts);

  // A keystroke clears the sentence of the last act, and never the act in flight: the step in
  // flight is what disables the button, and a second act for one value writes a second proposal.
  const onEdit = (key: string, typed: TypedValue): void => {
    setSave((current) => (current.step === 'saving' ? current : IDLE));
    setDrafts(typedInto(dossier.rows, drafts, key, typed));
  };

  // A save is an event handler and never an effect. The record is read again on the way out, so
  // the page draws the value that landed and not the value that was sent. A second click while
  // one act is in flight writes a second proposal for the same value, so the step guards too.
  const onSave = (): void => {
    if (!edit.ready || busy) return;
    const sent = drafts;
    const act = edit.attrs;
    setSave({ step: 'saving' });
    void saveClaims(dossier.entityId, act).then(async (state) => {
      setSave(state);
      if (state.step !== 'signed') return;
      setDrafts((current) => draftsAfterSave(current, sent, act));
      await onSaved();
    });
  };

  // A deleted entity leaves no page to draw, so the route takes the analyst away. Every other
  // act reads the record again, and the page then draws what landed and not what was sent.
  const onStructure = (act: StructureAct): void => {
    if (busy) return;
    setStructure({ step: 'working', deed: act.op });
    void changeStructure(act).then(async (state) => {
      setStructure(state);
      if (state.step !== 'signed') return;
      await (act.op === 'delete_entity' ? onDeleted() : onSaved());
    });
  };

  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceMark sources={sources} activeSource={activeSource} onSelectSource={setActiveSource} />
  );

  return (
    <div className={SHELL}>
      {/* The left pane. `min-h-0` is what lets a flex child scroll instead of growing, and
          `overscroll-contain` is what stops the window from taking over at the end of it. */}
      <div
        data-pane="record"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain"
      >
        <div className="flex items-baseline gap-2">
          <h1 className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate text-base" title={dossier.label}>
              {dossier.label}
            </span>
            <span className="shrink-0 text-xs text-label">{dossier.type}</span>
            {/* The extracted word is kept where it was not a live type, and it is drawn, or the
                entry the analyst wrote is lost to every reader of the record. */}
            {dossier.proposedType === null ? null : (
              <span className="shrink-0 text-small/4 text-candidate">
                {`proposed as ${dossier.proposedType}`}
              </span>
            )}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* The map link is drawn only where the map draws the entity. A link that opens a
                surface which then selects nothing states a position the record does not hold. */}
            <nav aria-label="This entity on a canvas" className="flex gap-3">
              <a href={surfaceHref('graph', dossier.entityId)} className={ON_A_SURFACE}>
                Show on the graph
              </a>
              {dossier.drawnOnMap ? (
                <a href={surfaceHref('map', dossier.entityId)} className={ON_A_SURFACE}>
                  Show on the map
                </a>
              ) : null}
            </nav>
            <DeleteControl
              name={dossier.label}
              busy={busy}
              onDelete={() => {
                onStructure({ op: 'delete_entity', targetId: dossier.entityId });
              }}
            />
          </div>
        </div>

        {/* The result of an act must reach a screen reader without a second look at the page.
            An act whose result is not known interrupts: the analyst acts on it before anything. */}
        <p
          role={said.urgent ? 'alert' : 'status'}
          aria-label={STRUCTURE_SAYS}
          className={cn(SAID, said.urgent ? 'text-destructive' : 'text-label')}
        >
          {said.sentence}
        </p>

        <SaveBar sentence={saveWords(save, edit)} canSave={edit.ready && !busy} onSave={onSave} />

        <EntityRecord mode="writing" cells={cells} mark={mark} onEdit={onEdit} />
        <Relations
          relations={dossier.relations}
          mark={mark}
          deleting={{
            offered: true,
            busy,
            onDelete: (relationId) => {
              onStructure({ op: 'delete_relation', targetId: relationId });
            },
          }}
        />
        <NewRelation
          srcId={dossier.entityId}
          choices={dossier.linkChoices}
          busy={busy}
          onCreate={onStructure}
        />
        <Pending proposals={dossier.pending} mark={mark} />

        {/* M8: the entity itself names the documents it comes from, and no control hides
            them. The mark is the same one the claims carry. */}
        <div className="flex items-center gap-2">
          <span className="text-small/4 tracking-caps text-label uppercase">
            Sources of this entity
          </span>
          {mark(dossier.entitySources)}
        </div>
      </div>

      <div className="w-96 min-h-0 shrink-0">
        {/* The rail follows `activeSource` on its own, and its mount run is the arrival
            case. `arrivedAtSource` reaches it through the state above and by no other path:
            two writers of one scroll position fight each other. */}
        <Rail sources={dossier.sources} activeSource={activeSource} />
      </div>
    </div>
  );
}
