import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { machineAct } from '@gab/proposal/machine';
import {
  isLinkTable,
  mappingPayload,
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
import { findByIdentifier, makeFinder, type Found } from './join.ts';
import {
  castAll,
  changedValues,
  splitOwners,
  type Attrs,
  daysOf,
  makeEndFinder,
  resolveEnd,
  type Days,
  type HeldAttrs,
  type SplitOwner,
} from './link.ts';

const LOADER_NAME = 'loader';
const VERSION = 'v1';
const REPORT_MIME = 'text/csv';

// The entity of a create_entity act has the identifier of the act, so a relation can name it
// before the operator decides.
const PENDING_OWNER = `SELECT id::text AS id FROM public.proposals
  WHERE op = 'create_entity' AND status = 'pending' AND payload->>'type' = $1::text
    AND payload #>> '{attrs,gem_entity_id,v}' = $2::text ORDER BY id LIMIT 20`;

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

/** One line of the report: a row that was excluded, or a note on a row that was loaded. A line
 * with no row is about the record: a relation that the edition no longer gives. */
interface Line {
  readonly row: number | null;
  readonly page: number | null;
  readonly start: number | null;
  readonly end: number | null;
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
  readonly dropped: number;
}

const rowOrder = (line: Line): number => line.row ?? Number.POSITIVE_INFINITY;

/** The report of a load as CSV. The first line names the load and gives its counts, so two loads
 * never share bytes, and the lines after it name each row in row order. The lines with no row
 * come last: each one is a relation that the edition no longer gives. */
export const reportOf = (totals: Totals, lines: readonly Line[]): string =>
  [
    `# document ${totals.document}; mapping ${totals.mapping}; job ${totals.job}; ` +
      `read ${String(totals.read)}; loaded ${String(totals.loaded)}; ` +
      `excluded ${String(totals.excluded)}; dropped ${String(totals.dropped)}`,
    'row,page,start,end,reason',
    ...[...lines]
      .sort((left, right) => rowOrder(left) - rowOrder(right))
      .map((line) =>
        [line.row, line.page, line.start, line.end]
          .map((value) => (value === null ? '' : String(value)))
          .concat(csvField(line.reason))
          .join(','),
      ),
  ]
    .map((line) => `${line}\r\n`)
    .join('');

const ENTITY_HELD = 'SELECT label, attrs, geom FROM api.entity WHERE id = $1::uuid';

// The relation of this type between these ends: the one with the same days, or else the open one.
// A new edition that gives other days for a held link finds that link, and creates no second one.
const SAME_RELATION = `SELECT id::text AS id, attrs, valid_from::text AS valid_from,
         valid_to::text AS valid_to
    FROM api.relation
   WHERE coalesce(proposed_type, type) = $1::text AND src_id = $2::uuid AND dst_id = $3::uuid
     AND (valid_to IS NULL
          OR (valid_from IS NOT DISTINCT FROM $4::date AND valid_to IS NOT DISTINCT FROM $5::date))
   ORDER BY (valid_from IS NOT DISTINCT FROM $4::date AND valid_to IS NOT DISTINCT FROM $5::date)
            DESC, valid_from DESC NULLS LAST, id
   LIMIT 1`;

// The open relations of a type at one end or at the two ends. A row that the load does not write
// still gives these links, so the report does not list them as dropped.
const OPEN_LINKS = `SELECT id::text AS id FROM api.relation
   WHERE coalesce(proposed_type, type) = $1::text AND valid_to IS NULL
     AND ($2::uuid IS NULL OR src_id = $2::uuid) AND ($3::uuid IS NULL OR dst_id = $3::uuid)`;

const idRow = z.array(z.object({ id: z.uuid() }));

// Six decimals are about ten centimetres. The record writes a position with fewer digits than a
// file gives, so two readings of one point compare after this rounding.
const rounded = (value: unknown): unknown =>
  typeof value === 'number'
    ? Math.round(value * 1e6) / 1e6
    : Array.isArray(value)
      ? value.map(rounded)
      : value;

/** True when the place that the record holds is the place that a row gives. */
const samePlace = (
  had: unknown,
  geom: { readonly type?: unknown; readonly coordinates?: unknown },
): boolean => {
  const read = z.object({ type: z.unknown(), coordinates: z.unknown() }).safeParse(had);
  return (
    read.success &&
    isDeepStrictEqual(read.data.type, geom.type) &&
    isDeepStrictEqual(rounded(read.data.coordinates), rounded(geom.coordinates))
  );
};

const entityRow = z.array(
  z.object({
    label: z.string(),
    attrs: z.record(z.string(), z.object({ v: z.unknown(), src: z.array(z.string()).optional() })),
    geom: z.unknown(),
  }),
);

/** The name, the values and the place of an entity of the record. */
const entityHeld = async (
  db: Queryable,
  entity: string,
): Promise<{ readonly label: string; readonly attrs: HeldAttrs; readonly geom: unknown }> => {
  const [held] = entityRow.parse((await db.query(ENTITY_HELD, [entity])).rows);
  return { label: held?.label ?? '', attrs: held?.attrs ?? {}, geom: held?.geom ?? null };
};

// The earlier editions of the table: the other documents of the same host that a load read under
// a mapping of the same header and the same text set (ADR 0021).
const EARLIER = 'SELECT public.earlier_editions($1::uuid)::text[] AS docs';

const earlierRow = z.array(z.object({ docs: z.array(z.string()).nullable() }));

// The open relations of these types that an earlier edition backs, and that this document does
// not back. The load reports each one that this edition no longer gives, and closes none.
const EDITION_LINKS = `SELECT r.id::text AS id, r.type, coalesce(s.label, r.src_id::text) AS src,
         coalesce(d.label, r.dst_id::text) AS dst
    FROM public.relations r
    LEFT JOIN public.entities s ON s.id = r.src_id
    LEFT JOIN public.entities d ON d.id = r.dst_id
   WHERE coalesce(r.proposed_type, r.type) = ANY ($1::text[]) AND r.valid_to IS NULL
     AND NOT r.sources::text[] @> ARRAY[$3::text]
     AND (r.sources::text[] && $2::text[]
          OR EXISTS (SELECT 1 FROM jsonb_each(r.attrs) AS a(key, held)
                      WHERE jsonb_typeof(a.held->'src') = 'array'
                        AND (a.held->'src') ?| $2::text[]))
   ORDER BY r.id`;

const editionLinkRow = z.array(
  z.object({ id: z.uuid(), type: z.string(), src: z.string(), dst: z.string() }),
);

const linkRow = z.array(
  z.object({
    id: z.uuid(),
    attrs: z
      .record(z.string(), z.object({ v: z.unknown(), src: z.array(z.string()).optional() }))
      .nullable(),
    valid_from: z.string().nullable(),
    valid_to: z.string().nullable(),
  }),
);

const daysText = (from: string | null, to: string | null): string =>
  `${from ?? 'no start'} to ${to ?? 'no end'}`;

/** The relation of this type between these ends that the record holds, with its attributes, or
 * null when the record holds no such relation. `days` words the other days that the record holds,
 * or is null when the days are the same. A machine does not change the days of a held relation,
 * so other days go to the report. */
const linkedAttrs = async (
  db: Queryable,
  type: string,
  src: string,
  dst: string,
  days: Days,
): Promise<{
  readonly id: string;
  readonly attrs: HeldAttrs;
  readonly days: string | null;
} | null> => {
  const [from, to] = [days.validFrom ?? null, days.validTo ?? null];
  const [held] = linkRow.parse((await db.query(SAME_RELATION, [type, src, dst, from, to])).rows);
  if (held === undefined) return null;
  const same = held.valid_from === from && held.valid_to === to;
  return {
    id: held.id,
    attrs: held.attrs ?? {},
    days: same
      ? null
      : `the row gives ${type} the days ${daysText(from, to)}, and the record holds ` +
        `relation ${held.id} with ${daysText(held.valid_from, held.valid_to)}`,
  };
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
    const findEnd = makeEndFinder(context.db, table.header);
    // The owners that this load created, by type and identifier. A second row with the same owner
    // finds it here, because the first act may still wait for the operator. A row records its new
    // owners here only after the door accepts the batch of the row.
    const createdOwners = new Map<string, string>();

    // The owner of a GEM identifier: the committed entity of the type, or else the entity that an
    // earlier load proposed and the operator did not decide yet.
    const ownerOf = async (type: string, gemId: string): Promise<Found> => {
      const held = await findByIdentifier(context.db, 'gem_entity_id', gemId, type);
      if (held.kind !== 'none') return held;
      const { rows: waiting } = await context.db.query(PENDING_OWNER, [type, gemId]);
      const ids = z.array(z.object({ id: z.uuid() })).parse(waiting);
      const [first] = ids;
      if (ids.length > 1) return { kind: 'many', key: 'gem_entity_id', count: ids.length };
      return first === undefined
        ? { kind: 'none' }
        : { kind: 'one', id: first.id, key: 'gem_entity_id' };
    };
    // A link that an earlier edition gave, and that this edition no longer gives, goes to the
    // report. A table with no relation type gives no link, so it reads no earlier edition.
    const types = isLinkTable(rows)
      ? [rows.relation_type]
      : mapping.relations.map((relation) => relation.type);
    const editions =
      types.length === 0
        ? []
        : (earlierRow.parse((await context.db.query(EARLIER, [job.id])).rows)[0]?.docs ?? []);
    // The relations of the record that a row of this edition gives.
    const given = new Set<string>();

    // A row that the load does not write can still give a link: the report must not list that
    // link as dropped. One end that the row does not find marks each open link of the type at the
    // other end, so the report never lists a link that the edition can still give.
    const markGiven = async (type: string, src: string | null, dst: string | null) => {
      if (editions.length === 0 || (src === null && dst === null)) return;
      for (const { id } of idRow.parse((await context.db.query(OPEN_LINKS, [type, src, dst])).rows))
        given.add(id);
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

    /** One row: its cells, and the two ways to write a line of the report on it. */
    interface RowAt {
      readonly record: CsvRecord;
      readonly cell: (name: string) => string;
      readonly note: (reason: string) => void;
      readonly unfit: (reason: string) => void;
    }

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
    const proposeRow = async (at: RowAt, items: readonly unknown[]): Promise<boolean> => {
      if (items.length > 0) {
        const refused = await propose(items);
        if (refused !== null) {
          at.unfit(refused);
          return false;
        }
      }
      loaded += 1;
      return true;
    };

    // A row of a relation table is one relation between two entities that the record holds. It
    // creates no entity, so a row whose end the record does not hold goes to the report.
    const loadLink = async (links: LinkRows, at: RowAt): Promise<void> => {
      const src = await resolveEnd(findEnd, at.record, at.cell, 'src', links.src);
      const dst = await resolveEnd(findEnd, at.record, at.cell, 'dst', links.dst);
      // The entity that an end finds, also by its name only: the row can still give its link.
      const seen = (end: typeof src): string | null =>
        end.found?.kind === 'one' ? end.found.id : null;
      const refused = src.refused ?? dst.refused;
      if (refused !== null) {
        await markGiven(links.relation_type, seen(src), seen(dst));
        at.unfit(refused);
        return;
      }
      const [srcId, dstId] = [src.id, dst.id];
      if (srcId === null || dstId === null) throw new Error('a relation has two ends');

      const cast = castAll(links.attrs, at.cell, at.note);
      if ('refused' in cast) {
        await markGiven(links.relation_type, srcId, dstId);
        at.unfit(cast.refused);
        return;
      }
      const dated = daysOf(at.cell, links.valid_from, links.valid_to);
      if ('refused' in dated) {
        await markGiven(links.relation_type, srcId, dstId);
        at.unfit(`relation not loaded: ${dated.refused}`);
        return;
      }
      const { attrs } = cast;
      const { days } = dated;

      // A link that the record holds gets only the values that changed, in one proposal. A changed
      // value is never written in silence: the Doubt rule holds it for the operator (S3). A link
      // with the same values writes nothing.
      const linked = await linkedAttrs(context.db, links.relation_type, srcId, dstId, days);
      if (linked !== null) {
        given.add(linked.id);
        if (linked.days !== null) at.note(linked.days);
        const changed = changedValues(linked.attrs, attrs);
        if (Object.keys(changed).length === 0) {
          loaded += 1;
          return;
        }
        const added = itemOf(
          at,
          { op: 'update_attrs', targetKind: 'relation', targetId: linked.id, attrs: changed },
          randomUUID(),
          null,
        );
        if ('refused' in added) {
          at.unfit(added.refused);
          return;
        }
        await proposeRow(at, [added.item]);
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

    // The links that a row of an entity table gives, also when the load does not write them. The
    // far ends are found as the load finds them, and nothing is created. With no entity, the row
    // lookup finds it.
    const markRelations = async (
      record: CsvRecord,
      cell: (name: string) => string,
      entity: string | null,
      only?: MappingPayload['relations'][number],
    ): Promise<void> => {
      if (editions.length === 0 || isLinkTable(rows)) return;
      let rowEntity = entity;
      if (rowEntity === null) {
        const found = await find(record, rows.lookup, rows.entity_type);
        if (found.kind !== 'one') return;
        rowEntity = found.id;
      }
      for (const relation of only === undefined ? mapping.relations : [only]) {
        const text = cell(relation.other.column);
        if (text === '') continue;
        const farType = relation.other_type ?? rows.entity_type;
        const far: (string | null)[] = [];
        if (relation.split === undefined) {
          const end = await find(record, [relation.other], farType);
          far.push(end.kind === 'one' ? end.id : null);
        } else {
          const split = splitOwners(text, relation.split.separator);
          if ('refused' in split) far.push(null);
          else
            for (const owner of split.owners) {
              const owned = await ownerOf(farType, owner.gemId);
              far.push(owned.kind === 'one' ? owned.id : null);
            }
        }
        for (const id of far)
          if (relation.row_is === 'src') await markGiven(relation.type, rowEntity, id);
          else await markGiven(relation.type, id, rowEntity);
      }
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

      // A row that the load does not write still gives its links.
      const skipRow = async (reason: string): Promise<void> => {
        unfit(reason);
        await markRelations(record, cell, null);
      };

      const label = cell(rows.label);
      if (label === '') {
        await skipRow(`the required field "${rows.label}" is empty`);
        return;
      }

      const cast = castAll(rows.attrs, at.cell, at.note);
      if ('refused' in cast) {
        await skipRow(cast.refused);
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
              await skipRow(`the column "${place.geojson}" holds no GeoJSON`);
              return;
            }
          }
        } else {
          const [lon, lat] = [cell(place.lon), cell(place.lat)];
          if ((lon === '') !== (lat === '')) {
            await skipRow('the geometry has one ordinate and not the other');
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
      if (found.kind === 'one' && !hasAttrs && geom === undefined) {
        unfit(`the row finds entity ${found.id} and adds no attribute`);
        await markRelations(record, cell, found.id);
        return;
      }

      // The entity of the row has the identifier that its act is given, so a relation of the row
      // can name it before the operator promotes it.
      const rowId = found.kind === 'one' ? found.id : randomUUID();
      // The new owners of this row, recorded in `createdOwners` only if the door accepts the row.
      const rowOwners = new Map<string, string>();
      const requests: { request: unknown; id: string; foundBy: string | null }[] = [];
      // An update that changes no value is not proposed. A load that follows the promotion of an
      // earlier load then adds no act of no effect.
      // The name, the values and the place of the entity that the row finds, read once.
      const entity = found.kind === 'one' ? await entityHeld(context.db, found.id) : null;
      if (entity === null)
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
      else if (found.kind === 'one') {
        // The load compares values and not sources: a row of a new edition that gives the values
        // of the record writes nothing, and a changed value gives one proposal with the changed
        // values only.
        const changed = changedValues(entity.attrs, attrs);
        if (Object.keys(changed).length > 0)
          requests.push({
            request: {
              op: 'update_attrs',
              targetKind: 'entity',
              targetId: found.id,
              attrs: changed,
            },
            id: randomUUID(),
            foundBy: found.key,
          });
        // A machine never changes a name, so a new name goes to the operator through the report.
        // The identifier key finds the same entity, and the load creates no second one.
        if (found.key !== 'label' && entity.label.toLowerCase() !== label.toLowerCase())
          note(`the row gives the name "${label}", and the record holds "${entity.label}"`);
      }
      // The act that updates an entity sets a missing place. A place that differs from the place
      // of the record is proposed too, and the Doubt rule holds it for the operator (S3).
      if (found.kind === 'one' && entity !== null && geom !== undefined) {
        // A value that is no object is no geometry, and the request refuses it with a sentence.
        const place = typeof geom === 'object' && geom !== null ? geom : {};
        if (!samePlace(entity.geom, place))
          requests.push({
            request: { op: 'update_entity', targetId: found.id, geom },
            id: randomUUID(),
            foundBy: found.key,
          });
        else if (requests.length === 0)
          note(`the row adds no act: the place of ${found.id} is the same`);
      }

      for (const relation of mapping.relations) {
        const otherText = cell(relation.other.column);
        if (otherText === '') continue;
        // A relation that the row does not write goes to the report, and the row still gives it.
        const skip = async (reason: string): Promise<void> => {
          note(reason);
          if (found.kind === 'one') await markRelations(record, cell, found.id, relation);
        };
        // A relation is a unit of its own, so the doubt of a name match never reaches it. The row
        // writes it only after the operator gives the entity an identifier.
        if (found.kind === 'one' && found.key === 'label') {
          await skip('relation not loaded: the row finds its entity by its name only');
          continue;
        }
        const dated = daysOf(at.cell, relation.valid_from, relation.valid_to);
        if ('refused' in dated) {
          await skip(`relation not loaded: ${dated.refused}`);
          continue;
        }
        const linkCast = castAll(relation.attrs ?? {}, at.cell, at.note);
        if ('refused' in linkCast) {
          await skip(`relation not loaded: ${linkCast.refused}`);
          continue;
        }
        const { days } = dated;
        const farType = relation.other_type ?? rows.entity_type;
        // The far ends of this relation: one entity for a plain cell, and one for each owner of a
        // cell that splits.
        const ends: { id: string; extra: Attrs }[] = [];
        if (relation.split === undefined) {
          const end = await find(record, [relation.other], farType);
          if (end.kind === 'none') {
            await skip(NOT_IN_GRAPH);
            continue;
          }
          if (end.kind === 'many') {
            await skip(
              `relation not loaded: the lookup by ${end.key} finds ${String(end.count)} entities`,
            );
            continue;
          }
          ends.push({ id: end.id, extra: {} });
        } else {
          const split = splitOwners(otherText, relation.split.separator);
          if ('refused' in split) {
            await skip(`relation not loaded: ${split.refused}`);
            continue;
          }
          // The owners are found first. One owner that finds many entities refuses the whole
          // relation of the row, as a cell that does not split does.
          const found: { id: string; owner: SplitOwner; created: boolean }[] = [];
          let refusedOwner: string | null = null;
          for (const owner of split.owners) {
            const slot = `${farType}:${owner.gemId}`;
            const made = rowOwners.get(slot) ?? createdOwners.get(slot);
            const owned: Found =
              made !== undefined
                ? { kind: 'one', id: made, key: 'gem_entity_id' }
                : await ownerOf(farType, owner.gemId);
            if (owned.kind === 'many') {
              refusedOwner = owner.gemId;
              break;
            }
            if (owned.kind === 'one') found.push({ id: owned.id, owner, created: false });
            else found.push({ id: randomUUID(), owner, created: true });
          }
          if (refusedOwner !== null) {
            await skip(
              `relation not loaded: the identifier ${refusedOwner} finds more than one entity`,
            );
            continue;
          }
          for (const one of found) {
            if (one.created) {
              // An owner identifier that the record lacks creates an entity with that identifier.
              rowOwners.set(`${farType}:${one.owner.gemId}`, one.id);
              requests.push({
                request: {
                  op: 'create_entity',
                  type: farType,
                  label: one.owner.name,
                  attrs: { gem_entity_id: { v: one.owner.gemId } },
                },
                id: one.id,
                foundBy: null,
              });
            }
            ends.push({ id: one.id, extra: { share_pct: { v: one.owner.share } } });
          }
        }
        for (const end of ends) {
          const linkAttrs: Attrs = { ...linkCast.attrs, ...end.extra };
          const [srcId, dstId] = relation.row_is === 'src' ? [rowId, end.id] : [end.id, rowId];
          const linked =
            found.kind === 'one'
              ? await linkedAttrs(context.db, relation.type, srcId, dstId, days)
              : null;
          if (linked !== null) {
            // The record holds the relation, and it gets only the values that changed. The Doubt
            // rule holds a changed value for the operator.
            given.add(linked.id);
            if (linked.days !== null) note(linked.days);
            const changed = changedValues(linked.attrs, linkAttrs);
            if (Object.keys(changed).length > 0)
              requests.push({
                request: {
                  op: 'update_attrs',
                  targetKind: 'relation',
                  targetId: linked.id,
                  attrs: changed,
                },
                id: randomUUID(),
                foundBy: null,
              });
            continue;
          }
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
      if (await proposeRow(at, items))
        for (const [slot, id] of rowOwners) createdOwners.set(slot, id);
    };

    for (const [index, record] of table.rows.entries()) await loadRow(record, index + 1);

    if (loaded + excluded !== table.rows.length)
      throw new JobStop('the rows loaded and excluded do not add up to the rows read');

    // The load closes nothing: an end date is an act of its own (ADR 0021).
    let dropped = 0;
    if (editions.length > 0)
      for (const link of editionLinkRow.parse(
        (await context.db.query(EDITION_LINKS, [types, editions, document])).rows,
      )) {
        if (given.has(link.id)) continue;
        dropped += 1;
        lines.push({
          row: null,
          page: null,
          start: null,
          end: null,
          reason:
            `the edition no longer gives relation ${link.id}: ${link.type} from "${link.src}" ` +
            `to "${link.dst}"`,
        });
      }

    const text = reportOf(
      {
        document,
        mapping: job.mappingId,
        job: job.id,
        read: table.rows.length,
        loaded,
        excluded,
        dropped,
      },
      lines,
    );
    const bytes = new TextEncoder().encode(text);
    const digest = sha256(bytes);
    const key = await options.store.put({ key: `raw/${digest}`, bytes, mime: REPORT_MIME });
    const title =
      `Load report of ${document} under mapping ${job.mappingId}: ${String(table.rows.length)} ` +
      `rows read, ${String(loaded)} loaded, ${String(excluded)} excluded, ` +
      `${String(dropped)} links dropped`;
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
