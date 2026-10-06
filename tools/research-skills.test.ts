// The research workspace states each research procedure once, as a skill. A skill that names a tool
// the research profile does not offer sends the model to a tool it cannot call, and a Codex copy
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

const SKILLS = ['investigate-node', 'cite-claim', 'ingest-batch', 'carto-step'] as const;

const frontMatter = z.object({ name: z.string().min(1), description: z.string().trim().min(1) });

const sourceOf = (skill: string): string => path.join(CLAUDE_SKILLS, skill, 'SKILL.md');
const copyOf = (skill: string): string => path.join(CODEX_SKILLS, skill, 'SKILL.md');

const read = (file: string): string => readFileSync(file, 'utf8');

const shown = (file: string): string => path.relative(ROOT, file).split(path.sep).join('/');

// The YAML block between the two opening fences, and the text after it.
const split = (text: string): { head: unknown; body: string } => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(text);
  if (match === null) throw new Error('the file does not start with a YAML front matter block');
  return { head: parse(match[1] ?? ''), body: match[2] ?? '' };
};

// The text of one level-two section, up to the next level-two heading.
const section = (body: string, heading: string): string | undefined => {
  const parts = body.split(/^## /mu);
  const found = parts.find(
    (part) => part.startsWith(`${heading}\n`) || part.startsWith(`${heading}\r\n`),
  );
  return found?.slice(heading.length);
};

// Each line of the Tools section starts with the name of one tool, and a name can be one word.
const listedTools = (text: string): string[] =>
  [...text.matchAll(/^- `([a-z][a-z0-9_]*)`/gmu)].map((match) => match[1] ?? '');

const codeNames = (text: string): string[] =>
  [...text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/gu)].map((match) => match[1] ?? '');

// Departure: the compile target of this folder does not hold the tool package, and a static import
// would pull the whole catalogue into it. The test loads the profiles when it runs, and checks
// their shape, so a wrong shape fails here and not as a silent empty set.
const profilesModule = z.object({
  PROFILES: z
    .record(z.string(), z.array(z.string()))
    .and(z.object({ research: z.array(z.string()) })),
});

const { PROFILES } = profilesModule.parse(
  await import(pathToFileURL(path.join(ROOT, 'packages', 'tools', 'src', 'profiles.ts')).href),
);

// The research MCP server offers each tool of its groups, so a skill may name a tool that a group
// offers and the profile does not hold, such as the entity lookup that the profile left out.
const groupsModule = z.object({ RESEARCH_GROUPS: z.record(z.string(), z.array(z.string())) });

const { RESEARCH_GROUPS } = groupsModule.parse(
  await import(pathToFileURL(path.join(ROOT, 'packages', 'mcp', 'src', 'groups.ts')).href),
);

const RESEARCH = new Set([...PROFILES.research, ...Object.values(RESEARCH_GROUPS).flat()]);
const EVERY_PROFILE_TOOL = new Set(Object.values(PROFILES).flat());

test.each(SKILLS)('the skill %s has a source file', (skill) => {
  expect(existsSync(sourceOf(skill)), `${shown(sourceOf(skill))} is absent`).toBe(true);
});

test.each(SKILLS)('the front matter of %s names the skill and describes it', (skill) => {
  const { head } = split(read(sourceOf(skill)));
  const parsed = frontMatter.parse(head);

  expect(parsed.name).toBe(skill);
});

test.each(SKILLS)('the skill %s has the sections Tools, Steps and Never', (skill) => {
  const { body } = split(read(sourceOf(skill)));

  for (const heading of ['Tools', 'Steps', 'Never'])
    expect(section(body, heading), `${skill} has no section "## ${heading}"`).toBeDefined();
});

test.each(SKILLS)('each tool under the Tools section of %s is in the research profile', (skill) => {
  const { body } = split(read(sourceOf(skill)));
  const tools = listedTools(section(body, 'Tools') ?? '');

  expect(tools.length, `${skill} names no tool under "## Tools"`).toBeGreaterThan(0);
  for (const tool of tools)
    expect(
      RESEARCH.has(tool),
      `${skill} lists ${tool}, which the research surface does not offer`,
    ).toBe(true);
});

test.each(SKILLS)(
  'each profile tool that %s names anywhere is in the research profile',
  (skill) => {
    const { body } = split(read(sourceOf(skill)));

    for (const tool of codeNames(body).filter((name) => EVERY_PROFILE_TOOL.has(name)))
      expect(
        RESEARCH.has(tool),
        `${skill} names ${tool}, which the research surface does not offer`,
      ).toBe(true);
  },
);

test.each(SKILLS)('the Codex copy of %s is the same bytes as its Claude source', (skill) => {
  const source = sourceOf(skill);
  const copy = copyOf(skill);

  expect(existsSync(copy), `${shown(copy)} is absent. Copy ${shown(source)} over it.`).toBe(true);
  expect(
    readFileSync(copy).equals(readFileSync(source)),
    `${shown(copy)} differs from its source ${shown(source)}. Copy the source over it.`,
  ).toBe(true);
});
