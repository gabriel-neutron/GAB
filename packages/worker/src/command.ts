/** One sub-command of the worker: it takes the words after its name and gives the exit code. */
export type SubCommand = (args: readonly string[]) => Promise<number>;

// Each sub-command loads only when it is picked, so a run of one opens no module of another.
const COMMANDS = {
  'author-names': async () => (await import('./author-names-command.ts')).authorNamesCommand,
  ingest: async () => (await import('./ingest-command.ts')).ingestCommand,
  layout: async () => (await import('./layout-command.ts')).layoutCommand,
  reconcile: async () => (await import('./reconcile-command.ts')).reconcileCommand,
  'reference-set': async () => (await import('./reference-set-command.ts')).referenceSetCommand,
  'reread-html': async () => (await import('./reread-command.ts')).rereadCommand,
  run: async () => (await import('./run-command.ts')).runCommand,
} as const satisfies Record<string, () => Promise<SubCommand>>;

type CommandName = keyof typeof COMMANDS;

const NAMES = Object.keys(COMMANDS);

const isName = (word: string): word is CommandName => Object.hasOwn(COMMANDS, word);

/** What the words of the command line ask for: one sub-command, or the usage text. */
type Command =
  | {
      readonly kind: 'command';
      readonly name: CommandName;
      readonly args: readonly string[];
      readonly load: () => Promise<SubCommand>;
    }
  | { readonly kind: 'usage'; readonly text: string };

export const readCommand = (words: readonly string[]): Command => {
  const [first, ...args] = words;
  if (first !== undefined && isName(first))
    return { kind: 'command', name: first, args, load: COMMANDS[first] };
  const asked =
    first === undefined ? 'No sub-command is given.' : `"${first}" is not a sub-command.`;
  return {
    kind: 'usage',
    text: `${asked} Usage: pnpm worker <${NAMES.join('|')}> [arguments]`,
  };
};
