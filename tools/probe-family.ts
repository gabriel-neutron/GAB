// The family probe. A free gateway can send two model names to one backend, so two readers that
// look independent can be one model. The probe asks both pinned models the same fixed prompts, with
// answers that a model picks freely, and counts the answers that match. The door reads the
// threshold row and records the run: with no row, no probe passes. It runs as gabriel_app.

import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { openBudget, openModel, type AgentModel } from '@gab/model';
import { Client } from 'pg';
import { z } from 'zod';

import { readReader2, readReaderConfig } from '../packages/worker/src/reader-config.ts';
import { connectionString } from './db-runtime.ts';
import type { Ask } from './probe.ts';

const promptSet = z.object({
  version: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1),
});

export type PromptSet = z.infer<typeof promptSet>;

/** The fixed prompt set, with its version. A new prompt set is a new version of the file. */
export const PROMPT_SET: PromptSet = promptSet.parse(
  JSON.parse(readFileSync(new URL('./family-probe-prompts.json', import.meta.url), 'utf8')),
);

const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Two answers match when they are the same words, with case and punctuation ignored. An answer
 * that is absent matches nothing. */
export const answersMatch = (left: string | null, right: string | null): boolean =>
  left !== null && right !== null && fold(left) !== '' && fold(left) === fold(right);

/** The count of the prompts whose two answers match. */
export const countMatches = (
  left: readonly (string | null)[],
  right: readonly (string | null)[],
): number => left.filter((answer, index) => answersMatch(answer, right[index] ?? null)).length;

const answerShape = z.object({ answer: z.string() });

// The prompt holds no stored text, so it holds no personal data, and no minimiser runs on it.
const askAll = async (settings: AgentModel, prompts: readonly string[]) => {
  const model = openModel(settings);
  const answers: (string | null)[] = [];
  for (const prompt of prompts) {
    const answer = await model.ask({
      messages: [
        { role: 'system', content: 'Answer as JSON: {"answer": "<your answer>"}.' },
        { role: 'user', content: prompt },
      ],
      shape: answerShape,
      budget: openBudget(2_000),
    });
    answers.push(answer.ok && 'value' in answer ? answer.value.answer : null);
  }
  return answers;
};

const passedRow = z.array(z.object({ passed: z.boolean() })).length(1);

/** Records one probe run through the door, and returns whether it passed. */
export const recordProbe = async (
  ask: Ask,
  run: { modelA: string; modelB: string; prompts: number; matches: number },
): Promise<boolean> => {
  const [row] = passedRow.parse(
    await ask('SELECT public.record_family_probe($1, $2, $3, $4, $5) AS passed', [
      PROMPT_SET.version,
      run.modelA,
      run.modelB,
      run.prompts,
      run.matches,
    ]),
  );
  return row?.passed ?? false;
};

const main = async (): Promise<void> => {
  const first = readReaderConfig('EXTRACTOR', process.env);
  const second = readReader2(process.env, first);
  const left = await askAll(first.model, PROMPT_SET.prompts);
  const right = await askAll(second.model, PROMPT_SET.prompts);
  const matches = countMatches(left, right);
  const client = new Client({ connectionString: connectionString('app') });
  await client.connect();
  try {
    const passed = await recordProbe(
      async (text, values) =>
        (
          await client.query<Record<string, unknown>>(
            text,
            values === undefined ? undefined : [...values],
          )
        ).rows,
      {
        modelA: first.model.model,
        modelB: second.model.model,
        prompts: PROMPT_SET.prompts.length,
        matches,
      },
    );
    console.log(
      `${passed ? 'passed' : 'failed'}: ${String(matches)} of ${String(PROMPT_SET.prompts.length)} answers match`,
    );
    if (!passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
