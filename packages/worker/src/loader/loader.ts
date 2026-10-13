import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { machineAct } from '@gab/proposal/machine';
import {
  isLinkTable,
  mappingPayload,
  type Cast,
  type LinkRows,
  type MappingPayload,
} from '@gab/proposal/mapping';
import { writeRequest } from '@gab/proposal/request';
import type { RawObject } from '@gab/store';
import type { CsvRecord } from '@gab/tools/csv';
import { headerSignature } from '@gab/tools/header-signature';
import { readTablePage, tableOf } from '@gab/tools/table';
import { ToolRefusal, type Session } from '@gab/tools/tool';
import { z } from 'zod';

import { JobStop, type AgentContext, type AgentResult, type RunnerAgent } from '../agents.ts';
import type { Queryable } from '../queryable.ts';
import { castCell, dayOf } from './cast.ts';
import { makeFinder } from './join.ts';

const LOADER_NAME = 'loader';
const VERSION = 'v1';
const REPORT_MIME = 'text/csv';

const NOT_IN_GRAPH = 'relation not loaded: the other end is not in the record';

interface LoaderOptions {
  /** Writes the bytes of the report, and returns the key that names them. */
  readonly store: { put(object: RawObject): Promise<string> };
}

const MAPPING = `SELECT payload, model_call_id::text AS model_call_id
  FROM public.proposals WHERE id = $1::uuid AND op = 'map_document'`;

const mappingRow = z.array(z.object({ payload: z.unknown(), model_call_id: z.uuid() }));

const TEXT_SET = 'SELECT text_set FROM public.jobs WHERE id = $1::uuid';

const textSetRow = z.array(z.object({ text_set: z.string().nullable() }));

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

const ENTITY_ATTRS = 'SELECT attrs FROM api.entity WHERE id = $1::uuid';

const SAME_RELATION = `SELECT attrs FROM api.relation
  WHERE coalesce(proposed_type, type) = $1::text AND src_id = $2::uuid AND dst_id = $3::uuid
    AND valid_from IS NOT DISTINCT FROM $4::date AND valid_to IS NOT DISTINCT FROM $5::date
  ORDER BY id LIMIT 1`;

// External constraint: GEM names a holder that is no entity with these words, for example
// "small shareholder(s)" and "natural person(s)". Such a holder goes to the report, and never into
// the record.
const NOT_AN_ENTITY = /^(small share ?holder|natural person|individual)(s|\(s\))?$/iu;

type Value = string | number | boolean | string[];
type Attrs = Record<string, { v: Value }>;
type Rules = Readonly<Record<string, { readonly column: string; readonly cast: Cast }>>;
interface Days {
  validFrom?: string;
  validTo?: string;
}
type DayRule = { readonly column: string; readonly pattern: string } | undefined;

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

const linkRow = z.array(
  z.object({ attrs: z.record(z.string(), z.object({ v: z.unknown() })).nullable() }),
);

/** The attributes of the relation of this type between these ends and these days that the record
 * holds, or null when the record holds no such relation. */
const linkedAttrs = async (
  db: Queryable,
  type: string,
  src: string,
  dst: string,
  days: Days,
): Promise<Readonly<Record<string, { readonly v: unknown }>> | null> => {
  const [held] = linkRow.parse(
    (await db.query(SAME_RELATION, [type, src, dst, days.validFrom ?? null, days.validTo ?? null]))
      .rows,
  );
  return held === undefined ? null : (held.attrs ?? {});
};

/** The values of a row that the record holds with another value, as words for the report. */
const otherValues = (
  held: Readonly<Record<string, { readonly v: unknown }>>,
  attrs: Attrs,
): string[] =>
  Object.entries(attrs)
    .filter(([key, value]) => !isDeepStrictEqual(held[key]?.v, value.v))
    .map(
      ([key, value]) =>
        `${key} ${held[key] === undefined ? 'with no value' : JSON.stringify(held[key].v)}, ` +
        `and the row gives ${JSON.stringify(value.v)}`,
    );

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
      const [named] = textSetRow.parse((await context.db.query(TEXT_SET, [job.id])).rows);
      page = await readTablePage(session, document, named?.text_set ?? null);
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
    const { rows } = mapping;
    const find = makeFinder(context.db, isLinkTable(rows) ? {} : rows.attrs, table.header);

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

    /** One row: its cells, and the two ways to write a line of the report on it. */
    interface RowAt {
      readonly record: CsvRecord;
      readonly cell: (name: string) => string;
      readonly note: (reason: string) => void;
      readonly unfit: (reason: string) => void;
    }

    // Casts each cell that a set of rules reads. A refused cell refuses the whole set, and a
    // skipped cell gives a note.
    const castAll = (rules: Rules, at: RowAt): { attrs: Attrs } | { refused: string } => {
      const attrs: Attrs = {};
      const pairedRegister = (key: string, rule: { column: string; cast: Cast }): boolean =>
        rule.cast.type === 'ru_register' &&
        Object.entries(rules).some(
          ([other, held]) =>
            other !== key && held.column === rule.column && held.cast.type === 'ru_register',
        );
      for (const [key, rule] of Object.entries(rules)) {
        const text = at.cell(rule.column);
        if (text === '') continue;
        const cast = castCell(rule.cast, key, text);
        if (cast.ok === 'skip') {
          // A register column that fills the tax number and the registration number gives one
          // of them in each row, and the other key is no fault of the row.
          if (!pairedRegister(key, rule))
            at.note(`the column "${rule.column}" gives no ${key}: ${cast.reason}`);
          continue;
        }
        if (!cast.ok) return { refused: `the column "${rule.column}": ${cast.reason}` };
        attrs[key] = { v: cast.value };
      }
      return { attrs };
    };

    const daysOf = (
      at: RowAt,
      from: DayRule,
      to: DayRule,
    ): { days: Days } | { refused: string } => {
      const days: Days = {};
      for (const [name, rule] of [
        ['validFrom', from],
        ['validTo', to],
      ] as const) {
        if (rule === undefined || at.cell(rule.column) === '') continue;
        const day = dayOf(at.cell(rule.column), rule.pattern);
        if (day === null)
          return { refused: `"${at.cell(rule.column)}" is not a day as ${rule.pattern}` };
        days[name] = day;
      }
      return { days };
    };

    // The span of the row is the citation of each act of the row. Code reads it from the page,
    // and no model quotes it.
    const itemOf = (
      at: RowAt,
      request: unknown,
      id: string,
      foundBy: string | null,
    ): { item: unknown } | { refused: string } => {
      const read = writeRequest.safeParse(request);
      if (!read.success)
        return { refused: read.error.issues.map((issue) => issue.message).join('; ') };
      const made = machineAct(read.data, [document]);
      return {
        item: {
          id,
          op: made.op,
          payload: made.payload,
          src: made.src,
          target_kind: made.targetKind,
          target_id: made.targetId,
          names: made.names,
          ...(foundBy === null ? {} : { found_by: foundBy }),
          dissent: false,
          model_call_id: held.model_call_id,
          // The author of a row is the body that publishes the table, and never the file name.
          originator: mapping.publisher ?? mapping.table,
          modality: mapping.modality,
          citations: [
            {
              document,
              text_extractor: page.textSet,
              page: page.page,
              start: at.record.start,
              end: at.record.end,
            },
          ],
        },
      };
    };

    // Proposes the acts of one row as one batch. A row with no act has been loaded before, and
    // it counts as loaded.
    const proposeRow = async (at: RowAt, items: readonly unknown[]): Promise<void> => {
      if (items.length > 0) {
        const refused = await propose(items);
        if (refused !== null) {
          at.unfit(refused);
          return;
        }
      }
      loaded += 1;
    };

    // A row of a relation table is one relation between two entities that the record holds. It
    // creates no entity, so a row whose end the record does not hold goes to the report.
    const loadLink = async (links: LinkRows, at: RowAt): Promise<void> => {
      const ends: string[] = [];
      for (const [side, end] of [
        ['src', links.src],
        ['dst', links.dst],
      ] as const) {
        const cells = [end.name, ...end.lookup.map((one) => one.column)]
          .flatMap((name) => (name === undefined ? [] : [at.cell(name)]))
          .filter((text) => text !== '');
        const holder = cells.find((text) => NOT_AN_ENTITY.test(text));
        if (holder !== undefined) {
          at.unfit(`relation not loaded: the ${side} "${holder}" is not an entity`);
          return;
        }
        const [named] = cells;
        if (named === undefined) {
          at.unfit(`relation not loaded: the row gives no ${side}`);
          return;
        }
        const found = await find(at.record, end.lookup, end.entity_type);
        if (found.kind === 'none') {
          at.unfit(`relation not loaded: the ${side} "${named}" is not in the record`);
          return;
        }
        if (found.kind === 'many') {
          at.unfit(
            `relation not loaded: the lookup of the ${side} by ${found.key} finds ` +
              `${String(found.count)} entities`,
          );
          return;
        }
        // A name is no key, and a relation of a reference dataset passes with no check. So a
        // relation is loaded only between two ends that a key finds.
        if (found.key === 'label') {
          at.unfit(
            `relation not loaded: the ${side} "${named}" finds entity ${found.id} by its name only`,
          );
          return;
        }
        ends.push(found.id);
      }
      const [srcId, dstId] = ends;
      if (srcId === undefined || dstId === undefined) throw new Error('a relation has two ends');

      const cast = castAll(links.attrs, at);
      if ('refused' in cast) {
        at.unfit(cast.refused);
        return;
      }
      const dated = daysOf(at, links.valid_from, links.valid_to);
      if ('refused' in dated) {
        at.unfit(`relation not loaded: ${dated.refused}`);
        return;
      }
      const { attrs } = cast;
      const { days } = dated;

      // A link that the record holds with the same values has been loaded before. A link that
      // the record holds with another value is never changed in silence: the operator reads it.
      const linked = await linkedAttrs(context.db, links.relation_type, srcId, dstId, days);
      if (linked !== null) {
        const other = otherValues(linked, attrs);
        if (other.length === 0) loaded += 1;
        else at.unfit(`the record holds this relation with other values: ${other.join('; ')}`);
        return;
      }
      const made = itemOf(
        at,
        {
          op: 'create_relation',
          type: links.relation_type,
          srcId,
          dstId,
          ...days,
          ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        },
        randomUUID(),
        null,
      );
      if ('refused' in made) {
        at.unfit(made.refused);
        return;
      }
      await proposeRow(at, [made.item]);
    };

    const loadRow = async (record: CsvRecord, row: number): Promise<void> => {
      const where = { row, page: page.page, start: record.start, end: record.end };
      const at: RowAt = {
        record,
        cell: (name) => (record.fields[column.get(name) ?? -1] ?? '').trim(),
        note: (reason) => {
          lines.push({ ...where, reason });
        },
        unfit: (reason) => {
          excluded += 1;
          lines.push({ ...where, reason });
        },
      };
      const { cell, note, unfit } = at;
      if (record.fields.length !== table.header.length) {
        unfit(
          `the row holds ${String(record.fields.length)} fields, and the header holds ` +
            String(table.header.length),
        );
        return;
      }
      if (isLinkTable(rows)) {
        await loadLink(rows, at);
        return;
      }

      const label = cell(rows.label);
      if (label === '') {
        unfit(`the required field "${rows.label}" is empty`);
        return;
      }

      const cast = castAll(rows.attrs, at);
      if ('refused' in cast) {
        unfit(cast.refused);
        return;
      }
      const { attrs } = cast;

      let geom: unknown;
      const place = rows.geom;
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

      const found = await find(record, rows.lookup, rows.entity_type);
      if (found.kind === 'many') {
        unfit(`the lookup by ${found.key} finds ${String(found.count)} entities`);
        return;
      }
      // A name is no key: two entities can share it. A row that finds its entity by its name only
      // adds its facts, and the act keeps the key, so the Doubt rule sends it to the operator.
      if (found.kind === 'one' && found.key === 'label')
        note(`the row finds entity ${found.id} by its name only`);
      for (const [key, value] of Object.entries(rows.constants ?? {})) attrs[key] = { v: value };
      const hasAttrs = Object.keys(attrs).length > 0;
      if (found.kind === 'one' && !hasAttrs) {
        unfit(`the row finds entity ${found.id} and adds no attribute`);
        return;
      }

      // The entity of the row has the identifier that its act is given, so a relation of the row
      // can name it before the operator promotes it.
      const rowId = found.kind === 'one' ? found.id : randomUUID();
      const requests: { request: unknown; id: string; foundBy: string | null }[] = [];
      // An update that changes no value is not proposed. A load that follows the promotion of an
      // earlier load then adds no act of no effect.
      if (found.kind === 'none')
        requests.push({
          request: {
            op: 'create_entity',
            type: rows.entity_type,
            label,
            ...(geom === undefined ? {} : { geom }),
            ...(hasAttrs ? { attrs } : {}),
          },
          id: rowId,
          foundBy: null,
        });
      else if (!(await holdsEach(context.db, found.id, document, attrs)))
        requests.push({
          request: { op: 'update_attrs', targetKind: 'entity', targetId: found.id, attrs },
          id: randomUUID(),
          foundBy: found.key,
        });

      for (const relation of mapping.relations) {
        if (cell(relation.other.column) === '') continue;
        // A relation is a unit of its own, so the doubt of a name match never reaches it. The row
        // writes it only after the operator gives the entity an identifier.
        if (found.kind === 'one' && found.key === 'label') {
          note('relation not loaded: the row finds its entity by its name only');
          continue;
        }
        const end = await find(record, [relation.other], rows.entity_type);
        if (end.kind === 'none') {
          note(NOT_IN_GRAPH);
          continue;
        }
        if (end.kind === 'many') {
          note(`relation not loaded: the lookup by ${end.key} finds ${String(end.count)} entities`);
          continue;
        }
        const dated = daysOf(at, relation.valid_from, relation.valid_to);
        if ('refused' in dated) {
          note(`relation not loaded: ${dated.refused}`);
          continue;
        }
        const linkCast = castAll(relation.attrs ?? {}, at);
        if ('refused' in linkCast) {
          note(`relation not loaded: ${linkCast.refused}`);
          continue;
        }
        const { days } = dated;
        const linkAttrs = linkCast.attrs;
        const [srcId, dstId] = relation.row_is === 'src' ? [rowId, end.id] : [end.id, rowId];
        if (
          found.kind === 'one' &&
          (await linkedAttrs(context.db, relation.type, srcId, dstId, days)) !== null
        )
          continue;
        requests.push({
          request: {
            op: 'create_relation',
            type: relation.type,
            srcId,
            dstId,
            ...days,
            ...(Object.keys(linkAttrs).length > 0 ? { attrs: linkAttrs } : {}),
          },
          id: randomUUID(),
          foundBy: null,
        });
      }

      const items = [];
      for (const one of requests) {
        const made = itemOf(at, one.request, one.id, one.foundBy);
        if ('refused' in made) {
          unfit(made.refused);
          return;
        }
        items.push(made.item);
      }
      await proposeRow(at, items);
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
