import { readFileSync } from 'node:fs';
import { setTimeout as sleepFor } from 'node:timers/promises';

import { openrouterModel } from '@gab/model';
import { Client } from 'pg';

import { agentAddress, appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import {
  approveReferenceSet,
  buildReferenceSet,
  loadReferenceSet,
  readReferenceSet,
  type ReferenceRow,
} from './rater/reference-set.ts';
import { readRaterConfig } from './reader-config.ts';

const USAGE = 'Usage: pnpm worker reference-set <build|load <file>|show|approve>';

const print = (rows: readonly ReferenceRow[]): void => {
  for (const one of rows) {
    const party = one.party ? ' (party)' : '';
    const controller = one.controller === null ? '' : ` [controller: ${one.controller}]`;
    const state = one.approved ? 'approved' : 'not approved';
    console.log(`${one.letter}  ${one.name_key}${party}${controller}  ${state}\n   ${one.reason}`);
  }
  console.log(`${String(rows.length)} authors.`);
};

/** Runs the work in one transaction: the set is stored whole or not at all. */
const whole = async (
  app: Client,
  work: () => Promise<readonly ReferenceRow[]>,
): Promise<readonly ReferenceRow[]> => {
  await app.query('BEGIN');
  try {
    const stored = await work();
    await app.query('COMMIT');
    return stored;
  } catch (fault) {
    await app.query('ROLLBACK');
    throw fault;
  }
};

/** The reference set of the rated authors. `build` asks the model once and stores the set with the
 * reason of each letter. `load` stores a set that experts wrote in a file, with no model. `show`
 * prints it. `approve` makes it usable. The operator reads it between the two. */
export const referenceSetCommand: SubCommand = async (args) => {
  const [step, file] = args;
  if (
    (step !== 'build' && step !== 'load' && step !== 'show' && step !== 'approve') ||
    (step === 'load') !== (file !== undefined)
  ) {
    console.error(USAGE);
    return 2;
  }

  const app = new Client({ connectionString: appAddress() });
  await app.connect();
  try {
    if (step === 'show') {
      print(await readReferenceSet(app));
      return 0;
    }
    if (step === 'approve') {
      const approved = await approveReferenceSet(app);
      console.log(`The reference set is approved: ${String(approved)} authors became usable.`);
      return 0;
    }

    if (step === 'load' && file !== undefined) {
      const text = readFileSync(file, 'utf8');
      print(await whole(app, () => loadReferenceSet(app, text)));
      console.log('Read the set. Then run: pnpm worker reference-set approve');
      return 0;
    }

    const config = readRaterConfig(process.env);
    const agent = new Client({ connectionString: agentAddress() });
    await agent.connect();
    try {
      const prompt = readFileSync(new URL('./rater/reference-prompt.md', import.meta.url), 'utf8');
      const stored = await whole(app, () =>
        buildReferenceSet({
          agent,
          app,
          config,
          language: openrouterModel(config.model.model),
          prompt,
          sleep: (ms) => sleepFor(ms),
          now: () => performance.now(),
        }),
      );
      print(stored);
      console.log('Read the set. Then run: pnpm worker reference-set approve');
    } finally {
      await agent.end();
    }
    return 0;
  } finally {
    await app.end();
  }
};
