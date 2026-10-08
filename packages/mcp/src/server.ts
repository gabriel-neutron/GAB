import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool as ListedTool,
} from '@modelcontextprotocol/sdk/types.js';
import { CATALOGUE } from '@gab/tools/catalogue';
import { callTool, inputSchemaOf, type Reach, type Session, type Tool } from '@gab/tools/tool';

import { proposeChecked } from './checked-propose.ts';
import { readerFamilyOf, type SecondCheck } from './second-check.ts';
import { RESEARCH_TOOLS } from './surface.ts';

/** A session that goes back to its pool when the call ends. */
export interface PooledSession extends Session {
  release(): void;
}

/** What the server needs from a pool. The caller opens it and decides its role. */
export interface SessionPool {
  connect(): Promise<PooledSession>;
}

const SERVER = { name: 'gab', version: '0.0.0' } as const;

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const SURFACE = Object.entries(RESEARCH_TOOLS).map(([name, annotations]) => ({
  tool: toolNamed(name),
  annotations,
}));

const TOOLS: readonly Tool[] = SURFACE.map(({ tool }) => tool);

const LISTED: readonly ListedTool[] = SURFACE.map(({ tool, annotations }) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: { ...inputSchemaOf(tool), type: 'object' as const },
  annotations,
}));

const toolError = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});

const codeOf = (cause: unknown): string | null =>
  typeof cause === 'object' &&
  cause !== null &&
  'code' in cause &&
  typeof cause.code === 'string' &&
  /^[0-9A-Z]{5}$/u.test(cause.code)
    ? cause.code
    : null;

const hintOf = (cause: Error): string | null =>
  'hint' in cause && typeof cause.hint === 'string' && cause.hint !== '' ? cause.hint : null;

// External constraint: SQLSTATE class 22 is a fault of the data, 23 is a rule of the record and
// P0 is a refusal that a door raises. Their message is the sentence of the rule, and the hint
// names the field to correct. Every other class can name a role, a host or a password, so the
// operator reads it in the log, and the client gets the code alone.
const DATA_CLASSES: readonly string[] = ['22', '23', 'P0'];

const faultSentence = (cause: unknown): string => {
  const code = codeOf(cause);
  if (code === null) return 'the database refused the call';
  if (DATA_CLASSES.includes(code.slice(0, 2)) && cause instanceof Error) {
    const field = hintOf(cause);
    return field === null
      ? `the record refused the call: ${cause.message}`
      : `the record refused the call: ${field}: ${cause.message}`;
  }
  return `the database refused the call (SQLSTATE ${code})`;
};

interface Context {
  readonly pool: SessionPool;
  readonly reach: Reach | undefined;
  readonly check: SecondCheck | undefined;
  /** The family of the research AI, which the server reads from its client. */
  readonly readerFamily: () => string | null;
}

const run = async (context: Context, name: string, raw: unknown): Promise<CallToolResult> => {
  const { pool, reach, check } = context;
  const tool = TOOLS.find((entry) => entry.name === name);
  if (tool === undefined)
    return toolError(
      `the server holds no tool named ${name}; it holds ${TOOLS.map((one) => one.name).join(', ')}`,
    );

  let session: PooledSession;
  try {
    session = await pool.connect();
  } catch (cause) {
    console.error(cause);
    return toolError(faultSentence(cause));
  }
  try {
    const outcome =
      tool.name === 'propose' && check !== undefined
        ? await proposeChecked(tool, session, raw ?? {}, reach, check, context.readerFamily())
        : await callTool(tool, session, raw ?? {}, reach);
    if (!outcome.ok) return toolError(outcome.refusal);
    return { content: [{ type: 'text', text: JSON.stringify(outcome.output) }] };
  } catch (cause) {
    console.error(cause);
    return toolError(faultSentence(cause));
  } finally {
    session.release();
  }
};

// The server registers its own handlers, so the input schema of each tool goes out as the
// catalogue builds it, and the refusal of a bad input is the sentence of the tool.
/** The MCP server of the research workspace. With no reach, each tool that stores or reads the
 * web refuses its call. With a check, a model of another family than the research AI reads each
 * proposed item with its passages; with none, code alone checks a proposal. */
export const createServer = (pool: SessionPool, reach?: Reach, check?: SecondCheck): McpServer => {
  const mcp = new McpServer(SERVER, { capabilities: { tools: {} } });
  const context: Context = {
    pool,
    reach,
    check,
    readerFamily: () => readerFamilyOf(mcp.server.getClientVersion()?.name),
  };

  mcp.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [...LISTED] }));

  mcp.server.setRequestHandler(CallToolRequestSchema, (request) =>
    run(context, request.params.name, request.params.arguments),
  );

  return mcp;
};
