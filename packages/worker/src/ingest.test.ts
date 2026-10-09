import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { endOcr } from '@gab/text';
import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  checkedTitle,
  ingestFiles,
  parseIngestArguments,
  reportLine,
  type IngestDoor,
  type IngestOutcome,
} from './ingest.ts';

const ANY_REFUSAL = /./;

// Departure: the folder holds the files of every case, and the suite removes it at the end.
let folder = '';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'ingest-suite-'));
  await writeFile(join(folder, 'one.txt'), 'the first page');
  await writeFile(join(folder, 'two.txt'), 'the second page');
  await writeFile(join(folder, 'copy-of-one.txt'), 'the first page');
  await writeFile(join(folder, 'strange.xyz'), 'bytes of a type nobody reads');
  await mkdir(join(folder, 'inner'));
  await copyFile(
    join(import.meta.dirname, '../../text/fixtures/blank.png'),
    join(folder, 'blank.png'),
  );
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
  await endOcr();
});

const parsed = (...argv: string[]) => parseIngestArguments(argv);

test('the arguments hold the paths, the date, the kind and the title', () => {
  expect(parsed('a.pdf', '--retrieved-at', '2026-09-01', '--kind', 'report')).toStrictEqual({
    paths: ['a.pdf'],
    options: {
      retrievedAt: '2026-09-01',
      kind: 'report',
      title: undefined,
      uri: undefined,
      providerId: undefined,
      costEur: undefined,
      dryRun: false,
    },
    walk: { recursive: false, include: ['*.pdf'] },
  });
  const file = parsed('a.pdf', '--retrieved-at', '2026-09-01', '--uri', 'https://example.org/a');
  expect(file.options).toMatchObject({ kind: 'file', uri: 'https://example.org/a' });
});

// PU1, the ruling of 9 October 2026 after #403: a file of the operator comes from the Internet,
// and the address where it comes from makes it a public document.
test('a file with no address is refused, and the refusal asks for the address', () => {
  expect(() => parsed('a.pdf', '--retrieved-at', '2026-09-01')).toThrow(
    /--uri is required: give the address where the file comes from/u,
  );
  expect(() => parsed('a.pdf', '--retrieved-at', '2026-09-01', '--uri', ' ')).toThrow(/--uri/u);
  expect(() =>
    parsed('a.pdf', '--retrieved-at', '2026-09-01', '--uri', 'ftp://example.org/a'),
  ).toThrow(/--uri/u);
});

// A bought file stays not public, so the command records its cost and its provider as the
// upload form does.
test('the cost and the provider of a bought file are read and checked', () => {
  const day = ['--retrieved-at', '2026-09-01', '--uri', 'https://example.org/a'];
  expect(
    parsed('a.pdf', ...day, '--cost-eur', '12.5', '--provider', ' mca21 ').options,
  ).toMatchObject({ costEur: '12.50', providerId: 'mca21' });
  expect(parsed('a.pdf', ...day, '--cost-eur', '0').options).toMatchObject({ costEur: '0.00' });
  for (const cost of ['-1', 'abc', '1.234', '', '12345678901'])
    expect(() => parsed('a.pdf', ...day, '--cost-eur', cost)).toThrow(/--cost-eur/u);
  expect(() => parsed('a.pdf', ...day, '--provider', ' ')).toThrow(/--provider/u);
});

test('the run gives the cost and the provider to the row', async () => {
  const { door, calls } = doorOf();
  const bought = { ...OPTIONS, uri: 'https://example.org/a', providerId: 'mca21', costEur: '9.90' };
  const [outcome] = await ingestFiles(door, [join(folder, 'two.txt')], bought);
  expect(outcome?.status).toBe('stored');
  const put = calls.find((c) => c.text.includes('put_document('));
  expect(put?.values?.slice(-2)).toStrictEqual(['mca21', '9.90']);
});

test('an address names one file', () => {
  const uri = ['--uri', 'https://example.org/a'];
  expect(() => parsed('a.pdf', 'b.pdf', '--retrieved-at', '2026-09-01', ...uri)).toThrow(/--uri/u);
  const addressed = { ...OPTIONS, uri: 'https://example.org/a' };
  expect(() => checkedTitle(['a.pdf', 'b.pdf'], addressed)).toThrow(/--uri/u);
  expect(() => checkedTitle(['a.pdf'], addressed)).not.toThrow();
});

test('a run with no retrieval date is refused', () => {
  expect(() => parsed('a.pdf')).toThrow(/--retrieved-at/);
});

test('a date that is not a real day is refused', () => {
  for (const bad of ['2026-02-30', '2026-13-01', 'yesterday', '2026-9-1', ''])
    expect(() => parsed('a.pdf', '--retrieved-at', bad)).toThrow(ANY_REFUSAL);
});

test('a title with more than one path is refused', () => {
  expect(() =>
    parsed('a.pdf', 'b.pdf', '--retrieved-at', '2026-09-01', '--kind', 'report', '--title', 'T'),
  ).toThrow(/--title/);
  expect(
    parsed('a.pdf', '--retrieved-at', '2026-09-01', '--kind', 'report', '--title', 'T').options
      .title,
  ).toBe('T');
});

test('a run with no path, a wrong kind or an unknown option is refused', () => {
  const report = ['--retrieved-at', '2026-09-01', '--kind', 'report'];
  expect(() => parsed(...report)).toThrow(ANY_REFUSAL);
  expect(() => parsed('a.pdf', '--retrieved-at', '2026-09-01', '--kind', 'url')).toThrow(/--kind/);
  expect(() => parsed('a.pdf', ...report, '--wat')).toThrow(ANY_REFUSAL);
});

test('the walk flags and the dry run flag are read', () => {
  const run = parsed(
    'folder',
    '--retrieved-at',
    '2026-09-01',
    '--kind',
    'report',
    '--recursive',
    '--dry-run',
    '--include',
    '*.html',
    '--include',
    '*.txt',
  );
  expect(run.walk).toStrictEqual({ recursive: true, include: ['*.html', '*.txt'] });
  expect(run.options.dryRun).toBe(true);
  expect(() =>
    parsed(
      'folder',
      '--retrieved-at',
      '2026-09-01',
      '--uri',
      'https://example.org/a',
      '--include',
      '',
    ),
  ).toThrow(/--include/);
});

test('a title is refused when the run takes more than one file', () => {
  const titled = { ...OPTIONS, title: 'T' };
  expect(() => checkedTitle(['a.pdf', 'b.pdf'], titled)).toThrow(/--title/);
  expect(() => checkedTitle([], titled)).toThrow(/--title/);
  expect(() => checkedTitle(['a.pdf'], titled)).not.toThrow();
  expect(() => checkedTitle(['a.pdf', 'b.pdf'], OPTIONS)).not.toThrow();
});

interface Call {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

// Departure: the fake door records each statement and each object, and it fails a statement that
// contains `failOn`.
const doorOf = (options: { known?: boolean; failOn?: string } = {}) => {
  const calls: Call[] = [];
  const puts: string[] = [];
  let released = 0;
  const door: IngestDoor = {
    connect: () =>
      Promise.resolve({
        query: (text: string, values?: readonly unknown[]) => {
          calls.push({ text, values });
          if (options.failOn !== undefined && text.includes(options.failOn))
            return Promise.reject(new Error('refused'));
          if (text.includes('FROM public.documents'))
            return Promise.resolve({
              rows: options.known === true ? [{ id: 'doc_000000000000' }] : [],
            });
          return Promise.resolve({ rows: [] });
        },
        release: () => {
          released += 1;
        },
      }),
    put: (object) => {
      puts.push(object.key);
      return Promise.resolve(object.key);
    },
  };
  return { door, calls, puts, released: () => released };
};

const OPTIONS = {
  retrievedAt: '2026-09-01',
  kind: 'file',
  title: undefined,
  uri: undefined,
  providerId: undefined,
  costEur: undefined,
  dryRun: false,
} as const;
const only = async (door: IngestDoor, path: string): Promise<IngestOutcome> => {
  const [outcome] = await ingestFiles(door, [path], OPTIONS);
  if (outcome === undefined) throw new Error('no outcome');
  return outcome;
};

test('a stored file names the object by its hash alone, and the title keeps the name', async () => {
  const { door, calls, puts } = doorOf();
  const outcome = await only(door, join(folder, 'one.txt'));
  expect(outcome.status).toBe('stored');
  const key = puts[0] ?? '';
  expect(key).toMatch(/^raw\/[0-9a-f]{64}$/);
  const put = calls.find((c) => c.text.includes('put_document('));
  expect(put?.values).toContain('one.txt');
  expect(put?.values).toContain(key);
  expect(outcome.id).toMatch(/^doc_[0-9a-f]{12}$/);
  expect(key.slice(4, 16)).toBe(outcome.id?.slice(4));
});

test('a known file writes nothing', async () => {
  const { door, calls, puts } = doorOf({ known: true });
  expect((await only(door, join(folder, 'one.txt'))).status).toBe('known');
  expect(puts).toStrictEqual([]);
  expect(calls.every((c) => c.text.startsWith('SELECT'))).toBe(true);
});

test('a file of a type nobody reads is refused before any write', async () => {
  const { door, calls, puts } = doorOf();
  expect((await only(door, join(folder, 'strange.xyz'))).status).toBe('refused');
  expect(puts).toStrictEqual([]);
  expect(calls.some((c) => c.text.includes('put_document'))).toBe(false);
});

test('a missing file and a folder are refused, and the run goes on', async () => {
  const { door } = doorOf();
  const outcomes = await ingestFiles(
    door,
    [join(folder, 'absent.txt'), join(folder, 'inner'), join(folder, 'two.txt')],
    OPTIONS,
  );
  expect(outcomes.map((o) => o.status)).toStrictEqual(['refused', 'refused', 'stored']);
});

test('a fault in the second statement rolls back and releases the client', async () => {
  const { door, calls, released } = doorOf({ failOn: 'put_document_text' });
  expect((await only(door, join(folder, 'one.txt'))).status).toBe('refused');
  const words = calls.map((c) => c.text);
  expect(words).toContain('BEGIN');
  expect(words).toContain('ROLLBACK');
  expect(words).not.toContain('COMMIT');
  expect(released()).toBe(1);
});

test('the run reports a line for each file', () => {
  expect(
    reportLine({ path: 'a.pdf', status: 'stored', id: 'doc_aaaaaaaaaaaa', emptyPages: [3, 5] }),
  ).toBe('stored  a.pdf  doc_aaaaaaaaaaaa  no text on pages 3, 5');
  expect(
    reportLine({ path: 'a.pdf', status: 'known', id: 'doc_aaaaaaaaaaaa', emptyPages: [] }),
  ).toBe('known  a.pdf  doc_aaaaaaaaaaaa');
  expect(reportLine({ path: 'a.pdf', status: 'refused', reason: 'no type' })).toBe(
    'refused  a.pdf  no type',
  );
});

test('a stored file carries its hash and its page count', async () => {
  const { door } = doorOf();
  const outcome = await only(door, join(folder, 'one.txt'));
  expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.pageCount).toBe(1);
  expect(outcome.emptyPages).toStrictEqual([]);
});

test('a known file carries its hash and no page count', async () => {
  const { door } = doorOf({ known: true });
  const outcome = await only(door, join(folder, 'one.txt'));
  expect(outcome.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.pageCount).toBeUndefined();
});

test('a dry run writes nothing, and a second file with the same bytes is known', async () => {
  const { door, calls, puts } = doorOf();
  const outcomes = await ingestFiles(
    door,
    [join(folder, 'one.txt'), join(folder, 'copy-of-one.txt'), join(folder, 'two.txt')],
    { ...OPTIONS, dryRun: true },
  );
  expect(outcomes.map((o) => o.status)).toStrictEqual(['stored', 'known', 'stored']);
  expect(puts).toStrictEqual([]);
  expect(calls.every((c) => c.text.startsWith('SELECT'))).toBe(true);
});

test.each([
  ['a real run', false],
  ['a dry run', true],
])('an image with no text is refused before any write, in %s', async (_, dryRun) => {
  const { door, calls, puts } = doorOf();
  const [outcome] = await ingestFiles(door, [join(folder, 'blank.png')], { ...OPTIONS, dryRun });
  expect(outcome?.status).toBe('refused');
  expect(outcome?.reason).toMatch(/no text/);
  expect(puts).toStrictEqual([]);
  expect(calls.some((c) => c.text.includes('put_document'))).toBe(false);
});
