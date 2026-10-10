import { Client } from 'pg';

import { appAddress } from './address.ts';
import {
  decideName,
  dryRunLines,
  dryRunNames,
  readWaitingNames,
  waitingLines,
} from './author-names.ts';
import type { SubCommand } from './command.ts';

const USAGE = 'Usage: pnpm worker author-names <list|dry-run|confirm <name>|refuse <name>>';

/** The names that joined an author A or B and wait for the operator. `list` prints them, `dry-run`
 * prints the units that each decision would change, and `confirm` or `refuse` decides one name. */
export const authorNamesCommand: SubCommand = async (args) => {
  const [step, ...rest] = args;
  const name = rest.join(' ').trim();
  const decides = step === 'confirm' || step === 'refuse';
  if (
    (step !== 'list' && step !== 'dry-run' && !decides) ||
    decides !== (name !== '') ||
    (!decides && rest.length > 0)
  ) {
    console.error(USAGE);
    return 2;
  }

  // The operator role holds the doors of a decision on a name, and no machine role does.
  const app = new Client({ connectionString: appAddress() });
  await app.connect();
  try {
    if (step === 'list') {
      for (const line of waitingLines(await readWaitingNames(app))) console.log(line);
      return 0;
    }
    if (step === 'dry-run') {
      for (const line of dryRunLines(await dryRunNames(app))) console.log(line);
      return 0;
    }
    const units = await decideName(app, name, step === 'confirm');
    console.log(
      `The name "${name}" is ${step === 'confirm' ? 'confirmed' : 'refused'}. ` +
        `The rules read ${String(units)} units again.`,
    );
    return 0;
  } catch (fault) {
    // A refusal of the door is a sentence for the operator, not a stack trace.
    if (fault instanceof Error && 'code' in fault && String(fault.code).startsWith('22')) {
      console.error(fault.message);
      return 1;
    }
    throw fault;
  } finally {
    await app.end();
  }
};
