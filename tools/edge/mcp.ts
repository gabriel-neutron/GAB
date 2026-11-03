// A small MCP server (Streamable HTTP, JSON replies, no session) for the open files of the release.
// It is read only and holds no state. Each tool answers from the manifest, so an agent that does
// not want to fetch a 25 MB file can still find the right file, its address and how to cite it.

import { z } from 'zod';

import { LICENCE_URL, type Release } from './pages.ts';

const PROTOCOL = '2025-06-18';
const PAGE = 5;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

interface Context {
  readonly site: string;
  readonly release: Release;
}

interface Tool {
  readonly title: string;
  readonly description: string;
  readonly input: z.ZodType;
  readonly schema: object;
  readonly run: (args: never, context: Context) => unknown;
}

const object = (properties: object, required: string[] = []): object => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const listInput = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().regex(/^\d+$/u).optional(),
});
const fileInput = z.object({ file: z.string().min(1) });
const citeInput = z.object({
  kind: z.enum(['dataset', 'claim', 'entity']),
  identifier: z
    .string()
    .regex(/^[\w.:~-]+$/u)
    .optional(),
});

export const TOOLS: Readonly<Record<string, Tool>> = {
  get_release_manifest: {
    title: 'Get the release manifest',
    description:
      'Returns the version and the date of the current GAB dataset release, the address of its manifest and the licence. Use it first, to know which snapshot you read.',
    input: z.object({}),
    schema: object({}),
    run: (_args, { site, release }) => ({
      version: release.version,
      date: release.date,
      manifest: `${site}release/manifest.json`,
      licence: LICENCE_URL,
      files: release.files.length,
    }),
  },
  list_release_files: {
    title: 'List the files of the release',
    description:
      'Lists the open files of the release (entities, relations, claims and more), five by default. Pass the nextCursor of a reply as cursor to read the next page.',
    input: listInput,
    schema: object({
      limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Files per page.' },
      cursor: { type: 'string', description: 'The nextCursor of the previous reply.' },
    }),
    run: (args: z.infer<typeof listInput>, { site, release }) => {
      const from = Number(args.cursor ?? '0');
      const size = args.limit ?? PAGE;
      const next = from + size;
      return {
        files: release.files
          .slice(from, next)
          .map((file) => ({ file, url: `${site}release/${file}` })),
        nextCursor: next < release.files.length ? String(next) : null,
      };
    },
  },
  get_file_url: {
    title: 'Get the address of one file',
    description:
      'Returns the address of one file of the release. The manifest lists the SHA-256 checksum of each file, so check the file that you download against it.',
    input: fileInput,
    schema: object(
      { file: { type: 'string', description: 'A name from list_release_files, as entities.csv.' } },
      ['file'],
    ),
    run: (args: z.infer<typeof fileInput>, { site, release }) => {
      if (!release.files.includes(args.file))
        throw new ToolFault(`No file named ${args.file}. Call list_release_files for the names.`);
      return { url: `${site}release/${args.file}`, manifest: `${site}release/manifest.json` };
    },
  },
  cite: {
    title: 'Get the citation of the dataset, a claim or an entity',
    description:
      'Returns the citation text and the permanent address to use when you quote the GAB dataset, one claim or one entity. Keep the label of a claim when you copy it.',
    input: citeInput,
    schema: object(
      {
        kind: { type: 'string', enum: ['dataset', 'claim', 'entity'] },
        identifier: { type: 'string', description: 'The identifier of the claim or the entity.' },
      },
      ['kind'],
    ),
    run: (args: z.infer<typeof citeInput>, { site, release }) => {
      if (args.kind !== 'dataset' && args.identifier === undefined)
        throw new ToolFault('Give the identifier of the claim or the entity.');
      const address =
        args.kind === 'dataset' ? site : `${site}${args.kind}/${args.identifier ?? ''}/`;
      return {
        address,
        citation: `GAB dataset, release ${release.version}, ${release.date}. ${address}`,
        note: 'A claim tells what its sources say. It is not proof. Licence: CC-BY 4.0.',
      };
    },
  },
};

class ToolFault extends Error {}

const reply = (id: unknown, result: unknown): object => ({ jsonrpc: '2.0', id, result });
const fault = (id: unknown, code: number, message: string): object => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

const requestShape = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const callTool = (params: Record<string, unknown> | undefined, context: Context): object => {
  const name = typeof params?.['name'] === 'string' ? params['name'] : '';
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : undefined;
  if (tool === undefined)
    return { isError: true, content: [{ type: 'text', text: `Unknown tool ${name}.` }] };
  const args = tool.input.safeParse(params?.['arguments'] ?? {});
  if (!args.success)
    return {
      isError: true,
      content: [{ type: 'text', text: `Invalid arguments: ${args.error.message}` }],
    };
  try {
    const result = tool.run(args.data as never, context);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ToolFault)
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    throw error;
  }
};

/** The answer to one JSON-RPC message, or null for a notification (the caller sends 202). */
export const handle = (message: unknown, context: Context): object | null => {
  const parsed = requestShape.safeParse(message);
  if (!parsed.success) return fault(null, -32600, 'Invalid request.');
  const { id, method, params } = parsed.data;
  if (id === undefined) return null;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'gab-dataset', title: 'GAB dataset', version: context.release.version },
        instructions:
          'Read only. Start with get_release_manifest, then list_release_files. No sign-in is needed.',
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, {
        tools: Object.entries(TOOLS).map(([name, tool]) => ({
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.schema,
          annotations: { title: tool.title, ...READ_ONLY },
        })),
      });
    case 'tools/call':
      return reply(id, callTool(params, context));
    default:
      return fault(id, -32601, `Method not found: ${method}.`);
  }
};

/** The server card of the draft MCP extension. */
export const serverCard = (site: string, release: Release): object => ({
  name: 'gab-dataset',
  title: 'GAB dataset',
  description:
    'Read only access to the manifest, the files and the citations of the GAB dataset: sourced claims about sanctions, trade and shipping.',
  version: release.version,
  websiteUrl: site,
  remotes: [{ type: 'streamable-http', url: `${site}mcp` }],
  capabilities: { tools: { listChanged: false } },
  authentication: { required: false },
});
