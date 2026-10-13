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
  compareLink,
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

const SAME_RELATION = `SELECT id::text AS id, attrs FROM api.relation
  WHERE coalesce(proposed_type, type) = $1::text AND src_id = $2::uuid AND dst_id = $3::uuid
    AND valid_from IS NOT DISTINCT FROM $4::date AND valid_to IS NOT DISTINCT FROM $5::date
  ORDER BY id LIMIT 1`;

const ENTITY_GEOM = 'SELECT geom FROM api.entity WHERE id = $1::uuid';

const geomRow = z.array(z.object({ geom: z.unknown() }));

// Six decimals are about ten centimetres. The record writes a position with fewer digits than a
// file gives, so two readings of one point compare after this rounding.
const rounded = (value: unknown): unknown =>
  typeof value === 'number'
    ? Math.round(value * 1e6) / 1e6
    : Array.isArray(value)
      ? value.map(rounded)
      : value;

/** The place of an entity, and whether it is the place that a row gives. */
const geomState = async (
  db: Queryable,
  entity: string,
  geom: { readonly type?: unknown; readonly coordinates?: unknown },
): Promise<'none' | 'same' | 'different'> => {
  const [held] = geomRow.parse((await db.query(ENTITY_GEOM, [entity])).rows);
  const had = held?.geom;
  if (had === null || had === undefined) return 'none';
  const read = z.object({ type: z.unknown(), coordinates: z.unknown() }).safeParse(had);
  return read.success &&
    isDeepStrictEqual(read.data.type, geom.type) &&
    isDeepStrictEqual(rounded(read.data.coordinates), rounded(geom.coordinates))
    ? 'same'
    : 'different';
};

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
  z.object({
    id: z.uuid(),
    attrs: z
      .record(z.string(), z.object({ v: z.unknown(), src: z.array(z.string()).optional() }))
      .nullable(),
  }),
);

/** The relation of this type between these ends and these days that the record holds, with its
 * attributes, or null when the record holds no such relation. */
const linkedAttrs = async (
  db: Queryable,
  type: string,
  src: string,
  dst: string,
  days: Days,
): Promise<{ readonly id: string; readonly attrs: HeldAttrs } | null> => {
  const [held] = linkRow.parse(
    (await db.query(SAME_RELATION, [type, src, dst, days.validFrom ?? null, days.validTo ?? null]))
      .rows,
  );
  return held === undefined ? null : { id: held.id, attrs: held.attrs ?? {} };
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
      const ends: string[] = [];
      for (const [side, end] of [
        ['src', links.src],
        ['dst', links.dst],
      ] as const) {
        const one = await resolveEnd(findEnd, at.record, at.cell, side, end);
        if (one.refused !== null) {
          at.unfit(one.refused);
          return;
        }
        ends.push(one.id);
      }
      const [srcId, dstId] = ends;
      if (srcId === undefined || dstId === undefined) throw new Error('a relation has two ends');

      const cast = castAll(links.attrs, at.cell, at.note);
      if ('refused' in cast) {
        at.unfit(cast.refused);
        return;
      }
      const dated = daysOf(at.cell, links.valid_from, links.valid_to);
      if ('refused' in dated) {
        at.unfit(`relation not loaded: ${dated.refused}`);
        return;
      }
      const { attrs } = cast;
      const { days } = dated;

      // A link that the record holds with another value is never changed in silence: the operator
      // reads it. A value that the link lacks, or that this document does not cite yet, is
      // proposed as an addition, so the document becomes a source of the relation.
      const linked = await linkedAttrs(context.db, links.relation_type, srcId, dstId, days);
      if (linked !== null) {
        const { conflicts, additions } = compareLink(linked.attrs, attrs, document);
        if (conflicts.length > 0) {
          at.unfit(`the record holds this relation with other values: ${conflicts.join('; ')}`);
          return;
        }
        if (Object.keys(additions).length === 0) {
          loaded += 1;
          return;
        }
        const added = itemOf(
          at,
          { op: 'update_attrs', targetKind: 'relation', targetId: linked.id, attrs: additions },
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

      const cast = castAll(rows.attrs, at.cell, at.note);
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
      if (found.kind === 'one' && !hasAttrs && geom === undefined) {
        unfit(`the row finds entity ${found.id} and adds no attribute`);
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
      // The act that updates an entity sets a missing place. A place that differs from the place
      // of the record is proposed too, and the Doubt rule holds it for the operator (S3).
      if (found.kind === 'one' && geom !== undefined) {
        // A value that is no object is no geometry, and the request refuses it with a sentence.
        const place = typeof geom === 'object' && geom !== null ? geom : {};
        if ((await geomState(context.db, found.id, place)) !== 'same')
          requests.push({
            request: { op: 'update_entity', targetId: found.id, geom },
            id: randomUUID(),
            foundBy: found.key,
          });
        else if (requests.length === 0)
          lines.push({
            ...where,
            reason: `the row adds no act: the place of ${found.id} is the same`,
          });
      }

      for (const relation of mapping.relations) {
        const otherText = cell(relation.other.column);
        if (otherText === '') continue;
        // A relation is a unit of its own, so the doubt of a name match never reaches it. The row
        // writes it only after the operator gives the entity an identifier.
        if (found.kind === 'one' && found.key === 'label') {
          note('relation not loaded: the row finds its entity by its name only');
          continue;
        }
        const dated = daysOf(at.cell, relation.valid_from, relation.valid_to);
        if ('refused' in dated) {
          note(`relation not loaded: ${dated.refused}`);
          continue;
        }
        const linkCast = castAll(relation.attrs ?? {}, at.cell, at.note);
        if ('refused' in linkCast) {
          note(`relation not loaded: ${linkCast.refused}`);
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
            note(NOT_IN_GRAPH);
            continue;
          }
          if (end.kind === 'many') {
            note(
              `relation not loaded: the lookup by ${end.key} finds ${String(end.count)} entities`,
            );
            continue;
          }
          ends.push({ id: end.id, extra: {} });
        } else {
          const split = splitOwners(otherText, relation.split.separator);
          if ('refused' in split) {
            note(`relation not loaded: ${split.refused}`);
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
            note(`relation not loaded: the identifier ${refusedOwner} finds more than one entity`);
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
            // The record holds the relation. A value with another value is reported, and a value
            // that the relation lacks is proposed as an addition.
            const { conflicts, additions } = compareLink(linked.attrs, linkAttrs, document);
            if (conflicts.length > 0)
              note(
                `relation not loaded: the record holds it with other values: ${conflicts.join('; ')}`,
              );
            else if (Object.keys(additions).length > 0)
              requests.push({
                request: {
                  op: 'update_attrs',
                  targetKind: 'relation',
                  targetId: linked.id,
                  attrs: additions,
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
