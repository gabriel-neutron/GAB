import {
  isLinkTable,
  isObservationTable,
  mappingPayload,
  type LinkRows,
  type ObservationRows,
} from '@gab/proposal/mapping';
import { headerSignature } from '@gab/tools/header-signature';
import { readTablePage, tableOf } from '@gab/tools/table';
import type { Session } from '@gab/tools/tool';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { makeFinder } from './join.ts';
import { castAll, daysOf, foundWords, makeEndFinder, resolveEnd } from './link.ts';
import { observationOf } from './observation.ts';

const MAPPING = `SELECT p.payload, p.src[1]::text AS document,
       public.mapping_text_set(p.id) AS text_set
  FROM public.proposals p WHERE p.id = $1::uuid AND p.op = 'map_document'`;

const mappingRow = z.array(
  z.object({ payload: z.unknown(), document: z.string(), text_set: z.string().nullable() }),
);

const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

const lineText = (fields: readonly string[]): string => `${fields.map(csvField).join(',')}\r\n`;

/** The dry join of a relation table: for each row, the key that finds each end. A row whose two
 * ends a key finds, whose attributes cast and whose days read links them, and any other row goes
 * to the report of the load. The checks are the checks of the load. */
const linkJoin = async (
  db: Queryable,
  mappingId: string,
  document: string,
  textSet: string,
  table: ReturnType<typeof tableOf>,
  rows: LinkRows,
): Promise<string> => {
  const find = makeEndFinder(db, table.header);
  const column = new Map(table.header.map((name, index) => [name, index] as const));
  let linked = 0;
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const cell = (name: string): string => (record.fields[column.get(name) ?? -1] ?? '').trim();
    const fields = [String(index + 1)];
    let links = record.fields.length === table.header.length;
    for (const [side, end] of [
      ['src', rows.src],
      ['dst', rows.dst],
    ] as const) {
      const one = await resolveEnd(find, record, cell, side, end);
      if (one.refused !== null) links = false;
      fields.push(
        ...(one.found === null
          ? ['', '', one.refused === null ? '' : one.refused.replace(/^relation not loaded: /u, '')]
          : foundWords(one.found, 'not in the record')),
      );
    }
    if (links) {
      const cast = castAll(rows.attrs, cell, () => undefined);
      const dated = daysOf(cell, rows.valid_from, rows.valid_to);
      if ('refused' in cast || 'refused' in dated) links = false;
    }
    if (links) linked += 1;
    lines.push(lineText([...fields, links ? 'links' : 'goes to the report']));
  }
  // The summary line is a comment, so it is written raw: a comma or a quote in a name must not
  // put the whole line in quotes.
  return [
    `# dry join of mapping ${mappingId}; document ${document}; text set ${textSet}; ` +
      `rows ${String(table.rows.length)}; links ${String(linked)}; ` +
      `to the report ${String(table.rows.length - linked)}\r\n`,
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

const AREAS = 'SELECT system, code FROM api.area_code';

const areaRow = z.array(z.object({ system: z.string(), code: z.string() }));

/** The dry run of an observation table: for each row, the figure that the load writes, or the
 * sentence that sends the row to the report. The checks are the checks of the load, and the door
 * of a figure is not called. */
const observationJoin = async (
  db: Queryable,
  mappingId: string,
  document: string,
  page: { readonly textSet: string; readonly page: number },
  table: ReturnType<typeof tableOf>,
  rows: ObservationRows,
): Promise<string> => {
  const areas = new Set(
    areaRow.parse((await db.query(AREAS)).rows).map((one) => `${one.system}:${one.code}`),
  );
  const findEnd = makeEndFinder(db, table.header);
  const column = new Map(table.header.map((name, index) => [name, index] as const));
  const subjectOf = async (record: (typeof table.rows)[number]) => {
    if (rows.subject === undefined) return { refused: 'the mapping names no subject' };
    const found = await findEnd(record, rows.subject);
    return found.kind === 'one' && found.key !== 'label'
      ? found.id
      : { refused: 'the subject is not one entity that an identifier finds' };
  };
  let figures = 0;
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const cell = (name: string): string => (record.fields[column.get(name) ?? -1] ?? '').trim();
    const made =
      record.fields.length === table.header.length
        ? await observationOf(rows, record, cell, { areas, cited: page, subjectOf })
        : { refused: 'the row does not hold the fields of the header' };
    if ('refused' in made) {
      lines.push(lineText([String(index + 1), '', '', '', '', '', made.refused]));
      continue;
    }
    figures += 1;
    const { row } = made;
    const word = (name: string): string => {
      const value = row[name];
      return value === null || value === undefined ? '' : String(value);
    };
    lines.push(
      lineText([
        String(index + 1),
        word('period'),
        word('reporter'),
        word('partner'),
        word('product'),
        `${word('value')} ${word('unit')}`,
        'figure',
      ]),
    );
  }
  return [
    `# dry run of mapping ${mappingId}; document ${document}; text set ${page.textSet}; ` +
      `rows ${String(table.rows.length)}; figures ${String(figures)}; ` +
      `to the report ${String(table.rows.length - figures)}\r\n`,
    lineText(['row', 'period', 'reporter', 'partner', 'product', 'value', 'outcome']),
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
  const table = tableOf(page.text, page.format);
  if (headerSignature(table.header) !== mapping.header_sig)
    throw new Error(
      `the header of document ${held.document} is not the header of mapping ${mappingId}`,
    );

  const { rows } = mapping;
  if (isObservationTable(rows))
    return observationJoin(db, mappingId, held.document, page, table, rows);
  if (isLinkTable(rows)) return linkJoin(db, mappingId, held.document, page.textSet, table, rows);

  const labelAt = table.header.indexOf(rows.label);
  const find = makeFinder(db, rows.attrs, table.header);
  const counts = { identifier: 0, label: 0, created: 0, many: 0 };
  const lines: string[] = [];
  for (const [index, record] of table.rows.entries()) {
    const label = (record.fields[labelAt] ?? '').trim();
    const found = await find(record, rows.lookup, rows.entity_type);
    const fields = foundWords(found, 'creates');
    if (found.kind === 'one') counts[found.key === 'label' ? 'label' : 'identifier'] += 1;
    else if (found.kind === 'many') counts.many += 1;
    else counts.created += 1;
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
