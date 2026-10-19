import { useState } from 'react';
import type { ReactNode } from 'react';

import type { AttributeEdit } from '@gab/proposal/attribute-value';

import type { DocId } from '@/shared/read/model';
import { DataTable } from '@/shared/page/data-table';
import { KeyValue } from '@/shared/page/key-value';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { SaidLine } from '@/shared/said-line';
import { useWriterOnline } from '@/shared/write/writer-status';

import { claimHref, surfaceHref, vesselHref } from './address';
import type { TypedValue } from './claims';
import { DeleteControl } from './delete-control';
import { draftsAfterSave, pendingEdit, recordCells, typedInto, type Drafts } from './draft';
import type { Dossier, SourceRef } from './dossier';
import { EditSwitch, type DetailView } from './edit-switch';
import { EventLane } from './event-lane';
import { SourceMark } from './mark';
import { NewClaim } from './new-claim';
import { NewRelation } from './new-relation';
import { Pending } from './pending';
import { Rail } from './rail';
import { EntityRecord } from './record';
import { Relations } from './relations';
import { Rename } from './rename';
import { SaveBar } from './save-bar';
import { saveClaims, saveSaid, type SaveState } from './save';
import {
  changeStructure,
  structureSaid,
  type StructureAct,
  type StructureState,
} from './structure';

interface DetailPageProps {
  readonly dossier: Dossier;
  /** The source named by `?src=`, read once by the route. `null` is the normal arrival. */
  readonly arrivedAtSource: DocId | null;
  /** Read the record again, so the page draws what landed. The route holds the router. */
  readonly onSaved: () => Promise<void>;
  /** The entity is gone, so this page draws nothing. The route decides where the analyst goes. */
  readonly onDeleted: () => Promise<void>;
}

interface SourceSelection {
  readonly source: DocId | null;
  readonly count: number;
}

const IDLE: SaveState = { step: 'idle' };
const NO_ACT: StructureState = { step: 'idle' };

// Two live regions stand on this page, and a reader needs to know which one spoke.
const STRUCTURE_SAYS = 'The shape of the record';

export function DetailPage({ dossier, arrivedAtSource, onSaved, onDeleted }: DetailPageProps) {
  // Departure: the active source is never written back to the address. Two writers of one
  // identity fight.
  const [selection, setSelection] = useState<SourceSelection>({
    source: arrivedAtSource,
    count: 0,
  });
  const activeSource = selection.source;

  const onSelectSource = (source: DocId): void => {
    setSelection((current) => ({ source, count: current.count + 1 }));
  };

  // A half-typed value dies with the view. An identifier restored from storage three days later
  // is worse than one that was lost, because nothing on the screen says how old it is.
  const [drafts, setDrafts] = useState<Drafts>(() => new Map());
  const [save, setSave] = useState<SaveState>(IDLE);

  // Making a relation, destroying an element and saving a claim are one queue. Two acts in
  // flight at once would write two proposals against a record the first one has already moved,
  // and a delete that lands on a claim in flight destroys the row that claim was written to.
  const [structure, setStructure] = useState<StructureState>(NO_ACT);
  // Until the reload lands, the page draws the record from before the act. A control left open
  // in that time offers a second act on an element that is already gone.
  const [reloading, setReloading] = useState(false);
  const busy = structure.step === 'working' || save.step === 'working' || reloading;

  // A draft outlives a move to the reading view, which draws the stored record. A switch that
  // threw the draft away would lose the one thing the analyst typed.
  const [view, setView] = useState<DetailView>('reading');
  // The edit entries need the write service. When it goes offline, the page draws the record.
  const writerOnline = useWriterOnline();
  const writing = view === 'writing' && writerOnline;

  const said = structureSaid(structure);

  const cells = recordCells(dossier.rows, writing ? drafts : null);
  const edit = pendingEdit(dossier.rows, drafts);

  // A keystroke clears the sentence of the last act, and never the act in flight: the step in
  // flight is what disables the button, and a second act for one value writes a second proposal.
  const onEdit = (key: string, typed: TypedValue): void => {
    setSave((current) => (current.step === 'working' ? current : IDLE));
    setDrafts(typedInto(dossier.rows, drafts, key, typed));
  };

  // Departure: a reload that fails is dropped here. The route draws its own failed read, and the
  // lock lifts in both cases, so the page never stays locked.
  const reloadAfterSigned = async (reload: () => Promise<void>): Promise<void> => {
    setReloading(true);
    await reload().catch(() => undefined);
    setReloading(false);
  };

  // A save is an event handler and never an effect. The record is read again on the way out, so
  // the page draws the value that landed and not the value that was sent. A second click while
  // one act is in flight writes a second proposal for the same value, so the step guards too.
  const onSave = (): void => {
    if (!edit.ready || busy) return;
    const sent = drafts;
    const act = edit.attrs;
    setSave({ step: 'working' });
    void saveClaims(dossier.entityId, act).then(async (state) => {
      setSave(state);
      if (state.step !== 'done') return;
      setDrafts((current) => draftsAfterSave(current, sent, act));
      await reloadAfterSigned(onSaved);
    });
  };

  // A minted claim is its own act, as a new relation is. It carries a key the record does not
  // hold, so no draft of the record stands for it and none is cleared when it lands.
  const onMint = async (attrs: AttributeEdit): Promise<SaveState> => {
    if (busy) return IDLE;
    setSave({ step: 'working' });
    const state = await saveClaims(dossier.entityId, attrs);
    setSave(state);
    if (state.step === 'done') void reloadAfterSigned(onSaved);
    return state;
  };

  // A deleted entity leaves no page to draw, so the route takes the analyst away. Every other
  // act reads the record again, and the page then draws what landed and not what was sent.
  const sendStructure = async (act: StructureAct): Promise<StructureState> => {
    if (busy) return NO_ACT;
    setStructure({ step: 'working', deed: act.op });
    const state = await changeStructure(act);
    setStructure(state);
    if (state.step === 'done')
      void reloadAfterSigned(act.op === 'delete_entity' ? onDeleted : onSaved);
    return state;
  };

  const onStructure = (act: StructureAct): void => {
    void sendStructure(act);
  };

  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceMark sources={sources} activeSource={activeSource} onSelectSource={onSelectSource} />
  );

  const facts = dossier.facts;
  // A row links its claim page only where the release holds that claim.
  const claimed = new Set(facts?.claimIds ?? []);
  const claimOf = (id: string): string | null => (claimed.has(id) ? claimHref(id) : null);
  const claimOfKey = (key: string): string | null => claimOf(`${dossier.entityId}/${key}`);
  const events = facts?.events ?? null;
  const detail = (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span>{dossier.type}</span>
        {/* The extracted word is kept where it was not a live type, and it is drawn, or the
            entry the analyst wrote is lost to every reader of the record. */}
        {dossier.proposedType === null ? null : (
          <span>{`proposed as ${dossier.proposedType}`}</span>
        )}
        {/* The words stand beside the type, because they say what the entity IS and not what a
            reader may do with it: this position was borrowed, and it was borrowed from that
            entity. */}
        {dossier.positionFrom === null ? null : (
          <span data-position-from="">{dossier.positionFrom}</span>
        )}
      </p>
      {/* Each public claim says who decided it. */}
      {dossier.decision === null ? null : <p data-decision="">{dossier.decision}</p>}
      {/* A double click stops at each hyphen of the value, so one click selects all of it. */}
      <p data-identifier="">
        Identifier{' '}
        <code className="font-mono break-all text-foreground select-all">{dossier.entityId}</code>
      </p>
    </>
  );

  return (
    <ReadingPage>
      <PageHeader
        title={dossier.label}
        detail={detail}
        actions={
          <>
            {/* The map link is drawn only where the map draws the entity. A link that opens a
                  surface which then selects nothing states a position the record does not
                  hold. */}
            <nav aria-label="This entity on a canvas" className="flex gap-3">
              <a href={surfaceHref('graph', dossier.entityId)} className={READING_LINK}>
                Show on the graph
              </a>
              {dossier.drawnOnMap ? (
                <a href={surfaceHref('map', dossier.entityId)} className={READING_LINK}>
                  Show on the map
                </a>
              ) : null}
            </nav>
            {writerOnline ? <EditSwitch view={view} busy={busy} onSwitch={setView} /> : null}
            {writing ? (
              <DeleteControl
                name={dossier.label}
                busy={busy}
                onDelete={() => {
                  onStructure({ op: 'delete_entity', targetId: dossier.entityId });
                }}
              />
            ) : null}
          </>
        }
      />

      {facts === null ||
      (facts.imo === null &&
        facts.merged.length === 0 &&
        facts.label === null &&
        facts.address === null) ? null : (
        <KeyValue
          entries={[
            ...(facts.imo === null
              ? []
              : [
                  {
                    key: 'Timeline',
                    value: (
                      <a className={READING_LINK} href={vesselHref(facts.imo)}>
                        {`IMO ${facts.imo}`}
                      </a>
                    ),
                  },
                ]),
            ...(facts.label === null
              ? []
              : [
                  { key: 'Origin', value: facts.label.origin },
                  { key: 'Licence', value: facts.label.licence },
                ]),
            ...(facts.address === null
              ? []
              : [{ key: 'Permanent address', value: facts.address, figure: true as const }]),
            ...(facts.merged.length === 0
              ? []
              : [
                  {
                    key: 'Merged identifiers',
                    value: facts.merged.map((id) => <p key={id}>{id}</p>),
                    figure: true as const,
                  },
                ]),
          ]}
        />
      )}

      {writing ? (
        <div className="flex flex-col gap-3">
          <Rename
            entityId={dossier.entityId}
            stored={{ label: dossier.label, type: dossier.type }}
            choices={dossier.typeChoices}
            busy={busy}
            onRename={onStructure}
          />
          <SaidLine said={said} label={STRUCTURE_SAYS} />
          <SaveBar said={saveSaid(save, edit)} canSave={edit.ready && !busy} onSave={onSave} />
        </div>
      ) : null}

      {/* The control that mints a key is a control of the record, so it stands inside that
            part and never between two parts. */}
      <PageSection title="Record">
        {/* EntityRecord stays one element at one position across a mode switch, so React
              re-renders it in place instead of tearing down and remounting every field. */}
        <EntityRecord
          {...(writing
            ? { mode: 'writing', cells, mark, onEdit, claimHref: claimOfKey }
            : { mode: 'reading', cells, mark, claimHref: claimOfKey })}
        />
        {writing ? <NewClaim rows={dossier.rows} busy={busy} onMint={onMint} /> : null}
      </PageSection>

      {/* The form that makes a relation is a control of the relations, so it stands inside
            that part and never between two parts. */}
      <PageSection title="Relations">
        <Relations
          relations={dossier.relations}
          mark={mark}
          claimHref={claimOf}
          deleting={
            writing
              ? {
                  offered: true,
                  busy,
                  onDelete: (relationId) => {
                    onStructure({ op: 'delete_relation', targetId: relationId });
                  },
                }
              : { offered: false }
          }
        />
        {writing ? (
          <NewRelation
            srcId={dossier.entityId}
            choices={dossier.linkChoices}
            busy={busy}
            onCreate={sendStructure}
          />
        ) : null}
      </PageSection>

      {facts === null || facts.claims.length === 0 ? null : (
        <PageSection title="Claims of the release">
          <DataTable
            name="Claims of the release"
            empty="The release holds no claim about this entity."
            columns={[
              {
                key: 'claim',
                header: 'Claim',
                cell: (line) => (
                  <a className={READING_LINK} href={claimHref(line.id)}>
                    {line.text}
                  </a>
                ),
              },
              { key: 'label', header: 'Label', cell: (line) => line.origin },
              { key: 'licence', header: 'Licence', cell: (line) => line.licence },
            ]}
            rows={facts.claims.map((line) => ({ id: line.id, row: line }))}
          />
        </PageSection>
      )}

      {events === null ? null : <EventLane events={events} />}

      {/* A proposal is a part of the review. A site with no write service draws none. */}
      {writerOnline ? (
        <PageSection title="Pending proposals">
          <Pending proposals={dossier.pending} mark={mark} />
        </PageSection>
      ) : null}

      {/* S2 at row level: this list backs the name, the type and the map location (geom),
            not one claim. "Position" already names the borrowed canvas position (see above),
            so this text says "location" instead. */}
      <PageSection title="Sources of the name, the type and the map location">
        <p className="text-xs/5 text-label">
          These documents back the name, the type and the map location of this entity. A claim above
          carries its own mark for the document that backs its value.
        </p>
        {mark(dossier.entitySources)}
      </PageSection>

      <PageSection title="Source documents">
        {/* Departure: the rail follows `activeSource` on its own, and its mount run is the
              arrival case. `arrivedAtSource` reaches it through the state above and by no other
              path: two writers of one scroll position fight each other. */}
        {/* The rail scrolls inside a box of a fixed height, so a mark brings its card into view
            and the page does not move. */}
        <div className="h-[32rem] min-h-0">
          <Rail
            sources={dossier.sources}
            activeSource={activeSource}
            selections={selection.count}
          />
        </div>
      </PageSection>
    </ReadingPage>
  );
}
