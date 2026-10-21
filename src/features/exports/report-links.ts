/** The address builders of the pages that the report links to. */
export interface ReportLinks {
  readonly entity: (id: string) => string;
  readonly vessel: (imo: string) => string;
  readonly claim: (id: string) => string;
}
