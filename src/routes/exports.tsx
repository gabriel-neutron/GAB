import { createFileRoute } from '@tanstack/react-router';

import { claimHref, entityHref, vesselHref } from '@/features/detail/address';
import { EXPORTS_TEXT } from '@/features/exports/exports-text';
import { ExportsPage } from '@/features/exports/exports-page';
import { readFigureRows } from '@/features/exports/figure-rows';
import { loadCorpus } from '@/shared/read/corpus';
import { REPORT_FILES } from '@gab/release/report-files';
import { loadReportFiles } from '@/shared/read/report-files';
import { loadReleaseOrNull } from '@/shared/read/release-record';

const rowsOf = (name: string, text: string | null) =>
  text === null ? null : readFigureRows(name, text);

// The matrix and the links come from the release, and the figures from the data files of the
// report, so the page reads both whether the read service answers or not. A file that is absent
// leaves its figure out with one sentence. A file that cannot be read stops the build.
export const Route = createFileRoute('/exports')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    const [release, files] = await Promise.all([loadReleaseOrNull(), loadReportFiles()]);
    return {
      release,
      figures: {
        budget: rowsOf(REPORT_FILES.budget, files.budget),
        ledger: rowsOf(REPORT_FILES.ledger, files.ledger),
        sellers: rowsOf(REPORT_FILES.sellers, files.sellers),
      },
    };
  },
  component: ExportsRoute,
  head: () => ({ meta: [{ title: 'Exports · GAB dataset' }] }),
});

function ExportsRoute() {
  const { release, figures } = Route.useLoaderData();
  return (
    <ExportsPage
      text={EXPORTS_TEXT}
      release={release}
      figures={figures}
      links={{ entity: (id) => entityHref(id, null), vessel: vesselHref, claim: claimHref }}
    />
  );
}
