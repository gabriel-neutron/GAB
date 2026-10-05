import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { z } from 'zod';

const HERE = import.meta.dirname;
const ROOT_MANIFEST = path.resolve(HERE, '../../../package.json');

const manifest = z.object({ scripts: z.record(z.string(), z.string()) });

// Node runs this package from its source, so a relative import names the file with its extension.
const RELATIVE_IMPORT = /from '\.\/([\w-]+\.ts)'/g;
const ENTRY = /packages\/worker\/src\/([\w-]+\.ts)/;

const entryFiles = (): string[] => {
  const { scripts } = manifest.parse(JSON.parse(readFileSync(ROOT_MANIFEST, 'utf8')));
  return Object.values(scripts).flatMap((command) => {
    const file = ENTRY.exec(command)?.[1];
    return file === undefined ? [] : [file];
  });
};

const reachedSources = (entry: string): string[] => {
  const seen = new Map<string, string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    const text = readFileSync(path.join(HERE, file), 'utf8');
    seen.set(file, text);
    for (const found of text.matchAll(RELATIVE_IMPORT)) {
      const next = found[1];
      if (next !== undefined) walk(next);
    }
  };
  walk(entry);
  return [...seen.values()];
};

// The runner is the one process that takes a job from the queue. Every other run is taken by hand,
// and a hand-taken run that claimed a job would spend an attempt that the operator never asked for.
const RUNNER = 'runner-main.ts';

test('no hand-taken run that a root script starts from this package reaches the claim door', () => {
  const entries = entryFiles().filter((entry) => entry !== RUNNER);
  expect(entries.length, 'the root manifest starts a run of this package').toBeGreaterThan(0);
  for (const entry of entries) {
    const claims = reachedSources(entry).some((text) => text.includes('claim_job'));
    expect(claims, `${entry} reaches claim_job`).toBe(false);
  }
});

test('the runner script is the one run that reaches the claim door', () => {
  expect(entryFiles()).toContain(RUNNER);
  expect(reachedSources(RUNNER).some((text) => text.includes('claim_job'))).toBe(true);
});
