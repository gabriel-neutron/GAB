import { FILE_WORDS } from '@gab/release/file-words';
import { releaseDay } from '@gab/release/release-day';
import type { ChangeCounts, SiteManifest } from '@gab/release/site-manifest';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';

export interface DownloadsPageProps {
  /** Null when the site holds no release: the files come from a release and from nothing else. */
  readonly manifest: SiteManifest | null;
  /** The address of one file of the release. Each file is a copy, byte for byte. */
  readonly fileHref: (path: string) => string;
}

// The licence of each file is the licence of the dataset. The paragraph above the table says that
// each row also gives its own licence.
const LICENCE = 'CC-BY 4.0';

const CHANGES: readonly (keyof ChangeCounts)[] = [
  'added',
  'changed',
  'removed',
  'merged',
  'unmerged',
];

interface FileRow {
  readonly path: string;
  /** The manifest lists the size and the checksum of each other file, and none for itself. */
  readonly bytes: number | null;
  readonly sha256: string | null;
}

interface ChangeRow {
  readonly words: string;
  readonly counts: ChangeCounts;
}

const fileColumns = (fileHref: DownloadsPageProps['fileHref']): readonly DataColumn<FileRow>[] => [
  {
    key: 'file',
    header: 'File',
    figure: 'text',
    cell: (row) => (
      <a className={READING_LINK} href={fileHref(row.path)} download>
        {row.path}
      </a>
    ),
  },
  { key: 'content', header: 'Content', cell: (row) => FILE_WORDS[row.path] },
  {
    key: 'bytes',
    header: 'Bytes',
    figure: 'count',
    cell: (row) => (row.bytes === null ? null : String(row.bytes)),
  },
  {
    key: 'sha256',
    header: 'SHA-256',
    figure: 'text',
    cell: (row) => (row.sha256 === null ? null : <span className="break-all">{row.sha256}</span>),
  },
  { key: 'licence', header: 'Licence', cell: () => LICENCE },
];

const changeColumns: readonly DataColumn<ChangeRow>[] = [
  { key: 'kind', header: 'Kind', cell: (row) => row.words },
  ...CHANGES.map((change): DataColumn<ChangeRow> => ({
    key: change,
    header: change,
    figure: 'count',
    cell: (row) => String(row.counts[change]),
  })),
];

/** The downloads page: each file of the release with its size, its checksum and its licence, and
 * the summary of the changelog with a link to it. */
export function DownloadsPage({ manifest, fileHref }: DownloadsPageProps) {
  if (manifest === null)
    return (
      <ReadingPage>
        <PageHeader title="Downloads" />
        <p className="text-muted-foreground">
          This site holds no release, and the files come from a release.
        </p>
      </ReadingPage>
    );
  const { changelog } = manifest;
  const files: readonly FileRow[] = [
    ...manifest.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    { path: 'manifest.json', bytes: null, sha256: null },
  ];
  const changes: readonly ChangeRow[] = [
    { words: 'Entities', counts: changelog.entities },
    { words: 'Relations', counts: changelog.relations },
    { words: 'Claims', counts: changelog.claims },
  ];
  return (
    <ReadingPage>
      <PageHeader title="Downloads" detail={`From the release of ${releaseDay(manifest.date)}`} />
      <p className="max-w-prose">
        Each file is under CC-BY 4.0, and each row of a file gives its own licence. Each file holds
        the disclaimer of the dataset, and each row its label. The file manifest gives the SHA-256
        checksum of each file, so you can check a copy. Each CSV file starts with lines that begin
        with "#": the version, the date and the disclaimer. A program that reads a CSV file must
        skip those lines.
      </p>
      <DataTable
        name="Files of the release"
        columns={fileColumns(fileHref)}
        rows={files.map((row) => ({ id: row.path, row }))}
        empty="The release lists no file."
      />
      <PageSection title="Changelog">
        <p>
          {changelog.previous === null
            ? 'First release: no earlier release to compare.'
            : `Changes since the version of ${releaseDay(changelog.previous.date)} (${changelog.previous.version}).`}{' '}
          <a className={READING_LINK} href={fileHref(changelog.path)} download>
            Download the changelog ({changelog.path})
          </a>
        </p>
        <DataTable
          name="Changes since the previous release"
          columns={changeColumns}
          rows={changes.map((row) => ({ id: row.words, row }))}
          empty=""
        />
      </PageSection>
    </ReadingPage>
  );
}
