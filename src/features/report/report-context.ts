import { createContext, useContext, type RefObject } from 'react';
export const ReportScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
export function useReportScroll() {
  const ref = useContext(ReportScrollContext);
  if (ref === null) throw new Error('Report components require ReportScrollContext');
  return ref;
}
export type OpenReportNode = (trigger: HTMLElement | SVGElement, id?: string) => void;
export const reportAddress = (path = '') => `${import.meta.env.BASE_URL}${path}`;
