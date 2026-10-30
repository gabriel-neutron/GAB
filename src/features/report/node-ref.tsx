import { useRef, useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { EntityGlyph } from '@/shared/entity-glyph';
import { cn } from '@/shared/lib/utils';
import { ui } from './content';
import { reportGraph } from './report-graph';
import { useReport } from './use-report';

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

interface NodeRefProps {
  readonly id: string;
  /** The words of the reference. The short name of the node when absent. */
  readonly children?: ReactNode;
}

/** A reference to a node of the report. Hover or keyboard focus shows a short card; a click or
 * Enter opens the panel. A tap shows the card, and its button opens the panel. */
export function NodeRef({ id, children }: NodeRefProps) {
  const { openNode } = useReport();
  const [open, setOpen] = useState(false);
  const pointer = useRef('');
  const byFocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const node = reportGraph.node(id);
  if (node === undefined) return <>{children}</>;
  const relations = reportGraph.relations(id).length;
  const documents = reportGraph.documents(node).length;
  const show = () => {
    if (trigger.current !== null) openNode(id, trigger.current);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={trigger}
          type="button"
          onPointerDown={(event) => {
            pointer.current = event.pointerType;
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setOpen(false);
          }}
          onFocus={(event) => {
            byFocus.current = event.currentTarget.matches(':focus-visible');
            if (byFocus.current) setOpen(true);
          }}
          onBlur={() => {
            if (byFocus.current) setOpen(false);
            byFocus.current = false;
          }}
          onClick={(event) => {
            // A tap only toggles the card; the card holds the button that opens the panel.
            if (pointer.current === 'touch') return;
            event.preventDefault();
            setOpen(false);
            show();
          }}
          className={cn(
            'relative inline cursor-pointer text-left underline decoration-border decoration-1 underline-offset-4',
            'transition-colors duration-150 hover:decoration-foreground',
            // The box of the tap grows past the line, so a finger finds 44px.
            'before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-[""]',
            FOCUS,
          )}
        >
          <EntityGlyph
            type={reportGraph.glyph(node.type)}
            size={10}
            className="mr-1 inline-block align-baseline"
          />
          {children ?? node.short_label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 space-y-2 p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <p className="text-body-sm text-foreground">{node.name}</p>
        <p className="flex items-center gap-1.5 font-mono text-caption uppercase text-label">
          <EntityGlyph type={reportGraph.glyph(node.type)} size={12} />
          {node.type} · {node.country}
        </p>
        <dl className="grid grid-cols-3 gap-2 border-t border-divider pt-2">
          {[
            [ui.node.evidence, `${node.evidence_score_0_11} ${ui.node.outOf}`],
            [ui.node.relations, relations],
            [ui.node.documents, documents],
          ].map(([term, value]) => (
            <div key={String(term)}>
              <dt className="font-mono text-caption uppercase text-label">{term}</dt>
              <dd className="font-mono text-data tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            show();
          }}
          className={cn(
            'flex h-11 w-full items-center justify-center border border-input text-body-sm',
            'transition-colors duration-150 hover:bg-surface-secondary',
            FOCUS,
          )}
        >
          {ui.node.open}
        </button>
      </PopoverContent>
    </Popover>
  );
}
