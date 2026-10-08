import { expect, test } from 'vitest';

import {
  orphanStacks,
  projectOf,
  sessionStacks,
  slotOf,
  slotPorts,
  stackValues,
  strayProcesses,
  withStackBlock,
} from './stack-plan.ts';

test('a slot moves every port of the main stack by 100 per slot', () => {
  expect(slotPorts(2)).toEqual([5632, 3200, 3201, 9200, 9088]);
});

test('the project name holds the folder name and a hash of the full path', () => {
  const one = projectOf('/work/GAB/.claude/worktrees/Agent.A1');
  const other = projectOf('/elsewhere/Agent.A1');

  expect(one).toMatch(/^gab-agent-a1-[0-9a-f]{6}$/u);
  expect(other).not.toBe(one);
});

test('the block replaces the block of an earlier run and each copied value of the same name', () => {
  const copied = 'POSTGRES_PASSWORD=p\nGABRIEL_DB_PORT=5432\nSEARXNG_URL=http://x\n';
  const first = withStackBlock(copied, stackValues('gab-a', 1));
  const second = withStackBlock(first, stackValues('gab-a', 2));

  expect(second.match(/^GABRIEL_DB_PORT=.*$/gmu)).toEqual(['GABRIEL_DB_PORT=5632']);
  expect(second.match(/>>> session stack/gu)).toHaveLength(1);
  expect(second).toContain('POSTGRES_PASSWORD=p\n');
  expect(second).toContain('GABRIEL_TEST_API_URL=http://127.0.0.1:3201/');
  expect(slotOf(second)).toBe(2);
  expect(slotOf(copied)).toBeNull();
});

test('a cut block with no end mark goes up to the end of the file', () => {
  const cut = withStackBlock('A=1\n', stackValues('gab-a', 1)).split('# <<<')[0] ?? '';

  expect(withStackBlock(cut, stackValues('gab-a', 3)).match(/>>> session stack/gu)).toHaveLength(1);
});

test('only a gone stack of a worktree of the main checkout is an orphan', () => {
  const main = '/work/GAB';
  const tree = (name: string): string =>
    `${main}/.claude/worktrees/${name}/infra/docker-compose.yml`;
  const listed = JSON.stringify([
    { Name: 'gab', Status: 'running(5)', ConfigFiles: '/gone/infra/docker-compose.yml' },
    { Name: 'gab-a', Status: 'running(3)', ConfigFiles: tree('a') },
    { Name: 'gab-b', Status: 'exited(3)', ConfigFiles: tree('b') },
    { Name: 'gab-c', Status: 'exited(3)', ConfigFiles: '/gone/infra/docker-compose.yml' },
    { Name: 'gab-d', Status: 'exited(3)', ConfigFiles: '' },
    { Name: 'gab-e', Status: 'exited(3)', ConfigFiles: `${main}/.claude/worktrees/e/other.yml` },
  ]);
  const stacks = sessionStacks(listed);

  expect(stacks.map(({ name, running }) => [name, running])).toEqual([
    ['gab-a', true],
    ['gab-b', false],
    ['gab-c', false],
    ['gab-d', false],
    ['gab-e', false],
  ]);
  expect(orphanStacks(stacks, main, (file) => file === tree('a')).map(({ name }) => name)).toEqual([
    'gab-b',
  ]);
});

test('only a node script of the checkout stops, never this process, its parents or a tool server', () => {
  const root = '/work/tree';
  const files = new Set([
    `${root}/packages/writer/src/main.ts`,
    `${root}/node_modules/vite/bin/vite.js`,
    `${root}/tools/stack.ts`,
  ]);
  const seen = [
    { pid: 10, cwd: root, argv: ['/usr/bin/node', '--env-file=x', 'packages/writer/src/main.ts'] },
    { pid: 11, cwd: `${root}/src`, argv: ['node', `${root}/node_modules/vite/bin/vite.js`] },
    { pid: 12, cwd: root, argv: ['node', 'tools/stack.ts', 'down'] },
    { pid: 13, cwd: root, argv: ['node', '/opt/mcp.js', '--browser', 'chromium'] },
    { pid: 14, cwd: '/work/other', argv: ['node', 'packages/writer/src/main.ts'] },
    { pid: 15, cwd: root, argv: ['bash', 'run.sh'] },
    { pid: 16, cwd: root, argv: ['node', '/usr/lib/node_modules/claude-code/cli.js', 'resume'] },
    { pid: 17, cwd: root, argv: ['/opt/claude/claude', '--output-format', 'stream-json'] },
    { pid: 18, cwd: root, argv: ['node', '--conditions', 'tools/stack.ts', 'absent.ts'] },
  ];

  expect(strayProcesses(seen, root, new Set([12]), (file) => files.has(file))).toEqual([10, 11]);
});
