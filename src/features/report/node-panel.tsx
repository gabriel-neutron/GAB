import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { Dialog } from 'radix-ui';
import { EntityGlyph } from '@/shared/entity-glyph';
import { cn } from '@/shared/lib/utils';
import { useNarrowScreen } from '@/shared/narrow-screen';
import { ui } from './content';
import { LocalGraph } from './local-graph';
import { NodeRef } from './node-ref';
import { reportGraph } from './report-graph';

const NodeMap = lazy(() => import('./node-map').then((module) => ({ default: module.NodeMap })));

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
const CAPTION = 'font-mono text-caption uppercase text-label';
const LINK = cn(
  'inline-flex min-h-11 items-center border border-input px-3 text-body-sm transition-colors duration-150 hover:bg-surface-secondary',
  FOCUS,
);
const EASE = [0.4, 0, 0.2, 1] as const;

interface NodePanelProps {
  /** The node on show; null keeps the panel closed. */
  readonly id: string | null;
  readonly onClose: () => void;
  /** The control that gets the focus back when the panel closes. */
  readonly returnFocusTo: () => HTMLElement | null;
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="border-t border-divider px-4 py-4">
      <h3 className={CAPTION}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function NodeRecord({ id }: { readonly id: string }) {
  const node = reportGraph.node(id);
  if (node === undefined) return null;
  const relations = reportGraph.relations(id);
  const documents = reportGraph.documents(node);
  const lat = Number(node.lat);
  const lon = Number(node.lon);
  return (
    <>
      <div className="space-y-2 px-4 pb-4">
        <p className={cn(CAPTION, 'flex items-center gap-1.5')}>
          <EntityGlyph type={reportGraph.glyph(node.type)} size={12} />
          {node.type} · {node.layer}
        </p>
        <Dialog.Title className="text-heading-sm break-words">{node.name}</Dialog.Title>
        <Dialog.Description className="text-body-sm text-muted-foreground">
          {node.country} · {ui.node.evidence} {node.evidence_score_0_11} {ui.node.outOf}
        </Dialog.Description>
        {node.record_entity_id === '' ? null : (
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              to="/entity/$id"
              params={{ id: node.record_entity_id }}
              search={{ src: null }}
              className={LINK}
            >
              {ui.panel.entity}
            </Link>
            <Link
              to="/graph"
              search={{ entity: node.record_entity_id, relation: '' }}
              className={LINK}
            >
              {ui.panel.graph}
            </Link>
          </div>
        )}
      </div>
      <Section title={`${ui.panel.relations} · ${relations.length}`}>
        {relations.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">{ui.panel.noRelation}</p>
        ) : (
          <ul className="space-y-3 text-body-sm">
            {relations.map((edge) => {
              const name = (other: string) =>
                other === id ? (
                  node.short_label
                ) : reportGraph.node(other) === undefined ? (
                  // A shared entity of the corpus, outside the nodes of the report.
                  other
                ) : (
                  <NodeRef id={other} />
                );
              return (
                <li
                  key={`${edge.source}-${edge.relation_type}-${edge.target}`}
                  className="break-words"
                >
                  {name(edge.source)}{' '}
                  <span className="font-mono text-data text-label">{edge.relation_type}</span>{' '}
                  {name(edge.target)}
                  <span className="block font-mono text-data text-label">
                    {edge.state} · {edge.document_ids.split(';').filter(Boolean).join(' · ')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      {relations.length === 0 ? null : (
        <Section title={ui.panel.neighbours}>
          <LocalGraph id={id} />
        </Section>
      )}
      {Number.isFinite(lat) && Number.isFinite(lon) && node.lat !== '' ? (
        <Section title={ui.panel.place}>
          <Suspense fallback={<div className="aspect-[2/1] border border-border" />}>
            <NodeMap lat={lat} lon={lon} name={node.short_label} />
          </Suspense>
        </Section>
      ) : null}
      <Section title={`${ui.panel.sources} · ${documents.length}`}>
        {documents.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">{ui.panel.noSource}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-data">
            {documents.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={ui.panel.record}>
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5">
          {Object.entries(node)
            .filter(([, value]) => value !== '')
            .map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="font-mono text-data text-label break-words">
                  {key.replaceAll('_', ' ')}
                </dt>
                <dd className="text-body-sm break-words">{value}</dd>
              </div>
            ))}
        </dl>
      </Section>
    </>
  );
}

/** The panel of one node: a column on the right of a wide screen, a bottom sheet on a phone.
 * Escape, the close control or a drag down on the sheet closes it. */
export function NodePanel({ id, onClose, returnFocusTo }: NodePanelProps) {
  const narrow = useNarrowScreen();
  const drag = useDragControls();
  const away = narrow ? { y: '100%', opacity: 1 } : { x: 32, opacity: 0 };
  return (
    <Dialog.Root
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AnimatePresence>
        {id === null ? null : (
          <Dialog.Portal key="panel" forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-background/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocusTo()?.focus();
              }}
            >
              <motion.div
                className={cn(
                  'fixed z-50 flex flex-col border-border bg-surface text-foreground outline-none',
                  'inset-x-0 bottom-0 max-h-[85svh] border-t',
                  'md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[400px] md:border-t-0 md:border-l',
                )}
                initial={away}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={away}
                transition={{ duration: 0.2, ease: EASE }}
                drag={narrow ? 'y' : false}
                dragListener={false}
                dragControls={drag}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 1 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 96 || info.velocity.y > 600) onClose();
                }}
              >
                <div className="flex items-center justify-between gap-2 px-2 py-2">
                  {narrow ? (
                    <div
                      aria-hidden="true"
                      title={ui.panel.drag}
                      className="flex h-11 flex-1 cursor-grab touch-none items-center justify-center"
                      onPointerDown={(event) => {
                        drag.start(event);
                      }}
                    >
                      <span className="h-1 w-10 bg-border" />
                    </div>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <Dialog.Close
                    className={cn(
                      'flex h-11 items-center gap-1.5 border border-input px-3 font-mono text-caption uppercase text-label',
                      'transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground',
                      FOCUS,
                    )}
                  >
                    <X size={14} aria-hidden="true" />
                    {ui.panel.close}
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
                  <NodeRecord id={id} />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
