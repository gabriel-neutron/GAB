import { useMemo, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { NodePanel } from './node-panel';
import { ReportContext, type Report } from './use-report';

interface ReportFrameProps {
  /** The accessible name of the scroll region. */
  readonly label: string;
  readonly children: ReactNode;
}

/** The scroll region of a report page, the node panel, and the context that opens it. */
export function ReportFrame({ label, children }: ReportFrameProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const showing = useRef(false);
  const report = useMemo<Report>(
    () => ({
      openNode: (id, returnFocusTo) => {
        // A reference inside the open panel keeps the first opener: it leaves with the panel.
        if (!showing.current) opener.current = returnFocusTo ?? null;
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
          returnFocusTo={() => opener.current}
        />
      </ReportContext.Provider>
    </MotionConfig>
  );
}
