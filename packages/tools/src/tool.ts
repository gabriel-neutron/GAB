import type { RawObject } from '@gab/store';
import type { z } from 'zod';

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

/** One passage that an item cites: the words that code found in the page, and the words around
 * them. */
export interface CheckedPassage {
  readonly document: string;
  readonly page: number;
  readonly excerpt: string;
  readonly context: string;
}

/** One item that the propose tool is about to write, with the passages that state it. */
export interface ItemToCheck {
  readonly ref: string;
  readonly claim: { readonly act: unknown; readonly originator: string; readonly modality: string };
  readonly passages: readonly CheckedPassage[];
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
  /** A check of each item by a model of another family, before the write. It gives the refs of
   * the items that their passages support. Each other item is written as disputed. */
  readonly check?: (items: readonly ItemToCheck[]) => Promise<ReadonlySet<string>>;
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

const sentence = (error: z.ZodError): string =>
  error.issues
    .map((issue) =>
      issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ');

/** Runs a tool on a raw input. A refusal is an outcome, and a fault of the database is thrown. */
export const callTool = async (
  tool: Tool,
  session: Session,
  raw: unknown,
  reach?: Reach,
): Promise<ToolOutcome> => {
  const given = tool.input.safeParse(raw);
  if (!given.success) return { ok: false, refusal: sentence(given.error) };
  try {
    return { ok: true, output: tool.output.parse(await tool.run(session, given.data, reach)) };
  } catch (cause) {
    if (cause instanceof ToolRefusal) return { ok: false, refusal: cause.message };
    throw cause;
  }
};
