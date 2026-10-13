import { mappingPayload } from '@gab/proposal/mapping';
import { headerSignature } from '@gab/tools/header-signature';
import { readTablePage, tableOf } from '@gab/tools/table';
import type { Session } from '@gab/tools/tool';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { makeFinder } from './join.ts';

const MAPPING = `SELECT p.payload, p.src[1]::text AS document,
       public.mapping_text_set(p.id) AS text_set
  FROM public.proposals p WHERE p.id = $1::uuid AND p.op = 'map_document'`;

const mappingRow = z.array(
  z.object({ payload: z.unknown(), document: z.string(), text_set: z.string().nullable() }),
);

const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

/** The dry join of a mapping: for each row of its table, the key that finds the entity of the
 * row in the record, or the sentence that the row creates one. It reads the record through the
 * same lookup as the load, it calls no model, and it writes nothing. The mapping can wait for its
 * promotion, so the operator reads the join before a load. The answer is a CSV text. */
export const dryJoin = async (db: Queryable, mappingId: string): Promise<string> => {
  const [held] = mappingRow.parse((await db.query(MAPPING, [mappingId])).rows);
  if (held === undefined) throw new Error(`${mappingId} is not a mapping`);
  const read = mappingPayload.safeParse(held.payload);
  if (!read.success) throw new Error(`the mapping ${mappingId} does not read as a mapping`);
  const mapping = read.data;

  const session: Session = { query: (text, values) => db.query(text, values) };
  const page = await readTablePage(session, held.document, held.text_set);
  const table = tableOf(page.text);
  if (headerSignature(table.header) !== mapping.header_sig)
    throw new Error(
      `the header of document ${held.document} is not the header of mapping ${mappingId}`,
    );

  const labelAt = table.header.indexOf(mapping.rows.label);
  const find = makeFinder(db, mapping, table.header);
  const counts = { identifier: 0, label: 0, created: 0, many: 0 };
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const label = (record.fields[labelAt] ?? '').trim();
    const found = await find(record, mapping.rows.lookup);
    let fields: [string, string, string];
    if (found.kind === 'one') {
      const byName = found.key === 'label';
      counts[byName ? 'label' : 'identifier'] += 1;
      fields = [found.key, found.id, byName ? 'finds by name only' : 'finds'];
    } else if (found.kind === 'many') {
      counts.many += 1;
      fields = [found.key, '', `finds ${String(found.count)} entities`];
    } else {
      counts.created += 1;
      fields = ['', '', 'creates'];
    }
    lines.push([String(index + 1), label, ...fields].map(csvField).join(','));
  }

  return [
    `# dry join of mapping ${mappingId}; document ${held.document}; text set ${page.textSet}; ` +
      `rows ${String(table.rows.length)}; by identifier ${String(counts.identifier)}; ` +
      `by name only ${String(counts.label)}; creates ${String(counts.created)}; ` +
      `more than one ${String(counts.many)}`,
    'row,label,key,entity,outcome',
    ...lines,
  ]
    .map((line) => `${line}\r\n`)
    .join('');
};
