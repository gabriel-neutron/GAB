import { randomUUID } from 'node:crypto';

import { day } from '@gab/proposal/day';
import { attributeEdit } from '@gab/proposal/attribute-value';
import { GEOLOCATION_WORDS, geolocationMethod } from '@gab/proposal/geolocation-method';
import { machineAct } from '@gab/proposal/machine';
import { ASSET_KINDS } from '@gab/proposal/mapping';
import type { ProposalAct } from '@gab/proposal/payload';
import { writeRequest, type WriteRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { plainText } from './check-answer.ts';
import { eventActRefusal, eventEndsRefusal } from './event-rules.ts';
import { findExcerpt, MAX_TOLERANT_UNITS, pointSlice, type Span } from './excerpt.ts';
import { documentId, isDoorRefusal, rowsOf } from './fields.ts';
import { dateInUrl, occurredWeekdays } from './publication-date.ts';
import {
  daysFromPublication,
  namesProvision,
  statedBounds,
  unstatedCallDay,
  unstatedValues,
  withCodedJurisdiction,
  withoutBounds,
  withoutCallDay,
  type BoundName,
  type DroppedName,
} from './stated-value.ts';
import { UK_LIST_CSV } from './uk-sanctions-list.ts';
import {
  CheckFailure,
  defineTool,
  ToolRefusal,
  type CheckVerdict,
  type ItemToCheck,
  type Session,
} from './tool.ts';

/** How a page states a claim. A caller picks one word, and code decides what follows from it. */
const MODALITIES = ['enacts', 'asserts', 'attributes', 'alleges', 'denies'] as const;

// Origin: decided, not calibrated. One page states few claims, and a longer list is a model that
// repeats itself. A short excerpt is a quote of the claim and not a copy of the page.
const MAX_ITEMS = 50;
const MAX_EVIDENCE = 10;
const MAX_EXCERPT = 600;
// The words on each side of a passage that a checker reads with it, in code points.
const CONTEXT_POINTS = 300;

/** A local name of one item. A relation of the same batch names an entity by it. */
const localRef = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/u, 'a ref is a short lower-case word, such as e1 or vessel_1');

const END =
  'the id of an element of the record, the id of a new entity that waits in the review queue ' +
  '(only when the other end is an entity of the record), or the ref of an earlier item of this ' +
  'batch';

const ATTRIBUTES =
  'write each attribute as {"key": {"v": value}}, for example {"imo": {"v": "9074729"}}; a ' +
  'value is a text, a number, true or false, or a flat list of them; a key is lower case words ' +
  'joined by one underscore, with the unit in the key, as capacity_dwt';

// The closed list of the methods, in the words of a reader. A place with no method is refused.
const GEOLOCATION =
  'how the page found the place; give it with every geom: ' +
  Object.entries(GEOLOCATION_WORDS)
    .map(([key, words]) => `${key} (${words})`)
    .join(', ') +
  '. Give not_stated only when the page does not say how the place was found';

const BOUND =
  'only for a type whose takesInterval is true in list_vocabulary, and only when an excerpt ' +
  'states the day; write it as 2026-01-31';

const PUBLISHED_ON =
  'the day when the document was published, written as 2026-05-15, and at most one day after ' +
  'today in UTC, because an outlet at UTC+2 or UTC+3 publishes before UTC does. Give it when ' +
  'an excerpt writes a date with no year, such as "у ніч на 15 травня": the year is then the ' +
  'latest year that puts the day on or before this day. A year that the excerpt writes always ' +
  'wins. With no published_on, a date with no year is not stated, and the item is disputed. An ' +
  'item that takes a year from it is disputed too, and the review card says so: the operator ' +
  'decides it. An item value beats the value of the call';

/** Why the asset kind of an act is not a word of the closed list, or null. The check of a stated
 * value never reads the kind in the text, so the list is its only check. */
export const assetKindRefusal = (act: WriteRequest): string | null => {
  const attrs = 'attrs' in act ? act.attrs : undefined;
  const kind = attrs?.['asset_kind']?.v;
  if (kind === undefined) return null;
  // shortcut: an update_attrs does not read the type of its target, add it when one is wrong.
  if (act.op === 'create_entity' && act.type !== 'facility' && act.type !== 'port')
    return 'only a facility or a port has an asset_kind';
  return ASSET_KINDS.some((one) => one === kind)
    ? null
    : `asset_kind is one of: ${ASSET_KINDS.join(', ')}`;
};

const publishedOn = day.describe(PUBLISHED_ON);

// The latest publication day that a caller can give: tomorrow in UTC.
const latestPublishedOn = (): string =>
  new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const ENTITY_TYPE = 'the key of an entity type; list_vocabulary gives each one';

const RELATION_TYPE = 'the key of a relation type; list_vocabulary gives each one';

// The shape a caller sees. The real check is the write contract, after each ref becomes the
// identifier that code mints.
const batchAct = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('create_entity'),
    type: z.string().describe(ENTITY_TYPE),
    label: z.string().describe('the name of the entity, as the page writes it'),
    geom: z
      .unknown()
      .optional()
      .describe('a GeoJSON geometry, for example {"type": "Point", "coordinates": [lon, lat]}'),
    geomMethod: geolocationMethod.optional().describe(GEOLOCATION),
    attrs: attributeEdit.optional().describe(ATTRIBUTES),
  }),
  z.strictObject({
    op: z.literal('create_relation'),
    type: z.string().describe(RELATION_TYPE),
    srcKind: z.enum(['entity', 'relation']).optional(),
    srcId: z.string().describe(END),
    dstKind: z.enum(['entity', 'relation']).optional(),
    dstId: z.string().describe(END),
    validFrom: z.string().optional().describe(`the first day of the relation; ${BOUND}`),
    validTo: z.string().optional().describe(`the last day of the relation; ${BOUND}`),
    attrs: attributeEdit.optional().describe(ATTRIBUTES),
  }),
  z.strictObject({
    op: z.literal('update_attrs'),
    targetKind: z.enum(['entity', 'relation']),
    targetId: z.uuid(),
    attrs: attributeEdit.describe(ATTRIBUTES),
  }),
  z.strictObject({
    op: z.literal('update_entity'),
    targetId: z
      .uuid()
      .describe(
        'the id of the entity of the record, such as a port or a facility, or the proposal id ' +
          'of a new entity that waits in the review queue',
      ),
    geom: z
      .unknown()
      .describe(
        'the place of the entity, a GeoJSON geometry, for example {"type": "Point", ' +
          '"coordinates": [lon, lat]}; an excerpt must state it, such as the coordinates of a ' +
          'UN/LOCODE line or the Latitude and Longitude of a GEM row. To clear a place that has ' +
          'no good source, give null and no geomMethod, and cite the page that shows the old ' +
          'source is not good',
      ),
    geomMethod: geolocationMethod.optional().describe(GEOLOCATION),
  }),
  z.strictObject({
    op: z.literal('add_source'),
    targetId: z
      .uuid()
      .describe(
        'the id of the relation of the record that gets the cited documents as sources, such as ' +
          'a designated_by relation that cites the Federal Register. Its dates and its type ' +
          'stay as they are. With the modality denies, it can be the id of an event of the ' +
          'record: the denial goes to the occurred_at relation of that event',
      ),
  }),
  z
    .strictObject({
      op: z.literal('update_relation'),
      targetId: z
        .uuid()
        .describe(
          'the id of the relation of the record: a relation of a type whose takesInterval is ' +
            'true and that has no start (with validFrom) or no end (with validTo), or a ' +
            'designated_by relation (with type)',
        ),
      validFrom: z
        .string()
        .optional()
        .describe(
          'the start date form: the first day of the relation, on or before its last day, ' +
            'written as 2026-01-31; an excerpt must state it',
        ),
      validTo: z
        .string()
        .optional()
        .describe(
          'the end date form: the last day of the relation, on or after its first day, written ' +
            'as 2026-01-31; an excerpt must state it',
        ),
      type: z
        .literal('restricted_by')
        .optional()
        .describe(
          'the type form: the new type of a designated_by relation that states a sectoral ' +
            'measure. An excerpt must name the provision: the directive, the annex or the article',
        ),
    })
    .refine(
      (act) =>
        [act.validFrom, act.validTo, act.type].filter((one) => one !== undefined).length === 1,
      { message: 'give validFrom, validTo or type, and only one of them' },
    ),
]);

const evidence = z.strictObject({
  document: documentId,
  page: z.number().int().min(1).describe('the page of the stored text, from 1'),
  excerpt: z
    .string()
    .trim()
    .min(1)
    .max(MAX_EXCERPT)
    .describe('the words of the page, copied as they stand, that state the values of the act'),
  fromImage: z
    .boolean()
    .optional()
    .describe(
      'true when the document is a PNG or JPEG image and the excerpt gives the words that you ' +
        'read from the image, which its OCR text does not hold; the item is then disputed, so ' +
        'the operator compares the words with the image',
    ),
});

/** One item of a batch: one act, who first stated it, and the passages that state its values. */
export const proposeItem = z.strictObject({
  ref: localRef,
  act: batchAct,
  published_on: publishedOn.optional(),
  originator: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe('the party that first stated the claim, as the page names it'),
  modality: z
    .enum(MODALITIES)
    .describe(
      'how the page states the claim: enacts (the text makes it true, as a law), asserts (the ' +
        'author states it), attributes (the author reports what another party states), alleges ' +
        '(an accusation that is not proved), denies (the text says it is not true)',
    ),
  evidence: z.array(evidence).min(1).max(MAX_EVIDENCE),
});

/** One item of a batch, as a caller gives it. */
type ProposeItem = z.output<typeof proposeItem>;

const proposeItems = z.array(proposeItem).min(1).max(MAX_ITEMS);

const BATCH = `SELECT item, proposal_id::text AS proposal_id, written
  FROM public.propose_batch($1::jsonb) ORDER BY item`;

const doorRow = z.strictObject({
  item: z.number().int(),
  proposal_id: z.uuid(),
  written: z.boolean(),
});

// The newest set of text of the document, as the read tool chooses it.
// A copy of the FCDO list can hold another address, when its bytes were stored first by another
// tool. The UK tool then still gives the document its provider.
const PAGE = `SELECT t.extractor, t.text, EXISTS (SELECT 1 FROM public.documents d
      WHERE d.id = t.document_id AND (d.uri = $3::text OR d.provider_id = 'uk_sanctions_list'))
    AS fcdo_list,
    (SELECT d.uri FROM public.documents d WHERE d.id = t.document_id) AS uri
  FROM public.document_text t
  WHERE t.document_id = $1::text AND t.page = $2::int
    AND t.extractor = public.newest_text_extractor($1::text)`;

const pageRow = z.strictObject({
  extractor: z.string(),
  text: z.string(),
  fcdo_list: z.boolean(),
  uri: z.string().nullable(),
});

// The types of an image whose OCR text is the stored page; the door holds the same list.
const IMAGE = `SELECT 1 AS one FROM public.documents d
  WHERE d.id = $1::text AND lower(split_part(d.mime, ';', 1)) IN ('image/png', 'image/jpeg')`;

const TABLE = { entity: 'api.entity', relation: 'api.relation' } as const;

type Kind = keyof typeof TABLE;

const fieldOf = (cause: object): string =>
  'hint' in cause && typeof cause.hint === 'string' ? cause.hint : '';

// The door numbers the items from one, and the caller named each one by its ref. A rule of the
// record names the field of the act that the caller corrects.
const refusalOf = (cause: Error, refs: readonly string[]): string => {
  const field = fieldOf(cause);
  return cause.message.replace(/^item (\d+): /u, (_whole, number: string) => {
    const ref = refs[Number(number) - 1] ?? number;
    return field === '' ? `item ${ref}: ` : `item ${ref}: act.${field}: `;
  });
};

interface Cited {
  readonly document: string;
  /** The document is the FCDO UK Sanctions List. */
  readonly fcdoList: boolean;
  readonly textExtractor: string;
  /** The day in the path of the address of the document, when it holds one. */
  readonly urlDay: string | null;
  /** The day of the "Post date" line that opens the stored text of a Telegram post. */
  readonly postDay: string | null;
  readonly page: number;
  /** The place of the excerpt in the stored page, or null for words read from an image. */
  readonly span: Span | null;
  readonly passage: string;
  readonly context: string;
}

// The stored text of a Telegram post opens with this line (the tool telegram_channel writes it).
const postDayOf = (text: string): string | null =>
  /^Post date: (\d{4}-\d{2}-\d{2})/u.exec(text)?.[1] ?? null;

function refuse(ref: string, reason: string): never {
  throw new ToolRefusal(`item ${ref}: ${reason}`);
}

const pageOf = async (
  session: Session,
  ref: string,
  document: string,
  page: number,
): Promise<z.output<typeof pageRow>> => {
  const [found] = await rowsOf(session, pageRow, PAGE, [document, page, UK_LIST_CSV]);
  return found ?? refuse(ref, `document ${document} has no page ${String(page)} of stored text`);
};

const cite = async (
  session: Session,
  ref: string,
  given: z.output<typeof evidence>,
): Promise<Cited> => {
  const page = await pageOf(session, ref, given.document, given.page);
  if (given.fromImage === true) {
    const image = await rowsOf(session, z.strictObject({ one: z.number() }), IMAGE, [
      given.document,
    ]);
    if (image.length === 0)
      refuse(
        ref,
        `document ${given.document} is no PNG or JPEG image, so copy the excerpt from its text`,
      );
    // The words that the AI read stand alone: the OCR text around them does not hold them.
    return {
      document: given.document,
      fcdoList: page.fcdo_list,
      textExtractor: page.extractor,
      urlDay: dateInUrl(page.uri),
      postDay: postDayOf(page.text),
      page: given.page,
      span: null,
      passage: given.excerpt,
      context: given.excerpt,
    };
  }
  const span =
    findExcerpt(page.text, given.excerpt) ??
    refuse(
      ref,
      page.text.length > MAX_TOLERANT_UNITS
        ? `page ${String(given.page)} of ${given.document} holds more than ` +
            `${String(MAX_TOLERANT_UNITS)} characters, so only an exact copy of its words is ` +
            'found. Copy the excerpt character for character, with the quotes, the dashes and ' +
            'the spaces of the page.'
        : `page ${String(given.page)} of ${given.document} does not hold the excerpt ` +
            `${JSON.stringify(given.excerpt)}. Copy the words as the page states them.`,
    );
  return {
    document: given.document,
    fcdoList: page.fcdo_list,
    textExtractor: page.extractor,
    urlDay: dateInUrl(page.uri),
    postDay: postDayOf(page.text),
    page: given.page,
    span,
    passage: pointSlice(page.text, span.start, span.end),
    context: pointSlice(
      page.text,
      Math.max(0, span.start - CONTEXT_POINTS),
      span.end + CONTEXT_POINTS,
    ),
  };
};

interface Minted {
  readonly id: string;
  readonly kind: Kind | null;
  readonly index: number;
}

const KIND_OF_OP: Readonly<Record<string, Kind | null>> = {
  create_entity: 'entity',
  create_relation: 'relation',
  update_attrs: null,
  update_relation: null,
  add_source: null,
  update_entity: null,
};

const present = async (session: Session, kind: Kind, id: string): Promise<boolean> =>
  (
    await rowsOf(
      session,
      z.strictObject({ id: z.string() }),
      `SELECT id::text AS id FROM ${TABLE[kind]} WHERE id = $1`,
      [id],
    )
  ).length === 1;

// A new entity that waits in the review queue. A relation to it joins its unit.
const PENDING_ENTITY = `SELECT payload->>'type' AS type FROM api.proposal
  WHERE id = $1 AND status = 'pending' AND op = 'create_entity'`;

const pendingEntityType = async (session: Session, id: string): Promise<string | null> => {
  const [found] = await rowsOf(session, z.strictObject({ type: z.string() }), PENDING_ENTITY, [id]);
  return found?.type ?? null;
};

// Where an end stands: in the record, in this batch, or in the review queue.
interface End {
  readonly id: string;
  readonly stands: 'record' | 'batch' | 'queue';
  readonly kind: Kind;
}

// An end is an element of the record, a new entity that waits in the queue, or a creation of an
// earlier item. The promotion fails on an end that does not exist, after the proposal is stored,
// so the check runs here.
const resolvedEnd = async (
  session: Session,
  ref: string,
  index: number,
  given: string,
  kind: Kind,
  minted: ReadonlyMap<string, Minted>,
): Promise<End> => {
  const named = minted.get(given);
  if (named !== undefined) {
    if (named.index >= index) refuse(ref, `it names ${given}, which stands after it in the batch`);
    if (named.kind !== kind) refuse(ref, `it names ${given} as ${kind}, and ${given} creates none`);
    return { id: named.id, stands: 'batch', kind };
  }
  if (!z.uuid().safeParse(given).success) refuse(ref, `${given} is no ref of this batch and no id`);
  if (await present(session, kind, given)) return { id: given, stands: 'record', kind };
  if (kind === 'entity' && (await pendingEntityType(session, given)) !== null)
    return { id: given, stands: 'queue', kind };
  refuse(ref, `the ${kind} ${given} does not exist`);
};

// A relation to a new entity that waits joins the unit of that entity only when its other end is
// an entity of the record. Any other relation to it would wait in a unit of its own.
const checkQueuedEnds = (ref: string, src: End, dst: End): void => {
  for (const [end, other] of [
    [src, dst],
    [dst, src],
  ] as const) {
    if (end.stands === 'queue' && !(other.stands === 'record' && other.kind === 'entity'))
      refuse(
        ref,
        `the new entity ${end.id} waits in the review queue, so the other end of the relation ` +
          'must be an entity of the record',
      );
  }
};

const resolvedAct = async (
  session: Session,
  given: ProposeItem,
  index: number,
  minted: ReadonlyMap<string, Minted>,
): Promise<WriteRequest> => {
  const { act } = given;
  let raw: unknown = act;
  if (act.op === 'add_source')
    raw = { op: 'update_relation', targetId: act.targetId, addSource: true };
  if (act.op === 'create_relation') {
    const src = await resolvedEnd(
      session,
      given.ref,
      index,
      act.srcId,
      act.srcKind ?? 'entity',
      minted,
    );
    const dst = await resolvedEnd(
      session,
      given.ref,
      index,
      act.dstId,
      act.dstKind ?? 'entity',
      minted,
    );
    checkQueuedEnds(given.ref, src, dst);
    raw = { ...act, srcId: src.id, dstId: dst.id };
  }
  // A machine gives a place with its method. The door of the operator takes `not_stated` for a
  // place with no method, and a machine does not get that default: the record must know whether
  // the page says how it found the place.
  if (
    (act.op === 'create_entity' || act.op === 'update_entity') &&
    act.geom !== undefined &&
    act.geom !== null &&
    act.geomMethod === undefined
  )
    refuse(
      given.ref,
      `a geom needs geomMethod, one of ${Object.keys(GEOLOCATION_WORDS).join(', ')}`,
    );
  const parsed = writeRequest.safeParse(raw);
  if (!parsed.success)
    refuse(given.ref, parsed.error.issues.map((issue) => issue.message).join('; '));
  return parsed.data;
};

const EVENT_SITES = `SELECT r.id::text AS id FROM api.relation r JOIN api.entity e
    ON r.src_kind = 'entity' AND e.id = r.src_id AND e.type = 'event'
  WHERE r.type = 'occurred_at' AND e.id = $1 ORDER BY r.id`;

// A denial of an event of the record is a denying source of its occurred_at relation: the event has
// no source list of its own that a denial could join. The caller names the event, and the act goes
// to the one relation of the record that places it.
const eventDenialOnRelation = async (
  session: Session,
  given: ProposeItem,
): Promise<ProposeItem> => {
  const { act } = given;
  if (act.op !== 'add_source' || given.modality !== 'denies') return given;
  if (await present(session, 'relation', act.targetId)) return given;
  const sites = await rowsOf(session, z.strictObject({ id: z.string() }), EVENT_SITES, [
    act.targetId,
  ]);
  const [site] = sites;
  if (site === undefined) {
    if (await present(session, 'entity', act.targetId))
      refuse(
        given.ref,
        `the entity ${act.targetId} has no occurred_at relation of the record, so a denial waits ` +
          'until the operator accepts that relation',
      );
    return given;
  }
  if (sites.length > 1)
    refuse(
      given.ref,
      `the event ${act.targetId} has ${String(sites.length)} occurred_at relations, so name the ` +
        `one that the passage denies: ${sites.map((one) => one.id).join(', ')}`,
    );
  return { ...given, act: { ...act, targetId: site.id } };
};

const SAME_PLACE = `SELECT public.ST_Equals(public.ST_GeomFromGeoJSON(e.geom::text),
    public.ST_GeomFromGeoJSON($2::text)) AS same
  FROM api.entity e WHERE e.id = $1 AND e.geom IS NOT NULL`;

const HAS_PLACE = `SELECT 1 AS n FROM api.entity e WHERE e.id = $1 AND e.geom IS NOT NULL`;

// A new entity that waits with no place: a clear of its place would change nothing.
const queuedWithNoPlace = async (session: Session, id: string): Promise<boolean> =>
  (
    await rowsOf(
      session,
      z.strictObject({ n: z.number() }),
      `SELECT 1 AS n FROM api.proposal p
        WHERE p.id = $1 AND p.status = 'pending' AND p.op = 'create_entity' AND NOT p.payload ? 'geom'`,
      [id],
    )
  ).length > 0;

const checkTarget = async (session: Session, ref: string, act: WriteRequest): Promise<void> => {
  if (act.op !== 'update_attrs' && act.op !== 'update_relation' && act.op !== 'update_entity')
    return;
  const kind =
    act.op === 'update_attrs' ? act.targetKind : act.op === 'update_entity' ? 'entity' : 'relation';
  if (!(await present(session, kind, act.targetId))) {
    if (kind === 'entity' && (await pendingEntityType(session, act.targetId)) !== null) {
      // A place joins the unit of the new entity, and the database refuses the place that the
      // unit gives already. Any other act would stay outside that unit, so the agent waits.
      if (
        act.op === 'update_entity' &&
        act.geom === null &&
        (await queuedWithNoPlace(session, act.targetId))
      )
        refuse(ref, `the new entity ${act.targetId} has no place to clear`);
      if (act.op === 'update_entity' && act.geom !== undefined) return;
      refuse(
        ref,
        `the new entity ${act.targetId} waits in the review queue: propose its attributes after ` +
          'the operator accepts it, or give them in its create_entity',
      );
    }
    refuse(ref, `the target ${act.targetId} does not exist`);
  }
  // The promotion refuses an act that changes nothing, so the same place would wait for ever.
  if (act.op === 'update_entity' && act.geom === null) {
    const [held] = await rowsOf(session, z.strictObject({ n: z.number() }), HAS_PLACE, [
      act.targetId,
    ]);
    if (held === undefined && (await present(session, 'entity', act.targetId)))
      refuse(ref, `the entity ${act.targetId} has no place to clear`);
  } else if (act.op === 'update_entity' && act.geom !== undefined) {
    const [same] = await rowsOf(session, z.strictObject({ same: z.boolean() }), SAME_PLACE, [
      act.targetId,
      JSON.stringify(act.geom),
    ]);
    if (same?.same === true) refuse(ref, `the entity ${act.targetId} has this place already`);
  }
};

// The checker reads no record, so an act that ends a relation names that relation in the words
// of the vocabulary. The tool roles read the views and not the name function of the review.
const RELATION_WORDS = `SELECT concat_ws(' ', coalesce(s.label, 'an element'),
    coalesce(t.label, r.type), coalesce(d.label, 'an element')) AS words
  FROM api.relation r
  LEFT JOIN api.relation_type t ON t.key = r.type
  LEFT JOIN api.entity s ON r.src_kind = 'entity' AND s.id = r.src_id
  LEFT JOIN api.entity d ON r.dst_kind = 'entity' AND d.id = r.dst_id
  WHERE r.id = $1`;

// The type of the entity that an end of a relation names: the type of an earlier item of the batch,
// the type that the record holds, or the type of a new entity that waits in the queue. An end that
// is no entity has none.
const endType = async (
  session: Session,
  given: string,
  kind: Kind,
  created: ReadonlyMap<string, string>,
): Promise<string | null> => {
  if (kind !== 'entity') return null;
  const named = created.get(given);
  if (named !== undefined) return named;
  const [found] = await rowsOf(
    session,
    z.strictObject({ type: z.string() }),
    'SELECT type FROM api.entity WHERE id = $1',
    [given],
  );
  return found?.type ?? (await pendingEntityType(session, given));
};

// A relation of an event reaches the types that its rule names. The end of a relation can be an
// entity that an earlier item creates, so the check runs on the types of the batch too.
const checkEventEnds = async (
  session: Session,
  given: ProposeItem,
  created: ReadonlyMap<string, string>,
): Promise<void> => {
  const { act } = given;
  if (act.op !== 'create_relation') return;
  const refusal = eventEndsRefusal(
    act.type,
    await endType(session, act.srcId, act.srcKind ?? 'entity', created),
    await endType(session, act.dstId, act.dstKind ?? 'entity', created),
  );
  if (refusal !== null) refuse(given.ref, refusal);
};

const claimActOf = async (
  session: Session,
  act: ProposeItem['act'],
  dropped: readonly DroppedName[],
): Promise<unknown> => {
  if (act.op === 'create_relation')
    return withoutBounds(dropped.includes('observed_on') ? withoutCallDay(act) : act, dropped);
  if (act.op === 'update_entity') {
    // A new entity that waits in the queue has its name in its proposal.
    const [named] = await rowsOf(
      session,
      z.strictObject({ label: z.string() }),
      `SELECT label FROM api.entity WHERE id = $1
       UNION ALL
       SELECT payload->>'label' FROM api.proposal
        WHERE id = $1 AND status = 'pending' AND op = 'create_entity'`,
      [act.targetId],
    );
    return { ...act, entity: named?.label ?? null };
  }
  if (act.op !== 'update_relation' && act.op !== 'add_source') return act;
  const [named] = await rowsOf(session, z.strictObject({ words: z.string() }), RELATION_WORDS, [
    act.targetId,
  ]);
  return { ...act, relation: named?.words ?? null };
};

// The IMO number of the source end of a relation, and each name of both ends: the label, the
// Cyrillic label and the aliases. An attribute holds one text or a list of texts.
const SOURCE_NAMES = `SELECT s.attrs->'imo'->>'v' AS imo, n.name
  FROM api.relation r
  LEFT JOIN api.entity s ON r.src_kind = 'entity' AND s.id = r.src_id
  LEFT JOIN api.entity d ON r.dst_kind = 'entity' AND d.id = r.dst_id
  CROSS JOIN LATERAL (VALUES (s.label, s.attrs), (d.label, d.attrs)) AS ends(label, attrs)
  CROSS JOIN LATERAL (
    SELECT ends.label AS name
    UNION ALL
    SELECT v.value #>> '{}'
      FROM unnest(ARRAY['aliases', 'label_cyrillic']) AS k(key)
     CROSS JOIN LATERAL jsonb_array_elements(
             CASE WHEN jsonb_typeof(ends.attrs->k.key->'v') = 'array' THEN ends.attrs->k.key->'v'
                  ELSE jsonb_build_array(ends.attrs->k.key->'v') END) AS v(value)
     WHERE jsonb_typeof(v.value) = 'string'
  ) AS n
  WHERE r.id = $1`;

const squeezed = (text: string): string => text.replace(/\s+/gu, ' ').trim().toLowerCase();

// A name under this length is too short to prove that an excerpt is about the relation.
const MIN_NAME = 4;

// A source added to a relation must be about that relation: an excerpt that names neither the
// IMO number of the source end nor a name of either end would add a document that says nothing of it.
const checkSourceNames = async (
  session: Session,
  ref: string,
  targetId: string,
  cited: readonly Cited[],
): Promise<void> => {
  const rows = await rowsOf(
    session,
    z.strictObject({ imo: z.string().nullable(), name: z.string().nullable() }),
    SOURCE_NAMES,
    [targetId],
  );
  const imo = /(?<!\d)\d{7}(?!\d)/u.exec(rows[0]?.imo ?? '')?.[0];
  const names = [...new Set(rows.map((row) => squeezed(row.name ?? '')))].filter(
    (name) => name.length >= MIN_NAME,
  );
  // Each cited document must name an end: one good line must not carry another.
  const namesIt = (document: string): boolean => {
    const text = squeezed(
      cited
        .filter((one) => one.document === document)
        .map((one) => one.passage)
        .join(' '),
    );
    return (imo !== undefined && text.includes(imo)) || names.some((name) => text.includes(name));
  };
  if ([...new Set(cited.map((one) => one.document))].every(namesIt)) return;
  refuse(
    ref,
    'no excerpt of a cited document names an end of the relation by the IMO number of the source ' +
      `end${imo === undefined ? ' (it has none in the record)' : ` ${imo}`} or by one of these ` +
      `names: ${names.length === 0 ? '(the record holds no name of 4 characters or more)' : names.map((name) => JSON.stringify(name)).join(', ')}: ` +
      'cite the passage that names one of them',
  );
};

type UnstatedValue = ReturnType<typeof unstatedValues>[number];

// Origin: the length that the record keeps. A longer reason is cut, so a long answer of the
// checker never refuses the batch.
const MAX_REASON = 1000;

// The checker names an item by its ref, and the record keeps no ref. A ref with a digit or an
// underscore is no word of a sentence, so it gives way to the name of the entity of its item.
const namedRefs = (reason: string, names: ReadonlyMap<string, string>): string =>
  reason.replace(/\b[a-z][a-z0-9_]*\b/gu, (word) =>
    /[\d_]/u.test(word) ? (names.get(word) ?? word) : word,
  );

// Why an item is disputed, in the words that the review card shows, or null when nothing disputes
// it. No answer of the checker on an item disputes it: a failure never lets an item pass.
const disputeReason = (
  transcribed: boolean,
  unstated: readonly UnstatedValue[],
  lostBound: LostBound | null,
  lostProvision: boolean,
  deduced: string | null,
  verdict: CheckVerdict | 'unchecked' | undefined,
  names: ReadonlyMap<string, string>,
): string | null => {
  const parts: string[] = [];
  if (transcribed)
    parts.push('an excerpt is read from the image by the AI: compare its words with the image');
  if (unstated.length > 0)
    parts.push(
      `no cited passage states ${unstated
        .map((one) => `${one.name} ${JSON.stringify(one.value)}`)
        .join(', ')}`,
    );
  if (lostBound !== null)
    parts.push(`the ${lostBound.word} date ${lostBound.day} is in no excerpt`);
  if (lostProvision) parts.push('no excerpt names the provision that states the measure');
  if (deduced !== null) parts.push(`year deduced from the publication of ${deduced}`);
  if (verdict === undefined) parts.push('the checker did not answer');
  else if (verdict !== 'unchecked' && verdict.verdict !== 'supported')
    parts.push(
      verdict.reason.trim() === ''
        ? `the checker says ${verdict.verdict}`
        : `the checker says ${verdict.verdict}: ${namedRefs(verdict.reason.trim(), names)}`,
    );
  if (parts.length === 0) return null;
  // The reason of the checker can echo the text of the page. A control character (a NUL refuses
  // the whole batch at the door) becomes a space, so the record keeps one line of plain text.
  const plain = plainText(parts.join('; '));
  return Array.from(plain).slice(0, MAX_REASON).join('');
};

// A bound that the act cannot lose: the end of a new relation, and the start or the end that an act
// gives to a relation of the record.
interface LostBound {
  readonly name: BoundName;
  readonly word: 'start' | 'end';
  readonly day: string;
}

const lostBoundOf = (act: WriteRequest, dropped: readonly BoundName[]): LostBound | null => {
  if (act.op !== 'create_relation' && act.op !== 'update_relation') return null;
  if (act.validTo !== undefined && dropped.includes('validTo'))
    return { name: 'validTo', word: 'end', day: act.validTo };
  if (act.op === 'update_relation' && act.validFrom !== undefined && dropped.includes('validFrom'))
    return { name: 'validFrom', word: 'start', day: act.validFrom };
  return null;
};

// One item of the batch, ready for the check and the write.
interface Prepared {
  readonly given: ProposeItem;
  readonly act: ProposalAct;
  /** The act that the checker reads: the act that is written, in words where it names a row. */
  readonly claimAct: unknown;
  readonly cited: readonly Cited[];
  readonly unstated: readonly UnstatedValue[];
  readonly dropped: DroppedName[];
  readonly lostBound: LostBound | null;
  readonly lostProvision: boolean;
  /** The publication day, when the year of a day of the act comes from it. */
  readonly deduced: string | null;
  /** The day of publication that the caller gave for the item, or null. */
  readonly published: string | null;
  readonly transcribed: boolean;
  readonly id: string | undefined;
}

const outcome = z.strictObject({
  ref: z.string(),
  proposalId: z.uuid(),
  written: z.boolean(),
  disputed: z.boolean(),
  unstated: z.array(z.string()),
  // The bounds of a relation that no cited passage states. Code did not propose them.
  droppedBounds: z.array(z.enum(['validFrom', 'validTo', 'observed_on'])),
});

/** The propose tool. A back-end agent gives the model call of each batch, which is known to its
 * runner alone, so it is no input that a caller gives. The research AI gives null. */
export const proposeOf = (modelCallId: string | null) =>
  defineTool({
    name: 'propose',
    description:
      'Proposes a batch of linked facts: new entities, new relations, attributes to add, and the ' +
      'end date of an open relation of the record (update_relation, when a page states that an ' +
      'owner, a flag, an operator or an insurer changed), or the start date of a relation of the ' +
      'record that has none (update_relation with validFrom, when a dated page states it), and one ' +
      'more cited source for a relation of the record (add_source: the cited documents join the ' +
      'sources of the relation, and its dates and its type stay; an excerpt must name the vessel ' +
      'by its IMO number or the act, and a relation that cites these documents already is ' +
      'refused), and the ' +
      'place of an entity of the record (update_entity with geom, when a page states its ' +
      'coordinates; every geom needs geomMethod, the closed list of the methods that found the ' +
      'place, and the tool refuses a geom with no method; the tool refuses the place that the entity has already, and a place that ' +
      'differs from the place that the record holds waits as a doubt for the operator; give the ' +
      'place of a new entity as geom in its create_entity. The place of a new entity that waits ' +
      'in the review queue names its proposal id as targetId: it joins the unit of that entity, ' +
      'and a rejection of the entity rejects it. The tool refuses new attributes for such an ' +
      'entity). Each ' +
      'item gives the act, the party that first stated it, how the page states it, and for its ' +
      'values the page and an excerpt copied word for word from the stored text. Code finds each ' +
      'excerpt in the page and refuses the whole batch when one is not there; the refusal names ' +
      'the item. For a PNG or JPEG document whose OCR text misreads the image, give the words ' +
      'that you read from the image with fromImage: true; code then marks the item as disputed, ' +
      'so the operator compares the words with the image. A value that no excerpt states marks the item as disputed. A start ' +
      '(validFrom) of a relation that no excerpt states is not proposed, and droppedBounds names ' +
      'it; an end (validTo) that no excerpt states refuses the batch, and so does the start of ' +
      'update_relation. The record refuses an end date on a relation that ended already, on a ' +
      'type that takes no interval, and before the first day. It refuses a start date on a ' +
      'relation that has one, on a type that takes no interval, and after the last day. A type change (type: restricted_by) turns a designated_by relation that states ' +
      'a sectoral measure into a restricted_by relation: an excerpt must name the provision, and ' +
      'the record refuses it on another type and on a twin that is open. Before the write, a ' +
      'model of another family reads each item with its passages, and an item that its passages ' +
      'do not support is marked as disputed. When no model could check the batch, checkFailure ' +
      'says why: the items wait with no check, and the same batch sent again is checked again. A ' +
      'relation names an entity of an earlier item by its ref. A relation can name a new ' +
      'entity that waits in the review queue by its proposal id when its other end is an ' +
      'entity of the record: it joins the unit of that entity, and a rejection of the entity ' +
      'rejects it. A retry of the same batch writes ' +
      'nothing twice. Send a pending item again to check it again: the code and the checker of ' +
      'today give it a new dispute, or clear its dispute, and the act keeps its id; a decided ' +
      'act never changes. The ' +
      'proposals wait for the operator. A claimed strike, a fire or a stoppage is an entity of ' +
      'type event. Its name is "kind — site — day", for example "claimed attack — Afipsky ' +
      'refinery — 2026-05-15", where the kind is claimed attack, fire or stoppage and the site is ' +
      'the name of the installation as the record holds it (or the place as the source writes ' +
      'it, when no site is named). It has the attributes event_kind, occurred_on (a list of ' +
      'days: one day, or the two days of a night) and occurred_on_precision (day, night or ' +
      'month); the day of the name is the last day. Link it with occurred_at (to a facility, a ' +
      'port or a vessel) and carried_out_by (to a military unit or a state body). A denial is ' +
      'the modality denies on the same name. The attribute asset_kind of a facility or a port is ' +
      `one of ${ASSET_KINDS.join(', ')}; no passage needs to write the word. ` +
      'First call search_graph with each identifier, and ' +
      'list_proposals for the document, so you propose no fact that the record or the queue ' +
      'already holds. Give published_on for an excerpt that writes a date with no year. A port ' +
      'call (berthed_at, loads_at, discharges_at) takes the day of the call as the attribute ' +
      'observed_on, written as 2026-01-31, only when an excerpt states that exact day; two calls ' +
      'on two days are two facts. A day that no excerpt states, or a value that is not one day, ' +
      'is not proposed, and droppedBounds names it.',
    input: z.strictObject({ items: proposeItems, published_on: publishedOn.optional() }),
    output: z.strictObject({
      proposals: z.array(outcome),
      // Why no model checked the batch. The items then wait, and the same batch can be sent again.
      checkFailure: z.string().optional(),
    }),
    async run(session, input, reach) {
      const resolvedItems: ProposeItem[] = [];
      for (const given of input.items)
        resolvedItems.push(await eventDenialOnRelation(session, given));
      const minted = new Map<string, Minted>();
      resolvedItems.forEach((given, index) => {
        if (minted.has(given.ref)) refuse(given.ref, 'two items of the batch have this ref');
        minted.set(given.ref, { id: randomUUID(), kind: KIND_OF_OP[given.act.op] ?? null, index });
      });

      const created = new Map(
        resolvedItems.flatMap((given) =>
          given.act.op === 'create_entity' ? [[given.ref, given.act.type] as const] : [],
        ),
      );
      const prepared: Prepared[] = [];
      for (const [index, given] of resolvedItems.entries()) {
        const resolved = withCodedJurisdiction(await resolvedAct(session, given, index, minted));
        const eventFault = eventActRefusal(resolved);
        if (eventFault !== null) refuse(given.ref, eventFault);
        const kindFault = assetKindRefusal(resolved);
        if (kindFault !== null) refuse(given.ref, kindFault);
        await checkEventEnds(session, given, created);
        // A back-end agent reads the stored text only, so it never gives words read from an image.
        if (modelCallId !== null && given.evidence.some((one) => one.fromImage === true))
          refuse(given.ref, 'an agent cites the stored text, and never words read from an image');
        const cited: Cited[] = [];
        for (const one of given.evidence) cited.push(await cite(session, given.ref, one));
        // The post date of a stored Telegram post is the day of publication of the document.
        const published =
          given.published_on ??
          input.published_on ??
          cited.find((one) => one.postDay !== null)?.postDay ??
          undefined;
        if (published !== undefined && published > latestPublishedOn())
          refuse(given.ref, `published_on ${published} is in the future`);
        const documents = [...new Set(cited.map((one) => one.document))];
        const passages = cited.map((one) => one.passage);
        // A start or an end of a relation comes from a cited passage, or it is not proposed.
        // The FCDO list writes each date as day/month/year (ADR 0024).
        const dayFirst = cited.every((one) => one.fcdoList);
        const stating = { publishedOn: published, dayFirst };
        const { act: bounded, dropped: droppedBounds } = statedBounds(resolved, passages, stating);
        // The day of a port call enters its claim key, so it is one real day that a passage
        // states, or it is not proposed. The call then has the key of a call with no day.
        const lostDay = unstatedCallDay(bounded, passages, stating);
        const request = lostDay ? withoutCallDay(bounded) : bounded;
        const dropped: DroppedName[] = [
          ...droppedBounds,
          ...(lostDay ? (['observed_on'] as const) : []),
        ];
        // An end that is not proposed makes an ended relation look current, and a start or an end
        // that is the whole act has no value that a passage states. The research AI can cite the
        // passage that states it, so its batch is refused. An agent cannot, so its item is
        // disputed and the operator reads the page.
        const lostBound = lostBoundOf(resolved, droppedBounds);
        // A type change rests on the provision that states the measure. The research AI cites the
        // passage that names it, so its batch is refused. An agent cannot, so its item is
        // disputed and the operator reads the page.
        const lostProvision =
          resolved.op === 'update_relation' &&
          resolved.type !== undefined &&
          !namesProvision(passages);
        if (lostProvision && modelCallId === null)
          refuse(
            given.ref,
            'no excerpt names the provision (the directive, the annex or the article) that ' +
              'states the measure: cite the passage that names it',
          );
        if (lostBound !== null && modelCallId === null)
          refuse(
            given.ref,
            `no excerpt states the ${lostBound.word} date ${lostBound.day} (${lostBound.name}): ` +
              `cite the passage that states it, or give no ${lostBound.name}`,
          );
        await checkTarget(session, given.ref, request);
        if (given.act.op === 'add_source')
          await checkSourceNames(session, given.ref, given.act.targetId, cited);
        const act = machineAct(request, documents);
        const unstated = unstatedValues(request, passages, stating);
        const deduced =
          published !== undefined &&
          daysFromPublication(request, passages, published, dayFirst).length > 0
            ? published
            : null;
        const transcribed = cited.some((one) => one.span === null);
        prepared.push({
          given,
          act,
          claimAct: await claimActOf(
            session,
            // The checker reads the act that is written, so it reads the coded jurisdiction.
            withCodedJurisdiction(given.act),
            dropped,
          ),
          cited,
          unstated,
          // The date of an act on a relation of the record stays in its act, so code removed no
          // bound of it.
          dropped: resolved.op === 'update_relation' ? [] : dropped,
          lostBound,
          lostProvision,
          deduced,
          published: published ?? null,
          transcribed,
          id: minted.get(given.ref)?.id,
        });
      }

      // The check runs before the insert, because the door writes the dispute with the act. An
      // item that repeats a pending act gives the act its new dispute, when a check ran.
      const toCheck: ItemToCheck[] = prepared.map(({ given, cited, claimAct, published }) => ({
        ref: given.ref,
        claim: {
          // The checker reads the act that is written, so a dropped bound is not in the claim.
          act: claimAct,
          originator: given.originator,
          modality: given.modality,
          // A passage that gives a weekday only is read with these two values.
          occurredOnWeekdays: occurredWeekdays(claimAct),
        },
        passages: cited.map((one) => ({
          document: one.document,
          page: one.page,
          excerpt: one.passage,
          context: one.context,
          // The day that the caller gave comes first, then the day in the address.
          publishedOn: published ?? one.urlDay,
        })),
      }));
      let verdicts: ReadonlyMap<string, CheckVerdict> | null = null;
      let failure: string | null = null;
      if (reach?.check !== undefined)
        try {
          verdicts = await reach.check(toCheck);
        } catch (cause) {
          if (!(cause instanceof CheckFailure)) throw cause;
          verdicts = new Map();
          failure = cause.message;
        }
      const names = new Map(
        input.items.flatMap((given) =>
          given.act.op === 'create_entity' ? [[given.ref, given.act.label] as const] : [],
        ),
      );
      // Under the mark `refuted`, only a verdict that the passage does not support disputes an
      // item. Any other item with no `supported` verdict waits, with no dispute and no check.
      const verdictOf = (ref: string): CheckVerdict | 'unchecked' | undefined => {
        if (verdicts === null) return 'unchecked';
        const said = verdicts.get(ref);
        if (reach?.checkMarks !== 'refuted') return said;
        return said?.verdict === 'not_supported' ? said : 'unchecked';
      };
      const reasonOf = (one: Prepared): string | null =>
        disputeReason(
          one.transcribed,
          one.unstated,
          one.lostBound,
          one.lostProvision,
          one.deduced,
          verdictOf(one.given.ref),
          names,
        );

      const items = prepared.map((one) => {
        const { given, act, cited, id } = one;
        const reason = reasonOf(one);
        return {
          id,
          op: act.op,
          payload: act.payload,
          src: act.src,
          target_kind: act.targetKind,
          target_id: act.targetId,
          names: act.names,
          dissent: reason !== null,
          dissent_reason: reason,
          // An item with no verdict (a checker that failed or left it out) gives no new
          // dispute, so the act that waits keeps its dispute and its check.
          recheck: verdicts?.has(given.ref) === true,
          model_call_id: modelCallId,
          originator: given.originator,
          modality: given.modality,
          citations: cited.map((one) => ({
            document: one.document,
            text_extractor: one.textExtractor,
            page: one.page,
            ...(one.span === null
              ? { transcription: one.passage }
              : { start: one.span.start, end: one.span.end }),
          })),
        };
      });

      let rows: z.output<typeof doorRow>[];
      try {
        rows = await rowsOf(session, doorRow, BATCH, [JSON.stringify(items)]);
      } catch (cause) {
        if (isDoorRefusal(cause))
          throw new ToolRefusal(
            refusalOf(
              cause,
              input.items.map((given) => given.ref),
            ),
          );
        throw cause;
      }

      return {
        proposals: prepared.map((one, index) => {
          const { given, unstated, dropped } = one;
          const row = rows.find((one) => one.item === index + 1);
          if (row === undefined) throw new Error(`the door returned no proposal for ${given.ref}`);
          return {
            ref: given.ref,
            proposalId: row.proposal_id,
            written: row.written,
            disputed: reasonOf(one) !== null,
            unstated: [...new Set(unstated.map((one) => one.name))],
            droppedBounds: dropped,
          };
        }),
        ...(failure === null ? {} : { checkFailure: failure }),
      };
    },
  });

/** The propose tool of the research AI. */
export const propose = proposeOf(null);
