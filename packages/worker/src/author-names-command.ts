import { Client } from 'pg';

import { appAddress } from './address.ts';
import {
  decideName,
  dryRunLines,
  dryRunNames,
  moveName,
  readWaitingNames,
  rerateName,
  waitingLines,
} from './author-names.ts';
import type { SubCommand } from './command.ts';

const USAGE =
  'Usage: pnpm worker author-names ' +
  '<list|dry-run|confirm <name>|refuse <name>|move <name> <author>|rerate <name>>';

/** The names that joined an author A or B and wait for the operator. `list` prints them, `dry-run`
 * prints the units that each decision would change, and `confirm` or `refuse` decides one name.
 * `move` gives a name of a wrong author that the worker rated to an approved reference author or to
 * another author that the worker rated. The name and the author are two arguments, each in quotes,
 * because each name can hold a space or a comma. `rerate` takes a name away from a wrong author
 * that the worker rated, and the rater rates it again. */
export const authorNamesCommand: SubCommand = async (args) => {
  const [step, ...rest] = args;
  const name = rest.join(' ').trim();
  const decides = step === 'confirm' || step === 'refuse' || step === 'rerate';
  const moves = step === 'move';
  const [moved = '', author = ''] = moves ? rest.map((one) => one.trim()) : [];
  if (
    (step !== 'list' && step !== 'dry-run' && !decides && !moves) ||
    (decides && name === '') ||
    (moves && (rest.length !== 2 || moved === '' || author === '')) ||
    (!decides && !moves && rest.length > 0)
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
    if (moves) {
      const units = await moveName(app, moved, author);
      console.log(
        `The name "${moved}" is a name of "${author}" now. ` +
          `The rules read ${String(units)} units again.`,
      );
      return 0;
    }
    if (step === 'rerate') {
      const units = await rerateName(app, name);
      console.log(
        `The name "${name}" has no author now, and the rater rates it again. ` +
          `The rules read ${String(units)} units again.`,
      );
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
