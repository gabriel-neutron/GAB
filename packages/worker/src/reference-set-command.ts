import { readFileSync } from 'node:fs';
import { setTimeout as sleepFor } from 'node:timers/promises';

import { openrouterModel } from '@gab/model';
import { Client } from 'pg';

import { agentAddress, appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import {
  addReferenceAuthors,
  approveReferenceSet,
  buildReferenceSet,
  fillReferenceSites,
  loadReferenceSet,
  readReferenceSet,
  ReferenceSetRefusal,
  type ReferenceRow,
} from './rater/reference-set.ts';
import { readRaterConfig } from './reader-config.ts';

const USAGE =
  'Usage: pnpm worker reference-set <build|load <file>|add <file>|sites <file>|show|approve>';

const print = (rows: readonly ReferenceRow[]): void => {
  for (const one of rows) {
    const party = one.party ? ' (party)' : '';
    const controller = one.controller === null ? '' : ` [controller: ${one.controller}]`;
    const state = one.approved ? 'approved' : 'not approved';
    const sites = one.sites.length === 0 ? 'no site' : one.sites.join(', ');
    console.log(
      `${one.letter}  ${one.name_key}${party}${controller}  ${state}\n   ${one.reason}\n   sites: ${sites}`,
    );
  }
  console.log(`${String(rows.length)} authors.`);
};

/** Runs the work in one transaction: the set is stored whole or not at all. */
const whole = async <T>(app: Client, work: () => Promise<T>): Promise<T> => {
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
 * reason of each letter. `load` stores a set that experts wrote in a file, with no model. `add`
 * stores the authors of such a file that the set does not hold, and keeps the others. `sites`
 * gives the sites of a file to each author of a stored set that has none. `show` prints it.
 * `approve` makes it usable. The operator reads it between the two. */
export const referenceSetCommand: SubCommand = async (args) => {
  const [step, file] = args;
  const withFile = step === 'load' || step === 'add' || step === 'sites';
  if (
    (step !== 'build' && !withFile && step !== 'show' && step !== 'approve') ||
    withFile !== (file !== undefined)
  ) {
    console.error(USAGE);
    return 2;
  }

  let text = '';
  if (withFile && file !== undefined) {
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      console.error(`Cannot read the file: ${file}`);
      return 1;
    }
    try {
      JSON.parse(text);
    } catch {
      console.error(`The file is not valid JSON: ${file}`);
      return 1;
    }
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

    if (step === 'sites') {
      const done = await whole(app, () => fillReferenceSites(app, text));
      print(done.set);
      for (const one of done.sites) console.log(`${one.said}  ${one.name}`);
      return 0;
    }

    if (step === 'add') {
      try {
        const done = await whole(app, () =>
          addReferenceAuthors(app, text, new Date().toISOString().slice(0, 10)),
        );
        print(done.set);
        for (const one of done.added) {
          console.log(`${one.said}  ${one.name}`);
          for (const field of one.differs) console.log(`   the record keeps its ${field}`);
        }
        const stored = done.added.filter((one) => one.said === 'stored').length;
        console.log(
          stored === 0
            ? 'The set holds each author of the file already. Nothing is stored.'
            : `${String(stored)} authors are stored. Read them. Then run: pnpm worker reference-set approve`,
        );
        return 0;
      } catch (fault) {
        // A refusal is a sentence for the operator, not a stack trace.
        if (
          fault instanceof ReferenceSetRefusal ||
          (fault instanceof Error && 'code' in fault && String(fault.code).startsWith('22'))
        ) {
          console.error(fault.message);
          return 1;
        }
        throw fault;
      }
    }

    if (step === 'load') {
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
