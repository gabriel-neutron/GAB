import { randomUUID } from 'node:crypto';

import { attributeEdit } from '@gab/proposal/attribute-value';
import { machineAct } from '@gab/proposal/machine';
import type { ProposalAct } from '@gab/proposal/payload';
import { writeRequest, type WriteRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { plainText } from './check-answer.ts';
import { eventActRefusal, eventEndsRefusal } from './event-rules.ts';
import { findExcerpt, type Span } from './excerpt.ts';
import { documentId, isDoorRefusal, rowsOf } from './fields.ts';
import {
  daysFromPublication,
  namesProvision,
  statedBounds,
  unstatedValues,
  withCodedJurisdiction,
  withoutBounds,
  type BoundName,
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

const END = 'the id of an element of the record, or the ref of an earlier item of this batch';

const ATTRIBUTES =
  'write each attribute as {"key": {"v": value}}, for example {"imo": {"v": "9074729"}}; a ' +
  'value is a text, a number, true or false, or a flat list of them; a key is lower case words ' +
  'joined by one underscore, with the unit in the key, as capacity_dwt';

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

const publishedOn = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'a day is written as 2026-05-15')
  .refine((day) => new Date(`${day}T00:00:00Z`).toISOString().startsWith(day), {
    message: 'published_on is no day of the calendar',
  })
  .describe(PUBLISHED_ON);

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
    AS fcdo_list
  FROM public.document_text t
  WHERE t.document_id = $1::text AND t.page = $2::int
    AND t.extractor = public.newest_text_extractor($1::text)`;

const pageRow = z.strictObject({ extractor: z.string(), text: z.string(), fcdo_list: z.boolean() });

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
  readonly page: number;
  /** The place of the excerpt in the stored page, or null for words read from an image. */
  readonly span: Span | null;
  readonly passage: string;
  readonly context: string;
}

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
      `page ${String(given.page)} of ${given.document} does not hold the excerpt ` +
        `${JSON.stringify(given.excerpt)}. Copy the words as the page states them.`,
    );
  const points = Array.from(page.text);
  return {
    document: given.document,
    fcdoList: page.fcdo_list,
    textExtractor: page.extractor,
    page: given.page,
    span,
    passage: points.slice(span.start, span.end).join(''),
    context: points
      .slice(Math.max(0, span.start - CONTEXT_POINTS), span.end + CONTEXT_POINTS)
      .join(''),
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

// An end is an element of the record or a creation of an earlier item. The promotion fails on an
// end that does not exist, after the proposal is stored, so the check runs here.
const resolvedEnd = async (
  session: Session,
  ref: string,
  index: number,
  given: string,
  kind: Kind,
  minted: ReadonlyMap<string, Minted>,
): Promise<string> => {
  const named = minted.get(given);
  if (named !== undefined) {
    if (named.index >= index) refuse(ref, `it names ${given}, which stands after it in the batch`);
    if (named.kind !== kind) refuse(ref, `it names ${given} as ${kind}, and ${given} creates none`);
    return named.id;
  }
  if (!z.uuid().safeParse(given).success) refuse(ref, `${given} is no ref of this batch and no id`);
  if (!(await present(session, kind, given))) refuse(ref, `the ${kind} ${given} does not exist`);
  return given;
};

const resolvedAct = async (
  session: Session,
  given: ProposeItem,
  index: number,
  minted: ReadonlyMap<string, Minted>,
): Promise<WriteRequest> => {
  const { act } = given;
  const raw =
    act.op === 'create_relation'
      ? {
          ...act,
          srcId: await resolvedEnd(
            session,
            given.ref,
            index,
            act.srcId,
            act.srcKind ?? 'entity',
            minted,
          ),
          dstId: await resolvedEnd(
            session,
            given.ref,
            index,
            act.dstId,
            act.dstKind ?? 'entity',
            minted,
          ),
        }
      : act;
  const parsed = writeRequest.safeParse(raw);
  if (!parsed.success)
    refuse(given.ref, parsed.error.issues.map((issue) => issue.message).join('; '));
  return parsed.data;
};

const checkTarget = async (session: Session, ref: string, act: WriteRequest): Promise<void> => {
  if (act.op !== 'update_attrs' && act.op !== 'update_relation') return;
  const kind = act.op === 'update_attrs' ? act.targetKind : 'relation';
  if (!(await present(session, kind, act.targetId)))
    refuse(ref, `the target ${act.targetId} does not exist`);
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
// or the type that the record holds. An end that is no entity has none.
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
  return found?.type ?? null;
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
  dropped: readonly BoundName[],
): Promise<unknown> => {
  if (act.op === 'create_relation') return withoutBounds(act, dropped);
  if (act.op !== 'update_relation') return act;
  const [named] = await rowsOf(session, z.strictObject({ words: z.string() }), RELATION_WORDS, [
    act.targetId,
  ]);
  return { ...act, relation: named?.words ?? null };
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
  readonly dropped: BoundName[];
  readonly lostBound: LostBound | null;
  readonly lostProvision: boolean;
  /** The publication day, when the year of a day of the act comes from it. */
  readonly deduced: string | null;
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
  droppedBounds: z.array(z.enum(['validFrom', 'validTo'])),
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
      'record that has none (update_relation with validFrom, when a dated page states it). Each ' +
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
      'relation names an entity of an earlier item by its ref. A retry of the same batch writes ' +
      'nothing twice. The ' +
      'proposals wait for the operator. A claimed strike, a fire or a stoppage is an entity of ' +
      'type event. Its name is "kind — site — day", for example "claimed attack — Afipsky ' +
      'refinery — 2026-05-15", where the kind is claimed attack, fire or stoppage and the site is ' +
      'the name of the installation as the record holds it (or the place as the source writes ' +
      'it, when no site is named). It has the attributes event_kind, occurred_on (a list of ' +
      'days: one day, or the two days of a night) and occurred_on_precision (day, night or ' +
      'month); the day of the name is the last day. Link it with occurred_at (to a facility, a ' +
      'port or a vessel) and carried_out_by (to a military unit or a state body). A denial is ' +
      'the modality denies on the same name. First call search_graph with each identifier, and ' +
      'list_proposals for the document, so you propose no fact that the record or the queue ' +
      'already holds. Give published_on for an excerpt that writes a date with no year.',
    input: z.strictObject({ items: proposeItems, published_on: publishedOn.optional() }),
    output: z.strictObject({
      proposals: z.array(outcome),
      // Why no model checked the batch. The items then wait, and the same batch can be sent again.
      checkFailure: z.string().optional(),
    }),
    async run(session, input, reach) {
      const minted = new Map<string, Minted>();
      input.items.forEach((given, index) => {
        if (minted.has(given.ref)) refuse(given.ref, 'two items of the batch have this ref');
        minted.set(given.ref, { id: randomUUID(), kind: KIND_OF_OP[given.act.op] ?? null, index });
      });

      const created = new Map(
        input.items.flatMap((given) =>
          given.act.op === 'create_entity' ? [[given.ref, given.act.type] as const] : [],
        ),
      );
      const prepared: Prepared[] = [];
      for (const [index, given] of input.items.entries()) {
        const resolved = withCodedJurisdiction(await resolvedAct(session, given, index, minted));
        const eventFault = eventActRefusal(resolved);
        if (eventFault !== null) refuse(given.ref, eventFault);
        await checkEventEnds(session, given, created);
        // A back-end agent reads the stored text only, so it never gives words read from an image.
        if (modelCallId !== null && given.evidence.some((one) => one.fromImage === true))
          refuse(given.ref, 'an agent cites the stored text, and never words read from an image');
        const cited: Cited[] = [];
        for (const one of given.evidence) cited.push(await cite(session, given.ref, one));
        const published = given.published_on ?? input.published_on;
        if (published !== undefined && published > latestPublishedOn())
          refuse(given.ref, `published_on ${published} is in the future`);
        const documents = [...new Set(cited.map((one) => one.document))];
        const passages = cited.map((one) => one.passage);
        // A start or an end of a relation comes from a cited passage, or it is not proposed.
        // The FCDO list writes each date as day/month/year (ADR 0024).
        const dayFirst = cited.every((one) => one.fcdoList);
        const { act: request, dropped } = statedBounds(resolved, passages, {
          publishedOn: published,
          dayFirst,
        });
        // An end that is not proposed makes an ended relation look current, and a start or an end
        // that is the whole act has no value that a passage states. The research AI can cite the
        // passage that states it, so its batch is refused. An agent cannot, so its item is
        // disputed and the operator reads the page.
        const lostBound = lostBoundOf(resolved, dropped);
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
        const act = machineAct(request, documents);
        const unstated = unstatedValues(request, passages, { publishedOn: published, dayFirst });
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
          transcribed,
          id: minted.get(given.ref)?.id,
        });
      }

      // The check runs before the insert, because the door freezes the dispute flag at insert.
      const toCheck: ItemToCheck[] = prepared.map(({ given, cited, claimAct }) => ({
        ref: given.ref,
        claim: {
          // The checker reads the act that is written, so a dropped bound is not in the claim.
          act: claimAct,
          originator: given.originator,
          modality: given.modality,
        },
        passages: cited.map((one) => ({
          document: one.document,
          page: one.page,
          excerpt: one.passage,
          context: one.context,
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
