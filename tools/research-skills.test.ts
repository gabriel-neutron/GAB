// The research workspace states each research procedure once, as a skill. A skill that names a tool
// the research MCP server does not offer sends the model to a tool it cannot call, and a Codex copy
// that differs from its Claude source gives the two clients two procedures. The test reads text
// and opens no socket.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLAUDE_SKILLS = path.join(ROOT, 'research', '.claude', 'skills');
const CODEX_SKILLS = path.join(ROOT, 'research', '.agents', 'skills');

const SKILLS = [
  'research-method',
  'investigate-node',
  'cite-claim',
  'ingest-batch',
  'carto-step',
] as const;

const frontMatter = z.object({ name: z.string().min(1), description: z.string().trim().min(1) });

const sourceOf = (skill: string): string => path.join(CLAUDE_SKILLS, skill, 'SKILL.md');
const copyOf = (skill: string): string => path.join(CODEX_SKILLS, skill, 'SKILL.md');

const read = (file: string): string => readFileSync(file, 'utf8');

const shown = (file: string): string => path.relative(ROOT, file).split(path.sep).join('/');

// The YAML block between the two opening fences.
const headOf = (text: string): unknown => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(text);
  if (match === null) throw new Error('the file does not start with a YAML front matter block');
  return parse(match[1] ?? '');
};

// Departure: the compile target of this folder does not hold the MCP package, and a static import
// would pull the whole catalogue into it. The test loads the surface when it runs, and checks its
// shape, so a wrong shape fails here and not as a silent empty set.
const surfaceModule = z.object({
  RESEARCH_TOOLS: z.record(z.string(), z.object({ readOnlyHint: z.boolean() })),
});

const { RESEARCH_TOOLS } = surfaceModule.parse(
  await import(pathToFileURL(path.join(ROOT, 'packages', 'mcp', 'src', 'surface.ts')).href),
);

const RESEARCH = new Set(Object.keys(RESEARCH_TOOLS));

// A name in back quotes with an underscore is a tool, unless it is one of these words of the
// record that a skill shows as an example.
const RECORD_WORDS = new Set([
  'legal_act',
  'capacity_dwt',
  'state_body',
  'registration_number',
  'tax_id',
]);

const namedTools = (text: string): string[] =>
  [...text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/gu)]
    .map((match) => match[1] ?? '')
    .filter((name) => !RECORD_WORDS.has(name));

const RULES = path.join(ROOT, 'research', 'AGENTS.md');

test.each(SKILLS)('the skill %s has a source file', (skill) => {
  expect(existsSync(sourceOf(skill)), `${shown(sourceOf(skill))} is absent`).toBe(true);
});

test.each(SKILLS)('the front matter of %s names the skill and describes it', (skill) => {
  const parsed = frontMatter.parse(headOf(read(sourceOf(skill))));

  expect(parsed.name).toBe(skill);
});

test.each([...SKILLS.map(sourceOf), RULES])('each tool that %s names is offered', (file) => {
  for (const tool of namedTools(read(file)))
    expect(
      RESEARCH.has(tool),
      `${shown(file)} names ${tool}, which the server does not offer`,
    ).toBe(true);
});

test('the rules of the workspace name each tool of the server', () => {
  const named = new Set(namedTools(read(RULES)));
  for (const tool of RESEARCH)
    if (tool.includes('_')) expect(named.has(tool), `AGENTS.md does not name ${tool}`).toBe(true);
});

// The research session writes with no question (P12): each proposal waits in the review queue,
// and the operator decides it there. The two tools that spend model credit still ask the operator
// first. The schema is strict, so a second key (a permission mode, a hook, an extra directory)
// fails here.
const ASKS_FIRST = new Set(['enqueue_extract', 'start_lead']);

test('the Claude Code settings allow each tool of the server, except the two that spend credit', () => {
  const settings = z
    .strictObject({ permissions: z.strictObject({ allow: z.array(z.string()) }) })
    .parse(JSON.parse(read(path.join(ROOT, 'research', '.claude', 'settings.json'))));
  const allowed = [...RESEARCH]
    .filter((name) => !ASKS_FIRST.has(name))
    .map((name) => `mcp__gab__${name}`);
  expect([...settings.permissions.allow].sort()).toStrictEqual(allowed.sort());
});

test.each(SKILLS)('the Codex copy of %s is the same bytes as its Claude source', (skill) => {
  const source = sourceOf(skill);
  const copy = copyOf(skill);

  expect(existsSync(copy), `${shown(copy)} is absent. Copy ${shown(source)} over it.`).toBe(true);
  expect(
    readFileSync(copy).equals(readFileSync(source)),
    `${shown(copy)} differs from its source ${shown(source)}. Copy the source over it.`,
  ).toBe(true);
});
