import { randomUUID } from 'node:crypto';

import { attributeEdit } from '@gab/proposal/attribute-value';
import { machineAct } from '@gab/proposal/machine';
import { writeRequest, type WriteRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { findExcerpt, type Span } from './excerpt.ts';
import { documentId, isDoorRefusal, rowsOf } from './fields.ts';
import { unstatedValues } from './stated-value.ts';
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

const DAY = 'a day of the calendar, written as 2026-01-31';

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
    validFrom: z.string().optional().describe(DAY),
    validTo: z.string().optional().describe(DAY),
    attrs: attributeEdit.optional().describe(ATTRIBUTES),
  }),
  z.strictObject({
    op: z.literal('update_attrs'),
    targetKind: z.enum(['entity', 'relation']),
    targetId: z.uuid(),
    attrs: attributeEdit.describe(ATTRIBUTES),
  }),
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
});

/** One item of a batch: one act, who first stated it, and the passages that state its values. */
export const proposeItem = z.strictObject({
  ref: localRef,
  act: batchAct,
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
const PAGE = `SELECT t.extractor, t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.page = $2::int
    AND t.extractor = public.newest_text_extractor($1::text)`;

const pageRow = z.strictObject({ extractor: z.string(), text: z.string() });

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
  readonly textExtractor: string;
  readonly page: number;
  readonly span: Span;
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
  const [found] = await rowsOf(session, pageRow, PAGE, [document, page]);
  return found ?? refuse(ref, `document ${document} has no page ${String(page)} of stored text`);
};

const cite = async (
  session: Session,
  ref: string,
  given: z.output<typeof evidence>,
): Promise<Cited> => {
  const page = await pageOf(session, ref, given.document, given.page);
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
  if (act.op !== 'update_attrs') return;
  if (!(await present(session, act.targetKind, act.targetId)))
    refuse(ref, `the target ${act.targetId} does not exist`);
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
  unstated: readonly UnstatedValue[],
  verdict: CheckVerdict | 'unchecked' | undefined,
  failure: string | null,
  names: ReadonlyMap<string, string>,
): string | null => {
  const parts: string[] = [];
  if (unstated.length > 0)
    parts.push(
      `no cited passage states ${unstated
        .map((one) => `${one.name} ${JSON.stringify(one.value)}`)
        .join(', ')}`,
    );
  if (verdict === undefined)
    parts.push(failure === null ? 'the checker did not answer' : `no model checked it: ${failure}`);
  else if (verdict !== 'unchecked' && verdict.verdict !== 'supported')
    parts.push(
      verdict.reason.trim() === ''
        ? `the checker says ${verdict.verdict}`
        : `the checker says ${verdict.verdict}: ${namedRefs(verdict.reason.trim(), names)}`,
    );
  if (parts.length === 0) return null;
  // The reason of the checker can echo the text of the page. A control character (a NUL refuses
  // the whole batch at the door) becomes a space, so the record keeps one line of plain text.
  const plain = parts
    .join('; ')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/ {2,}/gu, ' ');
  return Array.from(plain).slice(0, MAX_REASON).join('');
};

const outcome = z.strictObject({
  ref: z.string(),
  proposalId: z.uuid(),
  written: z.boolean(),
  disputed: z.boolean(),
  unstated: z.array(z.string()),
});

/** The propose tool. A back-end agent gives the model call of each batch, which is known to its
 * runner alone, so it is no input that a caller gives. The research AI gives null. */
export const proposeOf = (modelCallId: string | null) =>
  defineTool({
    name: 'propose',
    description:
      'Proposes a batch of linked facts: new entities, new relations, and attributes to add. Each ' +
      'item gives the act, the party that first stated it, how the page states it, and for its ' +
      'values the page and an excerpt copied word for word from the stored text. Code finds each ' +
      'excerpt in the page and refuses the whole batch when one is not there; the refusal names ' +
      'the item. A value that no excerpt states marks the item as disputed. Before the write, a ' +
      'model of another family reads each item with its passages, and an item that it does not ' +
      'find supported, or that no model could check, is marked as disputed; checkFailure then ' +
      'says why no model checked the batch. A relation names an ' +
      'entity of an earlier item by its ref. A retry of the same batch writes nothing twice. The ' +
      'proposals wait for the operator. First call search_graph with each identifier, and ' +
      'list_proposals for the document, so you propose no fact that the record or the queue ' +
      'already holds.',
    input: z.strictObject({ items: proposeItems }),
    output: z.strictObject({
      proposals: z.array(outcome),
      // Why no model checked the batch. Each item is then disputed, and a smaller batch can pass.
      checkFailure: z.string().optional(),
    }),
    async run(session, input, reach) {
      const minted = new Map<string, Minted>();
      input.items.forEach((given, index) => {
        if (minted.has(given.ref)) refuse(given.ref, 'two items of the batch have this ref');
        minted.set(given.ref, { id: randomUUID(), kind: KIND_OF_OP[given.act.op] ?? null, index });
      });

      const prepared = [];
      for (const [index, given] of input.items.entries()) {
        const request = await resolvedAct(session, given, index, minted);
        const cited: Cited[] = [];
        for (const one of given.evidence) cited.push(await cite(session, given.ref, one));
        const documents = [...new Set(cited.map((one) => one.document))];
        await checkTarget(session, given.ref, request);
        const act = machineAct(request, documents);
        const unstated = unstatedValues(
          request,
          cited.map((one) => one.passage),
        );
        prepared.push({ given, act, cited, unstated, id: minted.get(given.ref)?.id });
      }

      // The check runs before the insert, because the door freezes the dispute flag at insert.
      const toCheck: ItemToCheck[] = prepared.map(({ given, cited }) => ({
        ref: given.ref,
        claim: { act: given.act, originator: given.originator, modality: given.modality },
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
      const reasonOf = (ref: string, unstated: readonly UnstatedValue[]): string | null =>
        disputeReason(
          unstated,
          verdicts === null ? 'unchecked' : verdicts.get(ref),
          failure,
          names,
        );

      const items = prepared.map(({ given, act, cited, unstated, id }) => {
        const reason = reasonOf(given.ref, unstated);
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
            start: one.span.start,
            end: one.span.end,
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
        proposals: prepared.map(({ given, unstated }, index) => {
          const row = rows.find((one) => one.item === index + 1);
          if (row === undefined) throw new Error(`the door returned no proposal for ${given.ref}`);
          return {
            ref: given.ref,
            proposalId: row.proposal_id,
            written: row.written,
            disputed: reasonOf(given.ref, unstated) !== null,
            unstated: [...new Set(unstated.map((one) => one.name))],
          };
        }),
        ...(failure === null ? {} : { checkFailure: failure }),
      };
    },
  });

/** The propose tool of the research AI. */
export const propose = proposeOf(null);
