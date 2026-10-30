import { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { Journal, EndMatter } from './report-content';
import { Bibliography } from './citations';
import { NodeDirectory, NodeRecord } from './figures';
import { CurrentField } from './report-background';
import { ReportScrollContext, type OpenReportNode } from './report-context';
import './report.css';

export function ReportPage({ bibliography = false }: { readonly bibliography?: boolean }) {
  const scroll = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | SVGElement | null>(null);
  const [selected, setSelected] = useState('N-P026'),
    [opened, setOpened] = useState(false);
  const reduce = useReducedMotion();
  const onOpen: OpenReportNode = (element, id = 'N-P026') => {
    trigger.current = element;
    setSelected(id);
    setOpened(true);
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
    setOpened(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const el = scroll.current;
    if (!opened || el === null) return;
    const previous = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => {
      el.style.overflow = previous;
    };
  }, [opened]);
  return (
    <MotionConfig reducedMotion="user">
      <ReportScrollContext.Provider value={scroll}>
        <div className="report-page">
          <div
            className="report-scroll"
            ref={scroll}
            tabIndex={0}
            aria-label={bibliography ? 'Report bibliography' : 'Research report'}
          >
            <div className="app journal">
              {!bibliography && <CurrentField />}
              <div className="report-document">
                {bibliography ? (
                  <div className="report-bibliography">
                    <Bibliography />
                    <NodeDirectory />
                  </div>
                ) : (
                  <>
                    <Journal onOpen={onOpen} />
                    <EndMatter />
                  </>
                )}
              </div>
              <motion.dialog
                ref={dialog}
                className="entity-dialog"
                aria-labelledby="report-entity-title"
                initial={false}
                animate={{ x: opened ? 0 : 28, opacity: opened ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                onCancel={(e) => {
                  e.preventDefault();
                  close();
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) close();
                }}
              >
                <div className="entity-dialog-content">
                  <div className="dialog-top">
                    <span>Entity record</span>
                    <button autoFocus onClick={close}>
                      Close ×
                    </button>
                  </div>
                  <NodeRecord id={selected} titleId="report-entity-title" />
                  <button className="primary" onClick={close}>
                    Return to the report ↩
                  </button>
                </div>
              </motion.dialog>
            </div>
          </div>
        </div>
      </ReportScrollContext.Provider>
    </MotionConfig>
  );
}
