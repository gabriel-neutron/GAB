import { readFile } from 'node:fs/promises';

import { Client } from 'pg';
import { z } from 'zod';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { imoList, imoOf, imoPattern, modalityLines, OWNS_QUERY } from './relation-modality.ts';
import { inOneSnapshot } from './snapshot.ts';

const USAGE = 'Usage: pnpm worker relation-modality <imo-list.csv>';

const ownsRow = z.object({
  imo: z.string(),
  vessel: z.string(),
  owner: z.string(),
  relation: z.string(),
  originator: z.string().nullable(),
  modalities: z.array(z.string()),
  sources: z.array(z.string()),
});

/** Report: prints, for each `owns` relation of the listed vessels, the IMO number, the vessel, the
 * owner, the relation, the modality of its citations, the originator and the source documents.
 * It writes nothing to the database. It gives 1 for a data fault and 2 for a usage fault. */
export const relationModalityCommand: SubCommand = async (args) => {
  const [file, ...rest] = args;
  if (file === undefined || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  try {
    const imos = imoList(await readFile(file, 'utf8'));
    await client.connect();
    const found = await inOneSnapshot(client, async () =>
      z.array(ownsRow).parse((await client.query(OWNS_QUERY, [imos.map(imoPattern)])).rows),
    );
    const rows = found.flatMap((one) => {
      const imo = imoOf(one.imo);
      return imo === undefined ? [] : [{ ...one, imo }];
    });
    console.log(
      ['imo', 'vessel', 'owner', 'relation', 'modality', 'originator', 'sources'].join('\t'),
    );
    for (const line of modalityLines(imos, rows)) console.log(line);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The read failed.');
    return 1;
  } finally {
    await client.end();
  }
};
