// The data files of the report, read once and held. The files are private: the build copies them
// from a folder of the operator, and a site built without that folder holds none.

import { REPORT_FILES } from '@gab/release/report-files';

import { readOnce } from './once';

/** The text of each data file, or null when the site does not hold it. */
export type ReportFileTexts = { readonly [K in keyof typeof REPORT_FILES]: string | null };

const origin = (): string =>
  typeof document === 'undefined' ? 'http://release.invalid/' : document.baseURI;

async function textOrNull(name: string): Promise<string | null> {
  const address = new URL(`${import.meta.env.BASE_URL}report/${name}`, origin());
  let answer: Response;
  try {
    answer = await fetch(address);
  } catch {
    throw new Error(`The report file ${name} cannot be fetched.`);
  }
  if (answer.status === 404) return null;
  if (!answer.ok) throw new Error(`The report file ${name} answered ${String(answer.status)}.`);
  // A host that holds no such file can serve the page of the application in its place.
  if (answer.headers.get('content-type')?.includes('text/html') === true) return null;
  return answer.text();
}

const memory = readOnce<ReportFileTexts>(async () => {
  const [budget, ledger, sellers] = await Promise.all([
    textOrNull(REPORT_FILES.budget),
    textOrNull(REPORT_FILES.ledger),
    textOrNull(REPORT_FILES.sellers),
  ]);
  return { budget, ledger, sellers };
});

export const loadReportFiles = memory.load;
