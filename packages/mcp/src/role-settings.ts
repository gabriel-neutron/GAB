// What a worker of each role gets from the CLI: its built-in tools, its shell commands, its strict MCP
// file, its turn cap and its first words. The server holds the gab tools of each role (roles.ts), and
// these settings are the same list seen from the client.
//
// shortcut: a role with a shell can run any program that node starts, and Windows gives this user no
// sandbox. The commands of its allow list, its empty database address and the deny rules bound it, and
// only the closing check and the reviewer see what it did. Upgrade with a separate Windows account.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROLES, WORKER_ROLES, type Role } from './roles.ts';

interface RoleSettings {
  readonly builtin: readonly string[];
  readonly bash: readonly string[];
  // Origin of the numbers: the last wave ended each worker under 300 turns. A closer and a panel do
  // less work, so they get less. Decided, not calibrated.
  readonly turns: number;
  /** A closer has no project settings, so only this file gives it a tool or a rule. Another role
   * needs the skills and the agents of its project, and --tools still hides each other built-in tool. */
  readonly restricted: boolean;
  readonly home: 'research' | 'room' | 'checkout';
  readonly words: string;
}

const NO_SECRET = [
  'Read(//**/research/.env)',
  'Read(//**/infra/.env)',
  'Bash(*research/.env*)',
  'Bash(*infra*.env*)',
];
const NO_REWRITE = [
  'Bash(git push --force:*)',
  'Bash(git checkout main:*)',
  'Bash(git reset --hard:*)',
  'Bash(gh repo:*)',
  'Bash(rm -rf:*)',
  'Bash(docker:*)',
];
const NO_WRITE_OF_GIT = ['Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git merge:*)'];
const READS = ['Read', 'Glob', 'Grep'];

const VERDICT =
  'Your last line is the fixed JSON that this message ends with. The result is "close" only when ' +
  'you flag nothing, and then gaps is empty. When you flag one item or more, the result is ' +
  '"reopen", and gaps holds one string for each item, which starts with its id and says what is ' +
  'wrong. The result is "stop_source" only when the standard tells you to stop the source. No ' +
  'other word closes a ticket, and your line closes it with no other check.';

const FACT_CLOSER = `You are a fact closer of the tenfold wave. No person reads this run. Do not ask a question. You get the standard, the ids and a seed, and no notes of the worker that proposed. You read and search, and you store nothing.

For each item that the ticket names:
1. Open its cited passage with read_unit, and read the page with document_text. For a list file, use find_line. Test the words of the passage against the fact, one by one. A passage that does not state the fact is a flag, also when the words are in the document.
2. Test the fact against the question of the ticket. A fact that does not answer it is a flag.
3. Check each person. A natural person is out of scope unless a sanctions act designates that person, so a person with no designated_by relation is a flag. A personal address, telephone or e-mail is a flag.
4. Check each host. Read the address of each cited document with find_document, and call read_page on that address. A refusal for the deny list is a flag. You read a live page only through read_page.
5. Try to refute the fact with web_search and news_search. A search with no result refutes nothing, and it is no flag.

${VERDICT}`;

const BUILD_CLOSER = `You are a build closer of the tenfold wave. No person reads this run. Do not ask a question. You get the closing check of the ticket and a seed, and no notes of the coder.

Make a new git worktree of the merged commit from the checkout that this message names, install it with pnpm, and run \`pnpm stack:up\` in it. Run the closing check there, in the test stack, and run \`pnpm stack:down\` at the end. Each fault test runs in the test stack. You never touch the real record, a live setting of the PC or a host on the deny list. You read a live page only through read_page. A file that the check names comes as a read-only copy in the folder that this message names. You change no code, and you commit nothing.

${VERDICT}`;

const ROLE_SETTINGS: Readonly<Record<Role, RoleSettings>> = {
  proposer: {
    builtin: [...READS, 'Agent', 'Skill'],
    bash: [],
    turns: 300,
    restricted: false,
    home: 'research',
    words:
      'You are a proposer of the tenfold wave. Read AGENTS.md of this folder first. You propose, and you never decide. Tell the supervisor your result, because a new reviewer decides.',
  },
  reviewer: {
    builtin: [...READS, 'Skill'],
    bash: [],
    turns: 200,
    restricted: false,
    home: 'research',
    words:
      'You are a reviewer of the tenfold wave. Read AGENTS.md of this folder and the skill review-unit first. You decide from the sources, and you never propose.',
  },
  fact_closer: {
    builtin: READS,
    bash: [],
    turns: 150,
    restricted: true,
    home: 'room',
    words: FACT_CLOSER,
  },
  build_closer: {
    builtin: [...READS, 'Bash'],
    bash: ['Bash(git:*)', 'Bash(pnpm:*)', 'Bash(node:*)'],
    turns: 200,
    restricted: true,
    home: 'room',
    words: BUILD_CLOSER,
  },
  panel: {
    builtin: [...READS, 'Agent', 'Skill', 'WebSearch', 'WebFetch'],
    bash: [],
    turns: 100,
    restricted: false,
    home: 'checkout',
    words:
      'You are a panel worker of the tenfold wave. Run the skill expert-panel on the question of the ticket. Your result is "pass" only when the panel agrees, and it names the verdict in its reason. You store nothing and you decide no unit.',
  },
  coder: {
    builtin: [...READS, 'Write', 'Edit', 'Agent', 'Skill', 'Bash'],
    bash: ['Bash(git:*)', 'Bash(gh:*)', 'Bash(pnpm:*)', 'Bash(node:*)'],
    turns: 300,
    restricted: false,
    home: 'checkout',
    words:
      'You are a coder of the tenfold wave. Read CLAUDE.md first. You work in a new git worktree and its test stack, and you never touch the real record.',
  },
};

/** The names of the tools that a worker of this role can see, as the CLI names them. */
export const toolsOfRole = (role: Role): readonly string[] => [
  ...ROLE_SETTINGS[role].builtin,
  ...WORKER_ROLES[role].map((tool) => `mcp__gab__${tool}`),
];

/** The arguments of one worker. Each list closes what the others leave open: --tools hides a built-in
 * tool, dontAsk refuses all that the allow list does not name, and the strict file names one server. */
export const roleArgs = (role: Role, mcpFile: string, model: string): readonly string[] => {
  const { builtin, bash, turns, restricted } = ROLE_SETTINGS[role];
  const allowed = toolsOfRole(role).filter((tool) => tool !== 'Bash');
  const deny = [
    ...NO_SECRET,
    ...(bash.length === 0 ? [] : NO_REWRITE),
    ...(role === 'build_closer' ? NO_WRITE_OF_GIT : []),
  ];
  return [
    '-p',
    '--model',
    model,
    ...(restricted ? ['--restricted'] : ['--setting-sources', 'project']),
    '--tools',
    builtin.join(','),
    '--strict-mcp-config',
    '--mcp-config',
    mcpFile,
    '--allowedTools',
    [...allowed, ...bash].join(','),
    '--disallowedTools',
    deny.join(','),
    '--permission-mode',
    'dontAsk',
    '--max-turns',
    String(turns),
    '--output-format',
    'stream-json',
    '--verbose',
  ];
};

export interface RoleEntry {
  readonly args: readonly string[];
  readonly prompt: string;
  readonly workDir: string;
  readonly env: Readonly<Record<string, string>>;
}

/** Writes the strict MCP file of each role in the state folder, and gives the entry of each role for
 * the settings of the tick. A role with no gab tool gets a file with no server. */
export const writeRoles = (
  state: string,
  gabUrl: string,
  checkout: string,
  model: string,
): Record<Role, RoleEntry> => {
  const folder = join(state, 'roles');
  const room = join(folder, 'room');
  mkdirSync(room, { recursive: true });
  const homes = { research: join(checkout, 'research'), room, checkout };
  const entries = ROLES.map((role) => {
    const file = join(folder, `${role}.mcp.json`);
    const servers =
      WORKER_ROLES[role].length === 0
        ? {}
        : { gab: { type: 'http', url: `${gabUrl}/mcp/${role}` } };
    writeFileSync(file, JSON.stringify({ mcpServers: servers }));
    const settings = ROLE_SETTINGS[role];
    const entry: RoleEntry = {
      args: roleArgs(role, file, model),
      prompt:
        role === 'build_closer' ? `${settings.words}\n\nThe checkout: ${checkout}` : settings.words,
      workDir: homes[settings.home],
      // A worker with a shell gets no address of the record in its environment.
      env: settings.bash.length === 0 ? {} : { GAB_RESEARCH_DATABASE_URL: '' },
    };
    return [role, entry] as const;
  });
  return Object.fromEntries(entries) as Record<Role, RoleEntry>;
};
