import { useMemo, useState, type ReactNode } from 'react';

import { FILE_WORDS } from '@gab/release/file-words';
import { releaseDay } from '@gab/release/release-day';
import type { SiteRelease } from '@gab/release/site-release';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { DisclaimerText } from '@/shared/page/disclaimer-text';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import {
  choices,
  DATASETS,
  filterRows,
  NO_FILTER,
  tableOf,
  toCsv,
  type Dataset,
  type DataFilter,
  type DataRow,
} from './data-rows';

export interface DataPageProps {
  /** Null when the site holds no release: the data come from a release and from nothing else. */
  readonly release: SiteRelease | null;
  /** The address of one file of the release. Each file is a copy, byte for byte. */
  readonly fileHref: (path: string) => string;
}

// The table shows the first rows only. The file holds all of them.
const PREVIEW = 50;

const SELECT =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

// Departure: the browser makes the file, so the filter needs no service and no new release file.
const save = (name: string, text: string): void => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

interface FileRow {
  readonly path: string;
  readonly bytes: number | null;
  readonly sha256: string | null;
}

const fileColumns = (fileHref: DataPageProps['fileHref']): readonly DataColumn<FileRow>[] => [
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
];

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="flex min-w-40 flex-1 flex-col gap-1 text-small/4 text-label">
      {label}
      {children}
    </label>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={SELECT}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">All</option>
        {options.map((one) => (
          <option key={one} value={one}>
            {one}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** The data page: a filter over the entities, the relations and the claims of the release with a
 * download of the rows that pass it, the files of the release in full, and the words that say who
 * decided each row. */
export function DataPage({ release, fileHref }: DataPageProps) {
  const [dataset, setDataset] = useState<Dataset>('entities');
  const [filter, setFilter] = useState<DataFilter>(NO_FILTER);
  const table = useMemo(
    () => (release === null ? null : tableOf(release, dataset)),
    [release, dataset],
  );
  const rows = useMemo(
    () => (table === null ? [] : filterRows(table.rows, filter)),
    [table, filter],
  );

  if (release === null || table === null)
    return (
      <ReadingPage>
        <PageHeader title="Data" />
        <p className="text-muted-foreground">
          This site holds no release, and the data come from a release.
        </p>
      </ReadingPage>
    );

  const { manifest } = release;
  const files: readonly FileRow[] = [
    ...manifest.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    { path: 'manifest.json', bytes: null, sha256: null },
  ];
  const columns: readonly DataColumn<DataRow>[] = table.columns.map((name, place) => ({
    key: name,
    header: name,
    cell: (row) => row.cells[place],
  }));

  return (
    <ReadingPage>
      <PageHeader title="Data" detail={`From the release of ${releaseDay(manifest.date)}`} />

      <PageSection title="Filter and download">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Data">
            <select
              className={SELECT}
              value={dataset}
              onChange={(event) => {
                const chosen = DATASETS.find(({ key }) => key === event.target.value);
                if (chosen === undefined) return;
                setDataset(chosen.key);
                setFilter(NO_FILTER);
              }}
            >
              {DATASETS.map(({ key, words }) => (
                <option key={key} value={key}>
                  {words}
                </option>
              ))}
            </select>
          </Field>
          <Choice
            label={dataset === 'claims' ? 'Kind' : 'Type'}
            value={filter.kind}
            options={choices(table.rows, 'kind')}
            onChange={(kind) => {
              setFilter({ ...filter, kind });
            }}
          />
          <Choice
            label="Who decided"
            value={filter.decider}
            options={choices(table.rows, 'decider')}
            onChange={(decider) => {
              setFilter({ ...filter, decider });
            }}
          />
          <Field label="Contains">
            <Input
              type="search"
              value={filter.text}
              onChange={(event) => {
                setFilter({ ...filter, text: event.target.value });
              }}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={rows.length === 0}
            aria-describedby="data-count"
            onClick={() => {
              save(
                `gab-${dataset}-${manifest.date}.csv`,
                toCsv(manifest.disclaimer, table.columns, rows),
              );
            }}
          >
            Download these rows (CSV)
          </Button>
          <p id="data-count" aria-live="polite" className="text-small/4 text-label">
            {`${String(rows.length)} of ${String(table.rows.length)} rows.`}
            {rows.length > PREVIEW ? ` The table shows the first ${String(PREVIEW)}.` : ''}
          </p>
        </div>
        <DataTable
          name="Rows that pass the filter"
          columns={columns}
          rows={rows.slice(0, PREVIEW).map((row) => ({ id: row.id, row }))}
          empty="No row passes the filter."
        />
      </PageSection>

      <PageSection title="Files of the release">
        <p className="max-w-prose">
          Each file is under CC-BY 4.0, and each row of a file gives its own licence. Each file
          holds the disclaimer of the dataset, and each row its label. The file manifest gives the
          SHA-256 checksum of each file, so you can check a copy. Each CSV file starts with lines
          that begin with "#": the version, the date and the disclaimer. A program that reads a CSV
          file must skip those lines.
        </p>
        <DataTable
          name="Files of the release"
          columns={fileColumns(fileHref)}
          rows={files.map((row) => ({ id: row.path, row }))}
          empty="The release lists no file."
        />
      </PageSection>

      <PageSection title="About this data and the labels">
        <DisclaimerText markdown={manifest.disclaimer} />
        <p className="max-w-prose">
          A label that starts with &ldquo;Reference dataset&rdquo; names a table of another
          organisation that the operator chose to import. GAB did not check its rows, and no person
          of GAB read them.
        </p>
        {manifest.showNatoPair ? (
          <p className="max-w-prose" data-nato-pair="">
            The NATO pair of a claim (STANAG 2511) has a letter and a digit. The letter, from A
            (reliable) to F (cannot be judged), rates the best author among the sources of the fact,
            and never the fact. The digit, from 1 (confirmed by independent sources) to 6 (cannot be
            judged), rates the credibility of the fact. A claim with no full pair shows &ldquo;Not
            rated&rdquo;.
          </p>
        ) : null}
      </PageSection>
    </ReadingPage>
  );
}
