// The PDF of the report is a file of the operator and never a file of the repository. When
// `REPORT_PDF` names it, the build copies it beside the application as `report.pdf`, and the page
// shows its download link. When no file is named, the page shows no link.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

const NAME = 'report.pdf';

export function reportPdf(file: string | undefined): Plugin {
  const source = file === undefined || file.trim() === '' ? null : resolve(file.trim());
  // A name that points nowhere is a fault of the operator: the build stops, and it never links a
  // missing file.
  if (source !== null && !existsSync(source))
    throw new Error(`REPORT_PDF names ${source}, and no file is there.`);
  return {
    name: 'gab-report-pdf',
    // Vite puts a define key under `import.meta.env.` into the object `import.meta.env`, so the
    // page reads it like any other variable.
    config: () => ({
      define: { 'import.meta.env.VITE_REPORT_PDF': JSON.stringify(source === null ? '' : NAME) },
    }),
    configureServer: ({ middlewares }) => {
      if (source === null) return;
      middlewares.use(`/${NAME}`, (_request, reply) => {
        reply.setHeader('Content-Type', 'application/pdf');
        reply.end(readFileSync(source));
      });
    },
    generateBundle() {
      if (source !== null)
        this.emitFile({ type: 'asset', fileName: NAME, source: readFileSync(source) });
    },
  };
}
