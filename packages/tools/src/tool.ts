import type { RawObject } from '@gab/store';
import { z } from 'zod';

import type { Resolved } from './fetch-guard.ts';

/** What a tool needs from a connection. The caller opens it and decides its role. */
export interface Session {
  query(text: string, values: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

/** What one web request asks of the surface: the headers, and the two caps of the answer. */
export interface WebRequest {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly maxBytes: number;
}

/** The answer of one web request. A redirect is an answer and is never followed. */
export interface WebAnswer {
  readonly status: number;
  /** The names are in lower case. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** The only way a web tool reaches the web. The surface builds it, so a tool holds no socket. */
export interface Web {
  get(url: string, request: WebRequest): Promise<WebAnswer>;
  /** The address of the local SearXNG. It is an http address on the machine itself. */
  readonly searxngUrl?: string;
  /** The key of the Brave Search API. It leaves in a header and in no address. */
  readonly braveKey?: string;
}

/** What a tool needs beyond the database: the object store, the web, the clock and the resolver. */
export interface Reach {
  readonly store?: { put(object: RawObject): Promise<string> };
  readonly web?: Web;
  readonly now: () => Date;
  /** Every address of a name. The default asks the resolver of the system. */
  readonly lookup?: (host: string) => Promise<readonly Resolved[]>;
  /** The range check of an address. The default refuses the machine and each private network. */
  readonly refuses?: (address: string) => boolean;
}

/** A request that a tool declines, with the one sentence that says why. */
export class ToolRefusal extends Error {}

export interface Tool<
  Name extends string = string,
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
> {
  readonly name: Name;
  readonly description: string;
  readonly input: Input;
  readonly output: Output;
  run(session: Session, input: z.output<Input>, reach?: Reach): Promise<z.input<Output>>;
}

/** Keeps the literal name and both schemas of a tool, so the catalogue can be typed by them. */
export const defineTool = <Name extends string, Input extends z.ZodType, Output extends z.ZodType>(
  tool: Tool<Name, Input, Output>,
): Tool<Name, Input, Output> => tool;

export type ToolOutcome =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly refusal: string };

/** The JSON Schema of the input of a tool, as a client reads it. */
export const inputSchemaOf = (tool: Tool): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(z.toJSONSchema(tool.input, { io: 'input' })).filter(
      ([key]) => key !== '$schema',
    ),
  );

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const branchesOf = (node: Node): Node[] => [
  node,
  ...['anyOf', 'oneOf', 'allOf'].flatMap((key) => {
    const held = node[key];
    return Array.isArray(held) ? held.filter(isNode) : [];
  }),
];

// One step down the schema: the item of a list, the property of an object, or the value of a
// record. A union gives the first branch that holds the step.
const childOf = (node: Node, step: PropertyKey): Node | undefined => {
  for (const branch of branchesOf(node)) {
    const { items, properties, additionalProperties } = branch;
    if (typeof step === 'number' && isNode(items)) return items;
    if (typeof step !== 'string') continue;
    if (isNode(properties) && isNode(properties[step])) return properties[step];
    if (isNode(additionalProperties)) return additionalProperties;
  }
  return undefined;
};

const descriptionOf = (node: Node): string | undefined =>
  branchesOf(node)
    .map((branch) => branch['description'])
    .find((held): held is string => typeof held === 'string');

// The description nearest to the field that failed. It tells the caller how to write the value,
// so one retry is enough.
const hintAt = (schema: Node, path: readonly PropertyKey[]): string | undefined => {
  let node = schema;
  let hint: string | undefined;
  for (const step of path) {
    const next = childOf(node, step);
    if (next === undefined) break;
    node = next;
    hint = descriptionOf(node) ?? hint;
  }
  return hint;
};

const sentence = (tool: Tool, error: z.ZodError): string => {
  const schema = inputSchemaOf(tool);
  return error.issues
    .map((issue) => {
      const said =
        issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`;
      const hint = hintAt(schema, issue.path);
      return hint === undefined ? said : `${said} (${hint})`;
    })
    .join('; ');
};

/** Runs a tool on a raw input. A refusal is an outcome, and a fault of the database is thrown. */
export const callTool = async (
  tool: Tool,
  session: Session,
  raw: unknown,
  reach?: Reach,
): Promise<ToolOutcome> => {
  const given = tool.input.safeParse(raw);
  if (!given.success) return { ok: false, refusal: sentence(tool, given.error) };
  try {
    return { ok: true, output: tool.output.parse(await tool.run(session, given.data, reach)) };
  } catch (cause) {
    if (cause instanceof ToolRefusal) return { ok: false, refusal: cause.message };
    throw cause;
  }
};
