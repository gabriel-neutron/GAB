// An MCP client talks to the server of each role in the same process. The pool is a fake that counts
// each session, so a refused call proves that it did not reach the database.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CATALOGUE } from '@gab/tools/catalogue';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { roleArgs, toolsOfRole } from './role-settings.ts';
import { ROLES, WORKER_ROLES, type Role } from './roles.ts';
import { createServer, type SessionPool } from './server.ts';
import { RESEARCH_TOOLS } from './surface.ts';

const connected = async (role: Role, pool: SessionPool): Promise<Client> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(pool, undefined, undefined, role).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
};

const answer = z.object({
  content: z.array(z.object({ text: z.string() })),
  isError: z.boolean().optional(),
});

const ALL: readonly string[] = CATALOGUE.map((tool) => tool.name);

test.each(ROLES)(
  'the role %s lists its own tools, and each other call is refused',
  async (role) => {
    let sessions = 0;
    const pool: SessionPool = {
      connect: () => {
        sessions += 1;
        return Promise.reject(new Error('no database'));
      },
    };
    const client = await connected(role, pool);
    const own: readonly string[] = WORKER_ROLES[role];
    const listed = (await client.listTools()).tools.map((tool) => tool.name);
    expect([...listed].sort()).toStrictEqual([...own].sort());
    for (const name of ALL.filter((tool) => !own.includes(tool))) {
      const called = answer.parse(await client.callTool({ name, arguments: {} }));
      expect(called.isError).toBe(true);
      expect(called.content[0]?.text).toContain(`holds no tool named ${name}`);
    }
    expect(sessions).toBe(0);
    await client.close();
  },
);

test('the roles keep the separation of the wave', () => {
  const has = (role: Role, tool: string): boolean =>
    (WORKER_ROLES[role] as readonly string[]).includes(tool);
  const deciding = ['promote_unit', 'reject_unit', 'reject_relation', 'join_unit'];
  deciding.push('promote_clean_proposals');
  for (const role of ROLES) {
    expect(has(role, 'start_lead')).toBe(false);
    if (role !== 'reviewer') expect(deciding.filter((tool) => has(role, tool))).toStrictEqual([]);
    if (role !== 'proposer') expect(has(role, 'propose')).toBe(false);
  }
  expect(has('fact_closer', 'find_line')).toBe(true);
  expect(has('fact_closer', 'read_page') && has('build_closer', 'read_page')).toBe(true);
  // Only the two closers have the read route.
  expect(ROLES.filter((role) => has(role, 'read_page'))).toHaveLength(2);
  expect(WORKER_ROLES.coder).toStrictEqual([]);
});

test.each(['fact_closer', 'build_closer', 'panel'] as const)(
  'the role %s stores nothing and decides nothing',
  (role) => {
    for (const tool of WORKER_ROLES[role]) expect(RESEARCH_TOOLS[tool].readOnlyHint).toBe(true);
  },
);

test('a worker of a role gets a strict file, a turn cap and only its own tools', () => {
  for (const role of ROLES) {
    const args = roleArgs(role, 'role.mcp.json', 'a-model');
    const valueOf = (flag: string): string => args[args.indexOf(flag) + 1] ?? '';
    expect(args).toContain('--strict-mcp-config');
    expect(valueOf('--mcp-config')).toBe('role.mcp.json');
    expect(valueOf('--permission-mode')).toBe('dontAsk');
    expect(Number(valueOf('--max-turns'))).toBeGreaterThan(0);
    const allowed = valueOf('--allowedTools').split(',');
    const shell = allowed.filter((tool) => tool.startsWith('Bash('));
    expect(allowed.filter((tool) => !shell.includes(tool)).sort()).toStrictEqual(
      toolsOfRole(role)
        .filter((tool) => tool !== 'Bash')
        .sort(),
    );
    expect(shell.length > 0).toBe(valueOf('--tools').split(',').includes('Bash'));
  }
  const shells = ROLES.filter((role) => toolsOfRole(role).includes('Bash'));
  expect(shells.sort()).toStrictEqual(['build_closer', 'coder']);
});
