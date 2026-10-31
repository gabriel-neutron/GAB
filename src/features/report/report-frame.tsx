import { useMemo, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { NodePanel } from './node-panel';
import { reportGraph } from './report-graph';
import { ReportContext, type Report } from './use-report';

/** The control, then the trigger of each popover around it: a fallback when the control unmounts. */
function focusChain(from: HTMLElement | undefined): HTMLElement[] {
  const chain: HTMLElement[] = [];
  for (let at = from ?? null; at !== null;) {
    chain.push(at);
    // A Radix popover content has role="dialog" and an id that its trigger names in aria-controls.
    const box = at.closest<HTMLElement>('[role="dialog"][id]');
    at =
      box === null
        ? null
        : document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(box.id)}"]`);
  }
  return chain;
}

interface ReportFrameProps {
  /** The accessible name of the scroll region. */
  readonly label: string;
  readonly children: ReactNode;
}

/** The scroll region of a report page, the node panel, and the context that opens it. */
export function ReportFrame({ label, children }: ReportFrameProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLElement[]>([]);
  const showing = useRef(false);
  const report = useMemo<Report>(
    () => ({
      openNode: (id, returnFocusTo) => {
        if (reportGraph.node(id) === undefined) return;
        // A reference inside the open panel keeps the first opener: it leaves with the panel.
        if (!showing.current) opener.current = focusChain(returnFocusTo);
        showing.current = true;
        setSelected(id);
      },
    }),
    [],
  );
  return (
    <MotionConfig reducedMotion="user">
      <ReportContext.Provider value={report}>
        <div
          role="region"
          aria-label={label}
          tabIndex={0}
          className="h-full overflow-x-clip overflow-y-auto bg-background text-foreground outline-none"
        >
          {children}
        </div>
        <NodePanel
          id={selected}
          onClose={() => {
            showing.current = false;
            setSelected(null);
          }}
          returnFocusTo={() => opener.current.find((one) => one.isConnected) ?? null}
        />
      </ReportContext.Provider>
    </MotionConfig>
  );
}
