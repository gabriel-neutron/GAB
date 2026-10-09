// A client starts the server from the research workspace or from the root of the repository. The
// test reads the files of the server from both folders in a child process, so the working folder
// is the one that a client gives.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { researchEnvOf } from './config.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const CONFIG = pathToFileURL(path.join(import.meta.dirname, 'config.ts')).href;

const files = z.strictObject({ research: z.string(), stack: z.string(), inbox: z.string() });

const filesFrom = (folder: string): z.output<typeof files> => {
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const { CONFIG_FILES } = await import(${JSON.stringify(CONFIG)});
       process.stdout.write(JSON.stringify(CONFIG_FILES));`,
    ],
    { cwd: path.join(ROOT, folder), encoding: 'utf8', timeout: 20_000 },
  );
  if (run.status !== 0) throw new Error(`the child process failed: ${run.stderr}`);
  return files.parse(JSON.parse(run.stdout));
};

test.each(['.', 'research', 'packages'])(
  'the server finds the same files when it starts in the folder %s',
  (folder) => {
    expect(filesFrom(folder)).toStrictEqual({
      research: path.join(ROOT, 'research', '.env'),
      stack: path.join(ROOT, 'infra', '.env'),
      inbox: path.join(ROOT, 'research', 'inbox'),
    });
  },
);

test('a value of the research file fills a variable that the process does not set', () => {
  expect(researchEnvOf('GAB_RESEARCH_DATABASE_URL=postgresql://a\nSEARXNG_URL=x\n', {})).toEqual({
    GAB_RESEARCH_DATABASE_URL: 'postgresql://a',
    SEARXNG_URL: 'x',
  });
});

test('a value that the process sets wins, also an empty one', () => {
  expect(
    researchEnvOf('GAB_RESEARCH_DATABASE_URL=postgresql://a\nSEARXNG_URL=x\n', {
      GAB_RESEARCH_DATABASE_URL: '',
      SEARXNG_URL: 'y',
    }),
  ).toEqual({});
});

test('the research file is read with a byte order mark, and no file sets nothing', () => {
  expect(researchEnvOf('\uFEFFGAB_INBOX=inbox\n', {})).toEqual({ GAB_INBOX: 'inbox' });
  expect(researchEnvOf(null, {})).toEqual({});
});
