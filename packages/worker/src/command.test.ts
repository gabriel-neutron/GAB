import { expect, test } from 'vitest';

import { readCommand } from './command.ts';

test('the first word picks the sub-command, and the other words go to it', () => {
  expect(readCommand(['ingest', 'a.pdf', '--retrieved-at', '2026-10-06'])).toMatchObject({
    kind: 'command',
    name: 'ingest',
    args: ['a.pdf', '--retrieved-at', '2026-10-06'],
  });
});

test('no word gives the usage, and the usage names each sub-command', () => {
  const command = readCommand([]);
  expect(command.kind).toBe('usage');
  for (const name of ['ingest', 'layout', 'reconcile', 'reference-set', 'reread-html', 'run'])
    expect(command).toHaveProperty('text', expect.stringContaining(name));
});

test('an unknown word gives the usage, and the usage names the word', () => {
  expect(readCommand(['runner'])).toStrictEqual({
    kind: 'usage',
    text: '"runner" is not a sub-command. Usage: pnpm worker <ingest|layout|reconcile|reference-set|reread-html|run> [arguments]',
  });
});

test('the name of a property of every object is not a sub-command', () => {
  expect(readCommand(['toString']).kind).toBe('usage');
});

test.each(['ingest', 'layout', 'reconcile', 'reference-set', 'reread-html', 'run'])(
  'the %s sub-command loads, and opens no connection when it loads',
  async (name) => {
    const command = readCommand([name]);
    if (command.kind !== 'command') throw new Error(`${name} is not a sub-command`);
    expect(typeof (await command.load())).toBe('function');
  },
);
