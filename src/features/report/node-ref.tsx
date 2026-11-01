import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { EntityGlyph } from '@/shared/entity-glyph';
import { cn } from '@/shared/lib/utils';
import { reportGraph } from './report-graph';
import { useContent } from './use-content';
import { CLOSE_CARDS, useReport } from './use-report';

/** The time the pointer has to cross from the reference to its card (WCAG 1.4.13). */
const CLOSE_DELAY = 150;

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

interface NodeRefProps {
  readonly id: string;
  /** The words of the reference. The short name of the node when absent. */
  readonly children?: ReactNode;
  /** The side of the card. Above the words when absent; the index sets it beside its rows. */
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
}

/** A reference to a node of the report. Hover or keyboard focus shows a short card; a click or
 * Enter opens the panel. A tap shows the card, and its button opens the panel. */
export function NodeRef({ id, children, side = 'top' }: NodeRefProps) {
  const { ui } = useContent();
  const { openNode } = useReport();
  const [open, setOpen] = useState(false);
  const pointer = useRef('');
  const byFocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A scroll moves the reference away from the pointer or the finger, so the card closes.
  // The panel also closes the card when it opens.
  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      setOpen(false);
    };
    window.addEventListener('scroll', close, { passive: true, once: true });
    window.addEventListener(CLOSE_CARDS, close);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener(CLOSE_CARDS, close);
    };
  }, [open]);
  const node = reportGraph.node(id);
  if (node === undefined) return <>{children}</>;
  const relations = reportGraph.relations(id).length;
  const documents = reportGraph.documents(node).length;
  const hold = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const release = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY);
  };
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
          onPointerEnter={hold}
          onPointerLeave={release}
          onFocus={(event) => {
            byFocus.current = event.currentTarget.matches(':focus-visible');
            if (byFocus.current) setOpen(true);
          }}
          onBlur={(event) => {
            const into =
              event.relatedTarget instanceof Node && card.current?.contains(event.relatedTarget);
            if (byFocus.current && into !== true) setOpen(false);
            byFocus.current = false;
            pointer.current = '';
          }}
          onClick={(event) => {
            // A tap only toggles the card; the card holds the button that opens the panel.
            const tap = pointer.current === 'touch';
            // A later Enter has no pointerdown: it must open the panel.
            pointer.current = '';
            if (tap) return;
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
            // The ink of the text, not the hue of the type: the accent stays the one colour.
            className="mr-1 inline-block align-baseline text-foreground/55 [&_*]:stroke-current [&_:not([fill=none])]:fill-current"
          />
          {children ?? node.short_label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={card}
        side={side}
        onPointerEnter={hold}
        onPointerLeave={release}
        className="relative w-72 space-y-2 p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        {/* A touch screen has no hover to leave: the card gets its own close control. */}
        <button
          type="button"
          aria-label={ui.panel.close}
          onClick={() => {
            setOpen(false);
          }}
          className={cn(
            'absolute top-0 right-0 hidden size-11 items-center justify-center text-label pointer-coarse:flex',
            FOCUS,
          )}
        >
          <span aria-hidden="true">×</span>
        </button>
        <p className="text-report-small text-foreground pointer-coarse:pr-8">{node.name}</p>
        <p className="flex items-center gap-1.5 font-mono text-report-label uppercase text-label">
          <EntityGlyph type={reportGraph.glyph(node.type)} size={12} />
          {node.type}
          {node.country === '' ? null : ` · ${node.country}`}
        </p>
        <dl className="grid grid-cols-3 gap-2 border-t border-divider pt-2">
          {[
            // A node with no evidence score shows no score field.
            ...(node.evidence_score_0_11 === ''
              ? []
              : [[ui.node.evidence, `${node.evidence_score_0_11} ${ui.node.outOf}`]]),
            [ui.node.relations, relations],
            [ui.node.documents, documents],
          ].map(([term, value]) => (
            <div key={String(term)}>
              <dt className="font-mono text-report-label uppercase text-label">{term}</dt>
              <dd className="font-mono text-report-label tabular-nums">{value}</dd>
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
            'flex h-11 w-full items-center justify-center border border-input text-report-small',
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
