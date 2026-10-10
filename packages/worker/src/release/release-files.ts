import { createHash } from 'node:crypto';

import { alignmentMatrix } from './alignment-matrix.ts';
import { releaseChangelog } from './changelog.ts';
import { criticalNodes } from './critical-nodes.ts';
import type { SheetRow } from './critical-nodes-sheet.ts';
import { csvExport, type ReleaseFile } from './csv-export.ts';
import { releaseDisclaimer } from './disclaimer.ts';
import { geojsonExport } from './geojson-export.ts';
import { jsonldExport } from './jsonld-export.ts';
import type { PreviousRelease } from './previous-release.ts';
import { releaseHeading } from './release-heading.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import type { ReleaseRecord } from './release-record.ts';

/** The file that lists each file of a release with its checksum. */
const FILE_MANIFEST = 'manifest.json';

/** Each file of one release, the file manifest last: the exports, the changelog since
 * `previous` (or a first release with none), and the file manifest with the size and the checksum
 * of each other file. The static site reads the contact addresses and the base of the
 * identifiers from the file manifest. */
export const releaseFiles = (
  record: ReleaseRecord,
  manifest: ReleaseManifest,
  sheet: readonly SheetRow[] | null,
  previous: PreviousRelease | null,
): readonly ReleaseFile[] => {
  const disclaimer = releaseDisclaimer(record.disclaimer, manifest.contacts);
  const heading = releaseHeading(manifest, disclaimer);
  const preamble = `${heading.title}\n\n${disclaimer}`;
  const exports: readonly ReleaseFile[] = [
    ...csvExport(record, preamble),
    alignmentMatrix(record, manifest.dateRules, preamble),
    criticalNodes(record, sheet, preamble),
    geojsonExport(record, heading),
    jsonldExport(record, heading, manifest.iriBase),
  ];
  const changelog = releaseChangelog(previous, exports, heading);
  const files = [...exports, changelog.file];

  const listed = files.map((file) => {
    const bytes = Buffer.from(file.text, 'utf8');
    return {
      path: file.path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  const fileManifest = {
    dataset: 'GAB',
    version: manifest.version,
    date: manifest.date,
    showNatoPair: manifest.showNatoPair,
    dateRules: manifest.dateRules,
    disclaimer,
    contacts: manifest.contacts,
    iriBase: manifest.iriBase,
    changelog: changelog.summary,
    files: listed,
  };
  return [...files, { path: FILE_MANIFEST, text: `${JSON.stringify(fileManifest, null, 2)}\n` }];
};
