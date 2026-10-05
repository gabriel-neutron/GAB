// The server must not reach the writer by any path. The walk follows each relative import and
// each workspace import from every module of the package, so an indirect import fails too.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

const SOURCE = import.meta.dirname;
const PACKAGES = resolve(SOURCE, '..', '..');

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu;

const manifest = z.object({
  exports: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
});

const isModule = (name: string): boolean =>
  name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.db-test.ts');

const modulesOf = (folder: string): string[] =>
  readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter(isModule)
    .map((name) => join(folder, name));

// A workspace specifier names a package folder and an entry of its export map.
const workspaceFile = (specifier: string): string | null => {
  const [scope, name, ...rest] = specifier.split('/');
  if (scope !== '@gab' || name === undefined) return null;
  const folder = join(PACKAGES, name);
  const exports = manifest.parse(
    JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')),
  ).exports;
  const entry = exports?.[rest.length === 0 ? '.' : `./${rest.join('/')}`];
  if (entry === undefined) throw new Error(`${specifier} is not an export of its package`);
  return join(folder, entry);
};

const reached = (start: readonly string[]): { files: Set<string>; specifiers: Set<string> } => {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  const queue = [...start];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2];
      if (specifier === undefined) continue;
      specifiers.add(specifier);
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        if (existsSync(target)) queue.push(target);
      } else {
        const target = workspaceFile(specifier);
        if (target !== null) queue.push(target);
      }
    }
  }
  return { files, specifiers };
};

test('no module of the package imports the writer, directly or through another module', () => {
  const start = modulesOf(SOURCE);
  expect(start.length).toBeGreaterThan(0);
  const { files, specifiers } = reached(start);
  expect(files.size).toBeGreaterThan(start.length);
  const writer = join(PACKAGES, 'writer');
  expect([...files].filter((file) => file.startsWith(writer))).toStrictEqual([]);
  expect([...specifiers].filter((name) => name.startsWith('@gab/writer'))).toStrictEqual([]);
});

test('the package does not depend on the writer', () => {
  const own = manifest.parse(JSON.parse(readFileSync(join(SOURCE, '..', 'package.json'), 'utf8')));
  expect(Object.keys(own.dependencies ?? {})).not.toContain('@gab/writer');
});

test('no module of the package names a path of the writer service', () => {
  const naming = modulesOf(SOURCE).filter((file) => readFileSync(file, 'utf8').includes('/write/'));
  expect(naming).toStrictEqual([]);
});
