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
import { codeVersion } from './code-version.ts';
import { WORKER_ROLES, type Role } from './roles.ts';
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

// The version is read once, at start, so each session sees the commit that runs.
const VERSION = codeVersion();
const SERVER = { name: 'gab', version: VERSION } as const;
const INSTRUCTIONS = `This gab server runs the code version ${VERSION} (a git commit, or the package version when no git checkout is there).`;

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const SURFACE = Object.entries(RESEARCH_TOOLS).map(([name, annotations]) => ({
  tool: toolNamed(name),
  annotations,
}));

// The whole surface with no role, and only the tools of the role with one.
const surfaceOf = (role: Role | undefined): typeof SURFACE => {
  if (role === undefined) return SURFACE;
  const own: readonly string[] = WORKER_ROLES[role];
  return SURFACE.filter(({ tool }) => own.includes(tool.name));
};

const listedOf = (surface: typeof SURFACE): ListedTool[] =>
  surface.map(({ tool, annotations }) => ({
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

// A fault with no SQLSTATE comes from the code of the tool, and not from the database. Its message
// can name a path or a host, so the client gets no part of it, and the operator reads it in the log.
const CALL_FAULT = 'the server failed the call, and the operator reads the fault in its log';

// External constraint: pg reports a lost connection with a Node error code or with a message of pg.
// A fetch or the object store can give the same codes, so the sentence does not name the database.
const LOST_CODES: readonly unknown[] = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'];
const LOST_CONNECTION =
  'a connection of the server stopped during the call; a write can be complete, so read the record before you send the call again';

const isLostConnection = (cause: unknown): boolean =>
  cause instanceof Error &&
  (('code' in cause && LOST_CODES.includes(cause.code)) ||
    cause.message.startsWith('Connection terminated') ||
    cause.message.endsWith('is not queryable'));

const faultSentence = (cause: unknown): string => {
  if (isLostConnection(cause)) return LOST_CONNECTION;
  const code = codeOf(cause);
  if (code === null) return CALL_FAULT;
  if (DATA_CLASSES.includes(code.slice(0, 2)) && cause instanceof Error) {
    const field = hintOf(cause);
    return field === null
      ? `the record refused the call: ${cause.message}`
      : `the record refused the call: ${field}: ${cause.message}`;
  }
  return `the database refused the call (SQLSTATE ${code})`;
};

interface Context {
  readonly tools: readonly Tool[];
  readonly pool: SessionPool;
  readonly reach: Reach | undefined;
  readonly check: SecondCheck | undefined;
  /** The family of the research AI, which the server reads from its client. */
  readonly readerFamily: () => string | null;
}

const run = async (context: Context, name: string, raw: unknown): Promise<CallToolResult> => {
  const { tools, pool, reach, check } = context;
  const tool = tools.find((entry) => entry.name === name);
  if (tool === undefined)
    return toolError(
      `the server holds no tool named ${name}; it holds ${tools.map((one) => one.name).join(', ')}`,
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
        : await callTool(
            tool,
            // A session of this pool is one connection until its release.
            { query: (text, values) => session.query(text, values), pinned: true },
            raw ?? {},
            reach,
          );
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
 * proposed item with its passages; with none, code alone checks a proposal. With a role, the
 * server lists and runs only the tools of that role. */
export const createServer = (
  pool: SessionPool,
  reach?: Reach,
  check?: SecondCheck,
  role?: Role,
): McpServer => {
  const mcp = new McpServer(SERVER, {
    capabilities: { tools: {} },
    instructions: INSTRUCTIONS,
  });
  const surface = surfaceOf(role);
  const context: Context = {
    tools: surface.map(({ tool }) => tool),
    pool,
    // The HTTP mode builds one server for each session, so each session holds its own upload parts.
    reach: reach === undefined ? undefined : { ...reach, uploadParts: new Map() },
    check,
    readerFamily: () => readerFamilyOf(mcp.server.getClientVersion()?.name, process.env),
  };

  mcp.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listedOf(surface) }));

  mcp.server.setRequestHandler(CallToolRequestSchema, (request) =>
    run(context, request.params.name, request.params.arguments),
  );

  return mcp;
};
