// The old figures still take these two names. The report page reads `use-report.ts`.
export type OpenReportNode = (trigger: HTMLElement | SVGElement, id?: string) => void;
export const reportAddress = (path = '') => `${import.meta.env.BASE_URL}${path}`;
