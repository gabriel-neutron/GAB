import { expect, test, vi } from 'vitest';

import { readCommand } from './command.ts';

test('the first word picks the sub-command, and the other words go to it', () => {
  expect(readCommand(['ingest', 'a.pdf', '--retrieved-at', '2026-10-06'])).toMatchObject({
    kind: 'command',
    name: 'ingest',
    args: ['a.pdf', '--retrieved-at', '2026-10-06'],
  });
});

test('asset-sanctions refuses an --as-of day that the calendar lacks, before it connects', async () => {
  const { assetSanctionsCommand } = await import('./release/asset-sanctions-command.ts');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(await assetSanctionsCommand(['--as-of', '2026-13-45'])).toBe(2);
});

test('delete-relation refuses a word that is not an id, before it connects', async () => {
  const { deleteRelationCommand } = await import('./delete-relation-command.ts');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(await deleteRelationCommand([])).toBe(2);
  expect(await deleteRelationCommand(['x'])).toBe(2);
});

test('no word gives the usage, and the usage names each sub-command', () => {
  const command = readCommand([]);
  expect(command.kind).toBe('usage');
  for (const name of [
    'author-names',
    'ingest',
    'layout',
    'name-candidates',
    'nato-coverage',
    'reconcile',
    'reference-set',
    'release',
    'requeue-ratings',
    'reread-html',
    'run',
  ])
    expect(command).toHaveProperty('text', expect.stringContaining(name));
});

test('an unknown word gives the usage, and the usage names the word', () => {
  expect(readCommand(['runner'])).toStrictEqual({
    kind: 'usage',
    text: '"runner" is not a sub-command. Usage: pnpm worker <activity-report|asset-coverage|asset-sanctions|audit-coverage|author-names|delete-relation|document-labels|dry-join|firms-sweep|gem-duplicates|geolocation-method|ingest|layout|merge-act|merge-entities|name-candidates|nato-coverage|reconcile|reference-dataset|reference-set|release|requeue-ratings|reread-html|run|sentinel2-pairs|text-set> [arguments]',
  });
});

test('the name of a property of every object is not a sub-command', () => {
  expect(readCommand(['toString']).kind).toBe('usage');
});

test.each([
  'asset-coverage',
  'asset-sanctions',
  'author-names',
  'dry-join',
  'firms-sweep',
  'geolocation-method',
  'ingest',
  'layout',
  'name-candidates',
  'nato-coverage',
  'reconcile',
  'reference-set',
  'release',
  'requeue-ratings',
  'reread-html',
  'run',
])('the %s sub-command loads, and opens no connection when it loads', async (name) => {
  const command = readCommand([name]);
  if (command.kind !== 'command') throw new Error(`${name} is not a sub-command`);
  expect(typeof (await command.load())).toBe('function');
});
