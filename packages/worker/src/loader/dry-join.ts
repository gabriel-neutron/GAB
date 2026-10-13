import { isLinkTable, mappingPayload, type LinkRows } from '@gab/proposal/mapping';
import { headerSignature } from '@gab/tools/header-signature';
import { readTablePage, tableOf } from '@gab/tools/table';
import type { Session } from '@gab/tools/tool';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { makeFinder, type Found } from './join.ts';

const MAPPING = `SELECT p.payload, p.src[1]::text AS document,
       public.mapping_text_set(p.id) AS text_set
  FROM public.proposals p WHERE p.id = $1::uuid AND p.op = 'map_document'`;

const mappingRow = z.array(
  z.object({ payload: z.unknown(), document: z.string(), text_set: z.string().nullable() }),
);

const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

const lineText = (fields: readonly string[]): string => `${fields.map(csvField).join(',')}\r\n`;

/** The words of what a lookup finds for one end of a relation. A relation joins only two ends
 * that a key finds. */
const endWords = (found: Found): [string, string, string] => {
  if (found.kind === 'one')
    return [found.key, found.id, found.key === 'label' ? 'by name only' : 'finds'];
  if (found.kind === 'many') return [found.key, '', `finds ${String(found.count)} entities`];
  return ['', '', 'not in the record'];
};

/** The dry join of a relation table: for each row, the key that finds each end. A row whose two
 * ends a key finds links them, and any other row goes to the report of the load. */
const linkJoin = async (
  db: Queryable,
  mappingId: string,
  document: string,
  textSet: string,
  table: ReturnType<typeof tableOf>,
  rows: LinkRows,
): Promise<string> => {
  const find = makeFinder(db, {}, table.header);
  let linked = 0;
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const fields = [String(index + 1)];
    let links = true;
    for (const end of [rows.src, rows.dst]) {
      const words = endWords(await find(record, end.lookup, end.entity_type));
      if (words[2] !== 'finds') links = false;
      fields.push(...words);
    }
    if (links) linked += 1;
    lines.push(lineText([...fields, links ? 'links' : 'goes to the report']));
  }
  return [
    lineText([
      `# dry join of mapping ${mappingId}; document ${document}; text set ${textSet}; ` +
        `rows ${String(table.rows.length)}; links ${String(linked)}; ` +
        `to the report ${String(table.rows.length - linked)}`,
    ]),
    lineText([
      'row',
      'src_key',
      'src_entity',
      'src_outcome',
      'dst_key',
      'dst_entity',
      'dst_outcome',
      'outcome',
    ]),
    ...lines,
  ].join('');
};

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

  const { rows } = mapping;
  if (isLinkTable(rows)) return linkJoin(db, mappingId, held.document, page.textSet, table, rows);

  const labelAt = table.header.indexOf(rows.label);
  const find = makeFinder(db, rows.attrs, table.header);
  const counts = { identifier: 0, label: 0, created: 0, many: 0 };
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const label = (record.fields[labelAt] ?? '').trim();
    const found = await find(record, rows.lookup, rows.entity_type);
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
