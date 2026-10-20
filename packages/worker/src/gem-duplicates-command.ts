import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { gemDuplicates } from './loader/gem-duplicates.ts';

const USAGE =
  'Usage: pnpm worker gem-duplicates. It prints, as lines of text, the pairs of one entity with a ' +
  'GEM unit key and one without it, near and with a similar name. A dossier entity with no point pairs on the name alone, and its metres show "no point". It writes nothing in the record.';

/** The report of the candidate duplicates of a GEM load. It gives 2 for a usage fault. */
export const gemDuplicatesCommand: SubCommand = async (args) => {
  if (args.length > 0) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const pairs = await gemDuplicates(client);
    console.log(
      `# ${String(pairs.length)} candidate pairs: gem_id, dossier_id, type, metres, names`,
    );
    for (const p of pairs)
      console.log(
        `${p.gemId}\t${p.dossierId}\t${p.type}\t${p.metres === null ? 'no point' : String(p.metres)}\t${p.gemLabel}\t${p.dossierLabel}`,
      );
    return 0;
  } finally {
    await client.end();
  }
};
