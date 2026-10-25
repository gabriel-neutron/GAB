import type { ObservationRows } from '@gab/proposal/mapping';
import type { CsvRecord } from '@gab/tools/csv';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { makeEndFinder } from './link.ts';

/** One code of the fixed area list (ADR 0030). */
export interface Area {
  readonly system: 'iso3166' | 'group';
  readonly code: string;
}

// External constraint: Eurostat writes two codes of a country that ISO 3166 writes otherwise, and
// its own codes for a group of countries.
const EUROSTAT_COUNTRY = new Map([
  ['EL', 'GR'],
  ['UK', 'GB'],
]);
const EUROSTAT_GROUP = new Map([
  ['EU27_2020', 'EU27'],
  ['EA20', 'EA20'],
  ['EA21', 'EA21'],
  ['EXT_EU27_2020', 'EXTRA_EU27'],
  ['TOTAL', 'WORLD'],
  ['NSP', 'OTHER'],
]);

const TWO_LETTERS = /^[A-Z]{2}$/u;

/** The area of a cell in a code list, or null when the list holds no such code. */
export const areaOf = (text: string, codes: ObservationRows['reporter']['codes']): Area | null => {
  if (codes === 'eurostat') {
    const group = EUROSTAT_GROUP.get(text);
    if (group !== undefined) return { system: 'group', code: group };
    const country = EUROSTAT_COUNTRY.get(text) ?? text;
    return TWO_LETTERS.test(country) ? { system: 'iso3166', code: country } : null;
  }
  return TWO_LETTERS.test(text) ? { system: 'iso3166', code: text } : null;
};

const PERIOD_SHAPE: Readonly<Record<ObservationRows['period']['length'], RegExp>> = {
  year: /^\d{4}$/u,
  quarter: /^\d{4}-Q[1-4]$/u,
  month: /^\d{4}-(0[1-9]|1[0-2])$/u,
  week: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/u,
};

// UN Comtrade writes a month as six digits.
const COMPACT_MONTH = /^(\d{4})(0[1-9]|1[0-2])$/u;

/** The period of a cell in its ISO form, or null when the cell is not a period of that length. */
export const periodOf = (
  text: string,
  length: ObservationRows['period']['length'],
): string | null => {
  if (PERIOD_SHAPE[length].test(text)) return text;
  const compact = length === 'month' ? COMPACT_MONTH.exec(text) : null;
  return compact === null ? null : `${compact[1] ?? ''}-${compact[2] ?? ''}`;
};

// A decimal number, with an optional exponent. A thousands separator is no number.
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/u;

/** One row as the door of a figure takes it, or the sentence that says why the row is no
 * figure. The value stays text, so the door reads the number that the file writes, digit for
 * digit. */
export type ObservationRow =
  { readonly row: Readonly<Record<string, string | number | null>> } | { readonly refused: string };

interface Cited {
  readonly textSet: string;
  readonly page: number;
}

/** The figure of one row under an observation mapping. `areas` holds the keys
 * `system:code` of the fixed area list. */
export const observationOf = async (
  rows: ObservationRows,
  record: CsvRecord,
  cell: (name: string) => string,
  context: {
    readonly areas: ReadonlySet<string>;
    readonly cited: Cited;
    readonly subjectOf: (record: CsvRecord) => Promise<string | { readonly refused: string }>;
  },
): Promise<ObservationRow> => {
  const valueText = cell(rows.value.column);
  const flag = rows.flag === undefined ? '' : cell(rows.flag);
  if (valueText === '')
    return {
      refused: `the value is empty` + (flag === '' ? '' : `, and the source marks it "${flag}"`),
    };
  if (!NUMBER.test(valueText)) return { refused: `the value "${valueText}" is not a number` };

  const unit = 'constant' in rows.unit ? rows.unit.constant : cell(rows.unit.column);
  if (unit === '') return { refused: 'the unit is empty' };
  if (unit.length > 40) return { refused: `the unit "${unit}" is longer than 40 characters` };

  const periodText = cell(rows.period.column);
  const period = periodOf(periodText, rows.period.length);
  if (period === null)
    return { refused: `"${periodText}" is not a period of one ${rows.period.length}` };

  const area = (
    side: 'reporter' | 'partner',
    held: ObservationRows['reporter'],
  ): Area | { refused: string } => {
    const text = cell(held.column);
    const found = text === '' ? null : areaOf(text, held.codes);
    if (found === null || !context.areas.has(`${found.system}:${found.code}`))
      return {
        refused:
          text === ''
            ? `the ${side} is empty`
            : `the ${side} "${text}" is not a code of the area list (${held.codes})`,
      };
    return found;
  };
  const reporter = area('reporter', rows.reporter);
  if ('refused' in reporter) return reporter;
  const partner = rows.partner === undefined ? null : area('partner', rows.partner);
  if (partner !== null && 'refused' in partner) return partner;

  const product = rows.product === undefined ? '' : cell(rows.product.column);
  if (rows.product !== undefined && product === '') return { refused: 'the product is empty' };
  if (product.length > 40)
    return { refused: `the product "${product}" is longer than 40 characters` };
  if (flag.length > 20) return { refused: `the mark "${flag}" is longer than 20 characters` };

  let subject: string | null = null;
  if (rows.subject !== undefined) {
    const found = await context.subjectOf(record);
    if (typeof found !== 'string') return found;
    subject = found;
  }

  return {
    row: {
      measure: rows.measure,
      value: valueText,
      value_text: valueText,
      unit,
      period,
      period_text: periodText,
      method: rows.method,
      licence: rows.licence,
      reporter_system: reporter.system,
      reporter: reporter.code,
      partner_system: partner?.system ?? null,
      partner: partner?.code ?? null,
      product_system: rows.product?.system ?? null,
      product: rows.product === undefined ? null : product,
      subject_id: subject,
      flag: flag === '' ? null : flag,
      text_extractor: context.cited.textSet,
      page: context.cited.page,
      start: record.start,
      end: record.end,
    },
  };
};

const AREAS = 'SELECT system, code FROM api.area_code';

const areaRow = z.array(z.object({ system: z.string(), code: z.string() }));

const PUT =
  'SELECT item, outcome, held_value::text AS held FROM public.put_observations($1::uuid, $2::jsonb)';

const putRow = z.array(
  z.object({
    item: z.number().int(),
    outcome: z.enum(['written', 'held', 'other_value']),
    held: z.string().nullable(),
  }),
);

// External constraint: a door words its own refusals with this code.
const DOOR_REFUSED = '22023';

// Origin of the number: decided, not calibrated. One call of the door for each row would take
// minutes for a table of Eurostat, and a batch of this size is one statement of a few seconds.
const BATCH = 2_000;

/** One line of the report of a load. */
export interface ReportLine {
  readonly row: number;
  readonly page: number;
  readonly start: number;
  readonly end: number;
  readonly reason: string;
}

/** The load of an observation table: code reads each row under the promoted mapping, and the door
 * writes each figure (ADR 0030). A row that gives no figure goes to the report. */
export const loadObservations = async (
  db: Queryable,
  input: {
    readonly job: string;
    readonly rows: ObservationRows;
    readonly header: readonly string[];
    readonly records: readonly CsvRecord[];
    readonly cited: Cited;
  },
): Promise<{ loaded: number; excluded: number; lines: ReportLine[] }> => {
  const { rows, header, records, cited } = input;
  const areas = new Set(
    areaRow.parse((await db.query(AREAS)).rows).map((one) => `${one.system}:${one.code}`),
  );
  const column = new Map(header.map((name, index) => [name, index] as const));
  const findEnd = makeEndFinder(db, header);
  const subjectOf = async (record: CsvRecord): Promise<string | { refused: string }> => {
    if (rows.subject === undefined) return { refused: 'the mapping names no subject' };
    const found = await findEnd(record, rows.subject);
    if (found.kind === 'one' && found.key !== 'label') return found.id;
    return {
      refused:
        found.kind === 'none'
          ? 'the subject is not in the record'
          : found.kind === 'many'
            ? `the lookup of the subject by ${found.key} finds ${String(found.count)} entities`
            : `the subject finds entity ${found.id} by its name only`,
    };
  };

  const lines: ReportLine[] = [];
  let loaded = 0;
  let excluded = 0;
  const pending: { readonly at: ReportLine; readonly row: ObservationRow & { row: object } }[] = [];

  const exclude = (at: ReportLine, reason: string): void => {
    excluded += 1;
    lines.push({ ...at, reason });
  };

  const put = async (batch: readonly (typeof pending)[number][]): Promise<void> => {
    if (batch.length === 0) return;
    let answer: z.infer<typeof putRow>;
    try {
      answer = putRow.parse(
        (await db.query(PUT, [input.job, JSON.stringify(batch.map((one) => one.row.row))])).rows,
      );
    } catch (cause) {
      const refused = cause instanceof Error && 'code' in cause && cause.code === DOOR_REFUSED;
      if (!refused) throw cause;
      // The door writes a batch or nothing. One row alone finds the row that it refuses.
      if (batch.length > 1) {
        for (const one of batch) await put([one]);
        return;
      }
      const [one] = batch;
      if (one !== undefined) exclude(one.at, cause.message);
      return;
    }
    for (const { item, outcome, held } of answer) {
      const one = batch[item - 1];
      if (one === undefined) throw new Error(`the door answered for row ${String(item)} of none`);
      if (outcome === 'other_value')
        exclude(
          one.at,
          `an earlier row of this file gives the same figure with the value ${held ?? ''}`,
        );
      else loaded += 1;
    }
  };

  for (const [index, record] of records.entries()) {
    const at: ReportLine = {
      row: index + 1,
      page: cited.page,
      start: record.start,
      end: record.end,
      reason: '',
    };
    if (record.fields.length !== header.length) {
      exclude(
        at,
        `the row holds ${String(record.fields.length)} fields, and the header holds ` +
          String(header.length),
      );
      continue;
    }
    const cell = (name: string): string => (record.fields[column.get(name) ?? -1] ?? '').trim();
    const made = await observationOf(rows, record, cell, { areas, cited, subjectOf });
    if ('refused' in made) {
      exclude(at, made.refused);
      continue;
    }
    pending.push({ at, row: made });
    if (pending.length >= BATCH) await put(pending.splice(0));
  }
  await put(pending.splice(0));
  return { loaded, excluded, lines };
};
