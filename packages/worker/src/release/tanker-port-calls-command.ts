import { readFile, writeFile } from 'node:fs/promises';

import { Client } from 'pg';
import { z } from 'zod';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { csvFile } from './csv-file.ts';
import { readReleaseRecord } from './release-record.ts';
import { inOneSnapshot, statementTimeout } from './snapshot.ts';
import {
  comparisonLines,
  csvHeader,
  csvRow,
  DATA_END,
  idsOfImo,
  LIMITS,
  checkData,
  portCallsOf,
  tankerListHeader,
  tankerListRows,
  tankerPeriods,
  tankerSet,
  type PortCall,
  type StoredAnswer,
} from './tanker-port-calls.ts';

const USAGE =
  'Usage: pnpm worker tanker-port-calls <mapping.csv> [values.csv] [--tankers <list.csv>]';

// Departure: the role waits a short time for one statement, and the read holds the text of each
// stored GFW answer. GAB_STATEMENT_TIMEOUT sets another value. The command runs by hand.
const READ_TIMEOUT = '10min';

// External constraint: the address of the stored answers of the GFW Events API for port visits,
// as the tools `vessel_events` and `gfw_port_visits` write it. The text extractor is the one of
// the store step of the tools.
const GFW_EVENTS = 'https://gateway.api.globalfishingwatch.org/v3/events?%port-visits-events%';
const EXTRACTOR = 'text-1';

const TEXTS = `SELECT d.id::text AS id, d.uri, string_agg(t.text, '' ORDER BY t.page) AS text
                 FROM public.documents d
                 JOIN public.document_text t ON t.document_id = d.id
                WHERE d.uri LIKE $1 AND t.extractor = $2
                GROUP BY d.id, d.uri ORDER BY d.id`;
const textRow = z.object({ id: z.string(), uri: z.string(), text: z.string() });

/** Rebuilds the values of the figure of the port calls of the designated oil tankers from
 * the graph and the stored GFW documents, prints them next to the previous values and the limits,
 * and writes the CSV of the values when a file is given. The mapping file gives the GFW vessel
 * ids of each IMO number. It writes nothing to the database. It gives 1 for a data fault and 2
 * for a usage fault. */
export const tankerPortCallsCommand: SubCommand = async (args) => {
  // The option --tankers writes the list of the counted tankers: imo,name,vessel_id.
  const at = args.indexOf('--tankers');
  const listFile = at < 0 ? undefined : args[at + 1];
  const plain = at < 0 ? args : args.filter((_, index) => index !== at && index !== at + 1);
  const [mapping, out, ...rest] = plain;
  if (mapping === undefined || rest.length > 0 || (at >= 0 && listFile === undefined)) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  try {
    const ids = idsOfImo(await readFile(mapping, 'utf8'));
    await client.connect();
    await client.query(`SET statement_timeout = '${statementTimeout(READ_TIMEOUT)}'`);
    const { tankers, calls, answers, rows } = await inOneSnapshot(client, async () => {
      const record = await readReleaseRecord(client, { natoPair: false });
      const set = tankerSet(record);
      const rows = z
        .array(textRow)
        .parse((await client.query(TEXTS, [GFW_EVENTS, EXTRACTOR])).rows);
      const all: PortCall[] = [];
      const stored: StoredAnswer[] = [];
      for (const row of rows) {
        const read = portCallsOf(row.text, row.id);
        all.push(...read.calls);
        stored.push({
          document: row.id,
          uri: row.uri,
          vessels: read.vessels,
          nextOffset: read.nextOffset,
        });
      }
      return { tankers: set, calls: all, answers: stored, rows: tankerListRows(record, set, ids) };
    });
    const withoutId = checkData(tankers, ids, answers);
    const periods = tankerPeriods(tankers, ids, calls);
    console.log(
      `Tankers of the set: ${String(tankers.length)} (${String(withoutId)} with no GFW vessel id).`,
    );
    console.log(`Port calls read: ${String(calls.length)}. Data end: ${DATA_END}.`);
    console.log(['period', 'counted', ...csvHeader.slice(2)].join('\t'));
    for (const period of periods) console.log(csvRow(period).join('\t'));
    console.log('');
    for (const line of comparisonLines(periods)) console.log(line);
    console.log('');
    console.log('Limits:');
    for (const limit of LIMITS) console.log(`- ${limit}`);
    if (out !== undefined) {
      const preamble = [
        `Port calls of the designated oil tankers, rebuilt from the graph and the stored GFW port visits. Tankers: ${String(tankers.length)}. Data end: ${DATA_END}.`,
        'Limits:',
        ...LIMITS.map((one) => `- ${one}`),
      ].join('\n');
      await writeFile(out, csvFile(preamble, csvHeader, periods.map(csvRow)));
      console.log(`Wrote ${out}.`);
    }
    if (listFile !== undefined) {
      await writeFile(listFile, csvFile('', tankerListHeader, rows));
      console.log(`Wrote ${listFile}.`);
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The rebuild failed.');
    return 1;
  } finally {
    await client.end();
  }
};
