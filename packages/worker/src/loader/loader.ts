import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { identifierContainment } from '@gab/proposal/identifiers';
import { machineAct } from '@gab/proposal/machine';
import { mappingPayload, type LookupKey, type MappingPayload } from '@gab/proposal/mapping';
import { writeRequest } from '@gab/proposal/request';
import type { RawObject } from '@gab/store';
import { headerSignature, type CsvRecord } from '@gab/tools/csv';
import { readTablePage, tableOf } from '@gab/tools/table';
import { ToolRefusal, type Session } from '@gab/tools/tool';
import { z } from 'zod';

import { JobStop, type AgentContext, type AgentResult, type RunnerAgent } from '../agents.ts';
import type { Queryable } from '../queryable.ts';
import { castCell, dayOf } from './cast.ts';

const LOADER_NAME = 'loader';
const VERSION = 'v1';
const REPORT_MIME = 'text/csv';

const NOT_IN_GRAPH = 'relation not loaded: the other end is not in the record';

interface LoaderOptions {
  /** Writes the bytes of the report, and returns the key that names them. */
  readonly store: { put(object: RawObject): Promise<string> };
}

// The fixed order of the lookup. An identifier that a list shares with the record finds a hull
// before a name does, and a name alone is the last way.
const FIRST_KEYS: readonly LookupKey[] = ['imo', 'opensanctions_id'];

const MAPPING = `SELECT payload, model_call_id::text AS model_call_id
  FROM public.proposals WHERE id = $1::uuid AND op = 'map_document'`;

const mappingRow = z.array(z.object({ payload: z.unknown(), model_call_id: z.uuid() }));

const BY_IDENTIFIER = `SELECT id::text AS id FROM api.entity
  WHERE attrs @> ANY($1::jsonb[]) ORDER BY id LIMIT 20`;

const BY_LABEL = `SELECT id::text AS id FROM api.entity
  WHERE type = $1::text AND lower(label) = lower($2::text) ORDER BY id LIMIT 20`;

const idRows = z.array(z.object({ id: z.uuid() }));

const BATCH = 'SELECT item FROM public.propose_batch($1::jsonb)';

const REPORT = `SELECT public.put_load_report($1::uuid, $2::text, $3::text, $4::text, $5::text)`;

// External constraint: a door words its own refusals with this code.
const DOOR_REFUSED = '22023';

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

/** One line of the report: a row that was excluded, or a note on a row that was loaded. */
interface Line {
  readonly row: number;
  readonly page: number;
  readonly start: number;
  readonly end: number;
  readonly reason: string;
}

const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

/** The counts of a load, with the names that make its bytes its own. */
interface Totals {
  readonly document: string;
  readonly mapping: string;
  readonly job: string;
  readonly read: number;
  readonly loaded: number;
  readonly excluded: number;
}

/** The report of a load as CSV. The first line names the load and gives its counts, so two loads
 * never share bytes, and the lines after it name each row in row order. */
export const reportOf = (totals: Totals, lines: readonly Line[]): string =>
  [
    `# document ${totals.document}; mapping ${totals.mapping}; job ${totals.job}; ` +
      `read ${String(totals.read)}; loaded ${String(totals.loaded)}; ` +
      `excluded ${String(totals.excluded)}`,
    'row,page,start,end,reason',
    ...[...lines]
      .sort((left, right) => left.row - right.row)
      .map((line) =>
        [line.row, line.page, line.start, line.end]
          .map(String)
          .concat(csvField(line.reason))
          .join(','),
      ),
  ]
    .map((line) => `${line}\r\n`)
    .join('');

type Found =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly id: string }
  | { readonly kind: 'many'; readonly key: string; readonly count: number };

/** The lookups of a mapping in the order that code tries them: the two first keys, then each
 * other identifier in the order of the mapping, then the name. */
export const lookupOrder = <T extends { readonly key: LookupKey }>(given: readonly T[]): T[] => [
  ...FIRST_KEYS.flatMap((key) => given.filter((one) => one.key === key)),
  ...given.filter((one) => !FIRST_KEYS.includes(one.key) && one.key !== 'label'),
  ...given.filter((one) => one.key === 'label'),
];

const ENTITY_ATTRS = 'SELECT attrs FROM api.entity WHERE id = $1::uuid';

const SAME_RELATION = `SELECT 1 AS held FROM api.relation
  WHERE coalesce(proposed_type, type) = $1::text AND src_id = $2::uuid AND dst_id = $3::uuid
    AND valid_from IS NOT DISTINCT FROM $4::date AND valid_to IS NOT DISTINCT FROM $5::date
  LIMIT 1`;

const attrsRow = z.array(
  z.object({
    attrs: z.record(z.string(), z.object({ v: z.unknown(), src: z.array(z.string()).optional() })),
  }),
);

/** True when the entity holds each of these values already, and already cites this document for
 * each one. A value that another document states is corroboration, so it is not a no-op. */
const holdsEach = async (
  db: Queryable,
  entity: string,
  document: string,
  attrs: Readonly<Record<string, { readonly v: unknown }>>,
): Promise<boolean> => {
  const [held] = attrsRow.parse((await db.query(ENTITY_ATTRS, [entity])).rows);
  return Object.entries(attrs).every(
    ([key, value]) =>
      isDeepStrictEqual(held?.attrs[key]?.v, value.v) &&
      (held?.attrs[key]?.src ?? []).includes(document),
  );
};

/** True when the record holds a relation of this type between these ends and these days. */
const isLinked = async (
  db: Queryable,
  type: string,
  src: string,
  dst: string,
  days: { readonly validFrom?: string; readonly validTo?: string },
): Promise<boolean> =>
  (await db.query(SAME_RELATION, [type, src, dst, days.validFrom ?? null, days.validTo ?? null]))
    .rows.length > 0;

const lookedUp = async (
  db: Queryable,
  entityType: string,
  lookup: { readonly key: LookupKey; readonly column: string },
  value: string,
): Promise<string[]> => {
  const { rows } =
    lookup.key === 'label'
      ? await db.query(BY_LABEL, [entityType, value])
      : await db.query(BY_IDENTIFIER, [
          identifierContainment(lookup.key, value).map((shape) => JSON.stringify(shape)),
        ]);
  return idRows.parse(rows).map((held) => held.id);
};

/** The loader reads every row under the promoted mapping, and it calls no model. Each row is one
 * batch of the one door of a machine, and the span of the row is its citation. A row that does
 * not fit gives one line of the report. */
export const makeLoader = (options: LoaderOptions): RunnerAgent => {
  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'load_mapped') throw new JobStop(`the loader runs no job of ${job.kind}`);
    const document = job.documentId;
    const session: Session = { query: (text, values) => context.db.query(text, values) };

    const [held] = mappingRow.parse((await context.db.query(MAPPING, [job.mappingId])).rows);
    const read = mappingPayload.safeParse(held?.payload);
    if (held === undefined || !read.success)
      throw new JobStop(`the mapping ${job.mappingId} does not read as a mapping`);
    const mapping: MappingPayload = read.data;

    let page: Awaited<ReturnType<typeof readTablePage>>;
    let table: ReturnType<typeof tableOf>;
    try {
      page = await readTablePage(session, document);
      table = tableOf(page.text);
    } catch (cause) {
      if (cause instanceof ToolRefusal) throw new JobStop(cause.message);
      throw cause;
    }
    if (headerSignature(table.header) !== mapping.header_sig)
      throw new JobStop(
        `the header of document ${document} is not the header of mapping ${job.mappingId}`,
      );

    const column = new Map(table.header.map((name, index) => [name, index] as const));
    const lines: Line[] = [];
    let loaded = 0;
    let excluded = 0;

    const find = async (
      record: CsvRecord,
      given: readonly { readonly key: LookupKey; readonly column: string }[],
    ): Promise<Found> => {
      for (const one of lookupOrder(given)) {
        const value = (record.fields[column.get(one.column) ?? -1] ?? '').trim();
        if (value === '') continue;
        const ids = await lookedUp(context.db, mapping.rows.entity_type, one, value);
        const [first] = ids;
        if (ids.length > 1) return { kind: 'many', key: one.key, count: ids.length };
        if (first !== undefined) return { kind: 'one', id: first };
      }
      return { kind: 'none' };
    };

    // A refusal of the door names the item and the rule, and it ends the row. Any other fault
    // is not a fact about the row, so it stops the job.
    const propose = async (items: readonly unknown[]): Promise<string | null> => {
      try {
        await context.db.query(BATCH, [JSON.stringify(items)]);
        return null;
      } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === DOOR_REFUSED)
          return cause.message;
        throw cause;
      }
    };

    const loadRow = async (record: CsvRecord, row: number): Promise<void> => {
      const where = { row, page: page.page, start: record.start, end: record.end };
      const unfit = (reason: string): void => {
        excluded += 1;
        lines.push({ ...where, reason });
      };
      if (record.fields.length !== table.header.length) {
        unfit(
          `the row holds ${String(record.fields.length)} fields, and the header holds ` +
            String(table.header.length),
        );
        return;
      }
      const cell = (name: string): string => (record.fields[column.get(name) ?? -1] ?? '').trim();

      const label = cell(mapping.rows.label);
      if (label === '') {
        unfit(`the required field "${mapping.rows.label}" is empty`);
        return;
      }

      const attrs: Record<string, { v: string | number | boolean | string[] }> = {};
      for (const [key, rule] of Object.entries(mapping.rows.attrs)) {
        const text = cell(rule.column);
        if (text === '') continue;
        const cast = castCell(rule.cast, key, text);
        if (!cast.ok) {
          unfit(`the column "${rule.column}": ${cast.reason}`);
          return;
        }
        attrs[key] = { v: cast.value };
      }

      let geom: unknown;
      const place = mapping.rows.geom;
      if (place !== undefined) {
        if ('geojson' in place) {
          const text = cell(place.geojson);
          if (text !== '') {
            try {
              geom = JSON.parse(text);
            } catch {
              unfit(`the column "${place.geojson}" holds no GeoJSON`);
              return;
            }
          }
        } else {
          const [lon, lat] = [cell(place.lon), cell(place.lat)];
          if ((lon === '') !== (lat === '')) {
            unfit('the geometry has one ordinate and not the other');
            return;
          }
          if (lon !== '') geom = { type: 'Point', coordinates: [Number(lon), Number(lat)] };
        }
      }

      const found = await find(record, mapping.rows.lookup);
      if (found.kind === 'many') {
        unfit(`the lookup by ${found.key} finds ${String(found.count)} entities`);
        return;
      }
      const hasAttrs = Object.keys(attrs).length > 0;
      if (found.kind === 'one' && !hasAttrs) {
        unfit(`the row finds entity ${found.id} and adds no attribute`);
        return;
      }

      // The entity of the row has the identifier that its act is given, so a relation of the row
      // can name it before the operator promotes it.
      const rowId = found.kind === 'one' ? found.id : randomUUID();
      const acts: { ref: string; request: unknown }[] = [];
      // An update that changes no value is not proposed. A load that follows the promotion of an
      // earlier load then adds no act of no effect.
      if (found.kind === 'none')
        acts.push({
          ref: 'row',
          request: {
            op: 'create_entity',
            type: mapping.rows.entity_type,
            label,
            ...(geom === undefined ? {} : { geom }),
            ...(hasAttrs ? { attrs } : {}),
          },
        });
      else if (!(await holdsEach(context.db, found.id, document, attrs)))
        acts.push({
          ref: 'row',
          request: { op: 'update_attrs', targetKind: 'entity', targetId: found.id, attrs },
        });

      for (const relation of mapping.relations) {
        const note = (reason: string): void => {
          lines.push({ ...where, reason });
        };
        if (cell(relation.other.column) === '') continue;
        const end = await find(record, [relation.other]);
        if (end.kind === 'none') {
          note(NOT_IN_GRAPH);
          continue;
        }
        if (end.kind === 'many') {
          note(`relation not loaded: the lookup by ${end.key} finds ${String(end.count)} entities`);
          continue;
        }
        const days: { validFrom?: string; validTo?: string } = {};
        let undated: string | null = null;
        for (const [name, rule] of [
          ['validFrom', relation.valid_from],
          ['validTo', relation.valid_to],
        ] as const) {
          if (rule === undefined || cell(rule.column) === '') continue;
          const day = dayOf(cell(rule.column), rule.pattern);
          if (day === null) undated = `"${cell(rule.column)}" is not a day as ${rule.pattern}`;
          else days[name] = day;
        }
        if (undated !== null) {
          note(`relation not loaded: ${undated}`);
          continue;
        }
        const [srcId, dstId] = relation.row_is === 'src' ? [rowId, end.id] : [end.id, rowId];
        if (found.kind === 'one' && (await isLinked(context.db, relation.type, srcId, dstId, days)))
          continue;
        acts.push({
          ref: 'relation',
          request: { op: 'create_relation', type: relation.type, srcId, dstId, ...days },
        });
      }

      // A row with nothing to write has been loaded before, and it counts as loaded.
      if (acts.length === 0) {
        loaded += 1;
        return;
      }

      // The span of the row is the citation of each act of the row. Code reads it from the page,
      // and no model quotes it.
      const items = [];
      for (const act of acts) {
        const request = writeRequest.safeParse(act.request);
        if (!request.success) {
          unfit(request.error.issues.map((issue) => issue.message).join('; '));
          return;
        }
        const made = machineAct(request.data, [document]);
        items.push({
          id: act.ref === 'row' && found.kind === 'none' ? rowId : randomUUID(),
          op: made.op,
          payload: made.payload,
          src: made.src,
          target_kind: made.targetKind,
          target_id: made.targetId,
          names: made.names,
          dissent: false,
          model_call_id: held.model_call_id,
          originator: mapping.table,
          modality: mapping.modality,
          citations: [
            {
              document,
              text_extractor: page.textSet,
              page: page.page,
              start: record.start,
              end: record.end,
            },
          ],
        });
      }
      const refused = await propose(items);
      if (refused !== null) {
        unfit(refused);
        return;
      }
      loaded += 1;
    };

    for (const [index, record] of table.rows.entries()) await loadRow(record, index + 1);

    if (loaded + excluded !== table.rows.length)
      throw new JobStop('the rows loaded and excluded do not add up to the rows read');

    const text = reportOf(
      {
        document,
        mapping: job.mappingId,
        job: job.id,
        read: table.rows.length,
        loaded,
        excluded,
      },
      lines,
    );
    const bytes = new TextEncoder().encode(text);
    const digest = sha256(bytes);
    const key = await options.store.put({ key: `raw/${digest}`, bytes, mime: REPORT_MIME });
    const title =
      `Load report of ${document} under mapping ${job.mappingId}: ${String(table.rows.length)} ` +
      `rows read, ${String(loaded)} loaded, ${String(excluded)} excluded`;
    await context.db.query(REPORT, [job.id, title, key, digest, REPORT_MIME]);
    return { refusals: [] };
  };

  return {
    name: LOADER_NAME,
    version: VERSION,
    kind: 'load_mapped',
    // Code runs each row, so no question is asked. The runner opens a budget for each job, and a
    // budget needs a cap above zero.
    models: [],
    tokenCap: 1,
    run,
  };
};
