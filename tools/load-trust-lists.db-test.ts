// The loader reads an approved folder, and it loads a file only when APPROVALS.md names the file
// and holds the hash of its bytes. Each test writes its own folder under the temporary directory
// and runs the loader inside a transaction that rolls back. No file of the private data
// repository is read.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';

import { loadTrustLists } from './load-trust-lists.ts';
import { rolledBack, type Ask } from './probe.ts';

const BELLIGERENTS = '﻿code;name;conflict\nRU;Russia;the war\nUA;Ukraine;the war\n';
const HOSTS =
  'outlet;host_or_account;regime;list_entry_id;list_url\n' +
  'RIA;ria.example;EU;EU-777;https://eur-lex.europa.eu/x\n' +
  'Channel Z;telegram:77;US;US-12;https://ofac.treasury.gov/y\n';
const CARD = [
  'issuer: host:ofac.treasury.gov',
  'display_name: OFAC',
  'hosts: [ofac.treasury.gov]',
  'url_patterns: ["%/recent-actions/%"]',
  'record_kinds: [designation]',
  'fields:',
  '  - { name: entry, declarant: issuer }',
  'jurisdiction: US',
  'sanctions_regime: US',
  '',
].join('\n');

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })),
  );
});

interface Fixture {
  readonly folder: string;
  readonly approvals: (rows: readonly { file: string; sha: string }[]) => Promise<void>;
}

const approved = async (
  files: Readonly<Record<string, string>>,
  approve: readonly string[] = Object.keys(files),
): Promise<Fixture> => {
  const folder = await mkdtemp(join(tmpdir(), 'gab-approved-'));
  folders.push(folder);
  await mkdir(join(folder, 'register-cards'), { recursive: true });
  for (const [name, text] of Object.entries(files)) await writeFile(join(folder, name), text);
  const approvals = async (rows: readonly { file: string; sha: string }[]): Promise<void> => {
    await writeFile(
      join(folder, 'APPROVALS.md'),
      [
        '# Approvals',
        '',
        '| date | file | sha256 | reason |',
        '|---|---|---|---|',
        ...rows.map((row) => `| 2026-03-01 | ${row.file} | ${row.sha} | the operator read it |`),
        '',
      ].join('\n'),
    );
  };
  await approvals(approve.map((file) => ({ file, sha: sha(files[file] ?? '') })));
  return { folder, approvals };
};

const ALL = {
  'belligerents.csv': BELLIGERENTS,
  'sanctioned-hosts.csv': HOSTS,
  'register-cards/ofac.yaml': CARD,
};

// The loader runs as the operator role. The test reads the tables as the superuser, so each door
// call switches the session user for the length of that one call.
const asOperator =
  (ask: Ask): Ask =>
  async (text, values) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await ask('SAVEPOINT one_door');
    try {
      return await ask(text, values);
    } catch (error) {
      await ask('ROLLBACK TO SAVEPOINT one_door');
      throw error;
    } finally {
      await ask('RESET SESSION AUTHORIZATION');
    }
  };

const count = async (ask: Ask, table: string): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(await ask(`SELECT count(*)::int AS n FROM public.${table}`))[0]?.n ?? -1;

const statusOfEach = (reports: readonly { file: string; status: string }[]) =>
  Object.fromEntries(reports.map((report) => [report.file, report.status]));

test('the three lists load, and the card makes its issuer A', async () => {
  const { folder } = await approved(ALL);
  const held = await rolledBack('superuser', async (ask) => {
    const reports = await loadTrustLists(folder, asOperator(ask));
    return {
      reports: statusOfEach(reports),
      belligerent: await count(ask, 'belligerent'),
      hosts: await count(ask, 'sanctioned_hosts'),
      cards: await count(ask, 'issuer_card'),
      loads: await count(ask, 'trust_list_load'),
    };
  });
  expect(held).toStrictEqual({
    reports: {
      'belligerents.csv': 'loaded',
      'sanctioned-hosts.csv': 'loaded',
      'register-cards/ofac.yaml': 'loaded',
    },
    belligerent: 2,
    hosts: 2,
    cards: 1,
    loads: 3,
  });
});

test('a rerun of the same folder writes nothing', async () => {
  const { folder } = await approved(ALL);
  const held = await rolledBack('superuser', async (ask) => {
    await loadTrustLists(folder, asOperator(ask));
    const before = await count(ask, 'trust_list_load');
    const again = await loadTrustLists(folder, asOperator(ask));
    return { again: statusOfEach(again), before, after: await count(ask, 'trust_list_load') };
  });
  expect(Object.values(held.again)).toStrictEqual(['unchanged', 'unchanged', 'unchanged']);
  expect(held.after).toBe(held.before);
});

test('a file with a wrong hash is refused and the others load', async () => {
  const { folder, approvals } = await approved(ALL);
  await approvals([
    { file: 'belligerents.csv', sha: sha('another text') },
    { file: 'sanctioned-hosts.csv', sha: sha(HOSTS) },
    { file: 'register-cards/ofac.yaml', sha: sha(CARD) },
  ]);
  const held = await rolledBack('superuser', async (ask) => {
    const reports = await loadTrustLists(folder, asOperator(ask));
    return { reports: statusOfEach(reports), belligerent: await count(ask, 'belligerent') };
  });
  expect(held.reports['belligerents.csv']).toBe('refused');
  expect(held.reports['sanctioned-hosts.csv']).toBe('loaded');
  expect(held.belligerent).toBe(0);
});

test('a file with no row in APPROVALS.md is refused', async () => {
  const { folder } = await approved(ALL, ['belligerents.csv', 'register-cards/ofac.yaml']);
  const held = await rolledBack('superuser', async (ask) => {
    const reports = await loadTrustLists(folder, asOperator(ask));
    return { reports: statusOfEach(reports), hosts: await count(ask, 'sanctioned_hosts') };
  });
  expect(held.reports['sanctioned-hosts.csv']).toBe('refused');
  expect(held.hosts).toBe(0);
});

test('a changed file needs a new row, and the new bytes replace the old rows', async () => {
  const first = await approved(ALL);
  const held = await rolledBack('superuser', async (ask) => {
    await loadTrustLists(first.folder, asOperator(ask));
    const changed = 'code;name;conflict\nRU;Russia;the war\n';
    await writeFile(join(first.folder, 'belligerents.csv'), changed);
    const refused = statusOfEach(await loadTrustLists(first.folder, asOperator(ask)));
    await first.approvals([
      { file: 'belligerents.csv', sha: sha(changed) },
      { file: 'sanctioned-hosts.csv', sha: sha(HOSTS) },
      { file: 'register-cards/ofac.yaml', sha: sha(CARD) },
    ]);
    const loaded = statusOfEach(await loadTrustLists(first.folder, asOperator(ask)));
    return { refused, loaded, belligerent: await count(ask, 'belligerent') };
  });
  expect(held.refused['belligerents.csv']).toBe('refused');
  expect(held.loaded['belligerents.csv']).toBe('loaded');
  expect(held.belligerent).toBe(1);
});

test('a sanctioned host row with the optional registration columns loads', async () => {
  const text =
    'outlet;host_or_account;regime;list_entry_id;list_url;outlet_registration;entry_registration\n' +
    'Channel Z;z.example;EU;EU-9;https://eur-lex.europa.eu/x;1027700000001;1027700000001\n';
  const { folder } = await approved({ 'sanctioned-hosts.csv': text });
  const hosts = await rolledBack('superuser', async (ask) => {
    await loadTrustLists(folder, asOperator(ask));
    return count(ask, 'sanctioned_hosts');
  });
  expect(hosts).toBe(1);
});

test('a homonym row with a different registration number is refused', async () => {
  const text =
    'outlet;host_or_account;regime;list_entry_id;list_url;outlet_registration;entry_registration\n' +
    'Channel Z;z.example;EU;EU-9;https://eur-lex.europa.eu/x;1027700000001;1027700000002\n';
  const { folder } = await approved({ 'sanctioned-hosts.csv': text });
  const [report] = await rolledBack('superuser', (ask) => loadTrustLists(folder, asOperator(ask)));
  expect(report?.status).toBe('refused');
  expect(report?.detail).toMatch(/registration number/);
});

test('a row with the regime UK or no list entry is refused', async () => {
  const text =
    'outlet;host_or_account;regime;list_entry_id;list_url\n' +
    'RIA;ria.example;UK;UK-1;https://ofsi.example/x\n';
  const { folder } = await approved({ 'sanctioned-hosts.csv': text });
  const [report] = await rolledBack('superuser', (ask) => loadTrustLists(folder, asOperator(ask)));
  expect(report?.status).toBe('refused');
  expect(report?.detail).toMatch(/regime/);
});

test('a file that the loader does not know is left alone', async () => {
  const { folder } = await approved({ ...ALL, 'notes.txt': 'not a list' });
  const reports = await rolledBack('superuser', (ask) => loadTrustLists(folder, asOperator(ask)));
  expect(reports.map((report) => report.file)).not.toContain('notes.txt');
});

test('the repository holds no copy of the private data folder', () => {
  expect(existsSync(join(import.meta.dirname, '..', 'GAB-data'))).toBe(false);
  expect(existsSync(join(import.meta.dirname, '..', 'approved'))).toBe(false);
});
