import { FILE_WORDS } from './file-words.ts';
import { releaseDay } from './release-day.ts';
import { SiteFrame } from './site-frame.tsx';
import type { ChangeCounts } from './site-manifest.ts';
import { DOWNLOADS, hrefFrom } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';

// The licence of each file is the licence of the dataset. The paragraph above the table says that
// each row also gives its own licence.
const LICENCE = 'CC-BY 4.0';
const NUMBER = `${CELL} text-right font-mono tabular-nums`;

const CHANGES: readonly (keyof ChangeCounts)[] = [
  'added',
  'changed',
  'removed',
  'merged',
  'unmerged',
];

/** The downloads page: each file of the release with its size, its checksum and its licence,
 * and the summary of the changelog with a link to it. */
export function DownloadsPage({ release }: { readonly release: SiteRelease }) {
  const { manifest } = release;
  const { changelog } = manifest;
  const kinds = [
    { words: 'Entities', counts: changelog.entities },
    { words: 'Relations', counts: changelog.relations },
    { words: 'Claims', counts: changelog.claims },
  ];
  return (
    <SiteFrame release={release} page={{ path: DOWNLOADS, title: 'Downloads' }}>
      <p className="max-w-prose">
        Each file is under CC-BY 4.0, and each row of a file gives its own licence. Each file holds
        the disclaimer of the dataset, and each row its label. The file manifest gives the SHA-256
        checksum of each file, so you can check a copy.
      </p>
      <div className="max-w-full overflow-x-auto">
        <table className={TABLE}>
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={HEAD}>File</th>
              <th className={HEAD}>Content</th>
              <th className={`${HEAD} text-right`}>Bytes</th>
              <th className={HEAD}>SHA-256</th>
              <th className={HEAD}>Licence</th>
            </tr>
          </thead>
          <tbody>
            {manifest.files.map((file) => (
              <tr key={file.path} className="border-b border-border">
                <td className={CELL}>
                  <a className={`font-mono ${LINK}`} href={hrefFrom(DOWNLOADS, file.path)} download>
                    {file.path}
                  </a>
                </td>
                <td className={`${CELL} min-w-48`}>{FILE_WORDS[file.path]}</td>
                <td className={NUMBER}>{file.bytes}</td>
                <td className={`${CELL} font-mono whitespace-nowrap`}>{file.sha256}</td>
                <td className={`${CELL} whitespace-nowrap`}>{LICENCE}</td>
              </tr>
            ))}
            <tr className="border-b border-border">
              <td className={CELL}>
                <a
                  className={`font-mono ${LINK}`}
                  href={hrefFrom(DOWNLOADS, 'manifest.json')}
                  download
                >
                  manifest.json
                </a>
              </td>
              <td className={`${CELL} min-w-48`}>{FILE_WORDS['manifest.json']}</td>
              <td className={NUMBER} />
              <td className={CELL} />
              <td className={`${CELL} whitespace-nowrap`}>{LICENCE}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Changelog</h2>
        <p>
          {changelog.previous === null
            ? 'First release: no earlier release to compare.'
            : `Changes since the version of ${releaseDay(changelog.previous.date)} (${changelog.previous.version}).`}{' '}
          <a className={LINK} href={hrefFrom(DOWNLOADS, changelog.path)} download>
            Download the changelog ({changelog.path})
          </a>
        </p>
        <div className="max-w-full overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={HEAD}>Kind</th>
                {CHANGES.map((change) => (
                  <th key={change} className={`${HEAD} text-right`}>
                    {change}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kinds.map((kind) => (
                <tr key={kind.words} className="border-b border-border">
                  <td className={CELL}>{kind.words}</td>
                  {CHANGES.map((change) => (
                    <td key={change} className={NUMBER}>
                      {kind.counts[change]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SiteFrame>
  );
}
