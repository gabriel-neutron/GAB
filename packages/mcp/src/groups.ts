import { CATALOGUE, type ToolName } from '@gab/tools/catalogue';
import type { Tool } from '@gab/tools/tool';
import { z } from 'zod';

// A client sees one tool for each purpose, and the action inside it names a tool of the
// catalogue. The group adds no logic: the input of each action is the input of its tool.
export const RESEARCH_GROUPS = {
  graph: ['search_graph', 'neighbourhood', 'lookup_entity'],
  document: ['document_text', 'fetch_document'],
  propose: ['propose_change', 'proposal_read'],
  job: ['enqueue_extract', 'job_status'],
} as const satisfies Record<string, readonly ToolName[]>;

export type GroupName = keyof typeof RESEARCH_GROUPS;

export interface Group {
  readonly name: string;
  readonly description: string;
  readonly actions: ReadonlyMap<string, Tool>;
  /** The envelope that the server parses before it hands the input to the tool. */
  readonly envelope: z.ZodType<{ action: string; input?: unknown }>;
  /** What the client sees: the action and the input of each tool. */
  readonly inputSchema: Record<string, unknown>;
}

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

// The JSON Schema says which input each action takes, and the parse of the tool itself gives
// the refusal. A client reads a top level that is one object and not a choice of objects.
const publishedSchema = (names: readonly [string, ...string[]], tools: readonly Tool[]) => {
  const [first, ...rest] = tools.map((tool) => tool.input);
  if (first === undefined) throw new Error('a group holds no action');
  const input = rest.length === 0 ? first : z.union([first, ...rest]);
  const schema = z.strictObject({ action: z.enum(names), input });
  return Object.fromEntries(
    Object.entries(z.toJSONSchema(schema, { io: 'input' })).filter(([key]) => key !== '$schema'),
  );
};

const describe = (tools: readonly Tool[]): string =>
  [
    'Set action to one of the names below, and give its input as input.',
    ...tools.map((tool) => `${tool.name}: ${tool.description}`),
  ].join('\n');

const groupOf = (name: string, names: readonly [string, ...string[]]): Group => {
  const tools = names.map(toolNamed);
  return {
    name,
    description: describe(tools),
    actions: new Map(tools.map((tool) => [tool.name, tool])),
    envelope: z.strictObject({ action: z.enum(names), input: z.unknown() }),
    inputSchema: publishedSchema(names, tools),
  };
};

/** The groups in the order a client lists them. */
export const GROUPS: readonly Group[] = Object.entries(RESEARCH_GROUPS).map(([name, names]) =>
  groupOf(name, names),
);
