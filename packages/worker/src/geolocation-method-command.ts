import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { fillGeolocationMethods, methodReportLines } from './geolocation-method.ts';

const USAGE = 'Usage: pnpm worker geolocation-method [--dry-run]';

/** Gives the method of geolocation to each stored place that holds `not_stated` and whose
 * documents state a method clearly. It changes no other place and deletes nothing. It gives 2 for
 * a usage fault. */
export const geolocationMethodCommand: SubCommand = async (args) => {
  const unknown = args.filter((word) => word !== '--dry-run');
  if (unknown.length > 0) {
    console.error(`"${unknown.join(' ')}" is not an argument of geolocation-method.`);
    console.error(USAGE);
    return 2;
  }

  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  let report;
  try {
    report = await fillGeolocationMethods(client, args.includes('--dry-run'));
  } finally {
    await client.end();
  }

  for (const line of methodReportLines(report)) console.log(line);
  return 0;
};
