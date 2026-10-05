import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { callTool, type Session } from '@gab/tools/tool';

import { GROUPS } from './groups.ts';

/** A session that goes back to its pool when the call ends. */
export interface PooledSession extends Session {
  release(): void;
}

/** What the server needs from a pool. The caller opens it and decides its role. */
export interface SessionPool {
  connect(): Promise<PooledSession>;
}

const SERVER = { name: 'gab', version: '0.0.0' } as const;

const toolError = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});

const sqlState = (cause: unknown): string | null =>
  typeof cause === 'object' &&
  cause !== null &&
  'code' in cause &&
  typeof cause.code === 'string' &&
  /^[0-9A-Z]{5}$/u.test(cause.code)
    ? cause.code
    : null;

// A message of the database can name a role, a host or a password. The operator reads it in the
// log, and the client gets the code alone.
const faultSentence = (cause: unknown): string => {
  const code = sqlState(cause);
  return code === null
    ? 'the database refused the call'
    : `the database refused the call (SQLSTATE ${code})`;
};

const run = async (pool: SessionPool, name: string, raw: unknown): Promise<CallToolResult> => {
  const group = GROUPS.find((entry) => entry.name === name);
  if (group === undefined)
    return toolError(
      `the server holds no tool named ${name}; it holds ${GROUPS.map((g) => g.name).join(', ')}`,
    );

  const given = group.envelope.safeParse(raw ?? {});
  if (!given.success)
    return toolError(
      `give action, one of ${[...group.actions.keys()].join(', ')}, and the input of that action`,
    );
  const tool = group.actions.get(given.data.action);
  if (tool === undefined) return toolError(`the tool ${name} holds no action ${given.data.action}`);

  let session: PooledSession;
  try {
    session = await pool.connect();
  } catch (cause) {
    console.error(cause);
    return toolError(faultSentence(cause));
  }
  try {
    const outcome = await callTool(tool, session, given.data.input);
    if (!outcome.ok) return toolError(outcome.refusal);
    return { content: [{ type: 'text', text: JSON.stringify(outcome.output) }] };
  } catch (cause) {
    console.error(cause);
    return toolError(faultSentence(cause));
  } finally {
    session.release();
  }
};

// The server registers its own handlers, so the input schema of a group goes out as it is built
// and no tool of the catalogue is wrapped in a second schema.
/** The MCP server of the research workspace: it lists the groups and runs each call. */
export const createServer = (pool: SessionPool): McpServer => {
  const mcp = new McpServer(SERVER, { capabilities: { tools: {} } });

  mcp.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: GROUPS.map((group) => ({
      name: group.name,
      description: group.description,
      inputSchema: { ...group.inputSchema, type: 'object' as const },
    })),
  }));

  mcp.server.setRequestHandler(CallToolRequestSchema, (request) =>
    run(pool, request.params.name, request.params.arguments),
  );

  return mcp;
};
