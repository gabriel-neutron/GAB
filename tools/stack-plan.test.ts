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

test('the project name comes from the folder of the checkout', () => {
  expect(projectOf('/work/GAB/.claude/worktrees/Agent.A1')).toBe('gab-agent-a1');
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

test('a session stack whose compose file is gone is an orphan, and the main stack is never one', () => {
  const listed = JSON.stringify([
    { Name: 'gab', Status: 'running(5)', ConfigFiles: '/gone/infra/docker-compose.yml' },
    { Name: 'gab-a', Status: 'running(3)', ConfigFiles: '/here/infra/docker-compose.yml' },
    { Name: 'gab-b', Status: 'exited(3)', ConfigFiles: '/gone/infra/docker-compose.yml' },
  ]);
  const stacks = sessionStacks(listed);

  expect(stacks.map(({ name, running }) => [name, running])).toEqual([
    ['gab-a', true],
    ['gab-b', false],
  ]);
  expect(orphanStacks(stacks, (file) => file.startsWith('/here/')).map(({ name }) => name)).toEqual(
    ['gab-b'],
  );
});

test('only a node process of the checkout stops, never this process, its parents or a tool server', () => {
  const root = '/work/tree';
  const seen = [
    { pid: 10, cwd: root, argv: ['/usr/bin/node', 'packages/writer/src/main.ts'] },
    { pid: 11, cwd: `${root}/src`, argv: ['node', `${root}/node_modules/vite/bin/vite.js`] },
    { pid: 12, cwd: root, argv: ['node', 'tools/stack.ts', 'down'] },
    { pid: 13, cwd: root, argv: ['node', '/opt/npx/playwright-mcp'] },
    { pid: 14, cwd: '/work/other', argv: ['node', 'packages/writer/src/main.ts'] },
    { pid: 15, cwd: root, argv: ['bash', 'run.sh'] },
  ];

  expect(strayProcesses(seen, root, new Set([12]))).toEqual([10, 11]);
});
