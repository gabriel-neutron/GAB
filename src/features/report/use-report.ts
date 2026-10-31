import { createContext, useContext } from 'react';

export interface Report {
  /** Open the panel of one node. The focus goes back to `returnFocusTo` when the panel closes. */
  readonly openNode: (id: string, returnFocusTo?: HTMLElement) => void;
}

/** The window event that closes every node card: the panel opens, so one Escape closes it. */
export const CLOSE_CARDS = 'report:close-cards';

// Three exports, one job: the frame provides the context, and every part, chart or mark reads it.
export const ReportContext = createContext<Report | null>(null);

/** The controls of the report page, for a part, a chart or a mark inside the report frame. */
export function useReport(): Report {
  const report = useContext(ReportContext);
  if (report === null) throw new Error('A report component sits outside the report frame.');
  return report;
}
