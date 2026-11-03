// WebMCP: a browser that offers in-page tools to an agent (a proposed standard) finds two read-only
// tools here. A browser without the standard ignores this file.

interface ModelContext {
  registerTool(tool: {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: { readOnlyHint: boolean };
    execute: (
      input: Record<string, unknown>,
    ) => Promise<{ content: { type: 'text'; text: string }[] }>;
  }): void;
}

// One slash, then letters, digits, dots, slashes and dashes: never a second slash, which would leave the site.
const PATH = /^\/(?!\/)[\w./-]*$/u;

const reply = (value: unknown): { content: { type: 'text'; text: string }[] } => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
});

/** Registers the tools when the browser has a model context. */
export const registerWebMcp = (): void => {
  const context = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
  if (context === undefined) return;
  try {
    context.registerTool({
      name: 'get_release_manifest',
      description:
        'Returns the manifest of the GAB dataset release: its version, its date and its open files with their checksums.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => reply(await (await fetch('/release/manifest.json')).json()),
    });
    context.registerTool({
      name: 'open_page',
      description:
        'Opens a page of this site by its path, for example /nodes/ or /method/. The path must start with one slash.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', pattern: PATH.source } },
        required: ['path'],
      },
      execute: (input) => {
        const path = typeof input['path'] === 'string' ? input['path'] : '';
        if (!PATH.test(path)) return Promise.resolve(reply({ error: 'Bad path.' }));
        location.assign(path);
        return Promise.resolve(reply({ opened: path }));
      },
    });
  } catch {
    // A browser that refuses the registration keeps the page as it is.
  }
};
