import { randomUUID } from 'node:crypto';

import { attributeEdit } from '@gab/proposal/attribute-value';
import { machineAct } from '@gab/proposal/machine';
import { writeRequest, type WriteRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { findExcerpt, type Span } from './excerpt.ts';
import { documentId, rowsOf } from './fields.ts';
import { unstatedValues } from './stated-value.ts';
import { defineTool, ToolRefusal, type ItemToCheck, type Session } from './tool.ts';

/** How a page states a claim. A caller picks one word, and code decides what follows from it. */
export const MODALITIES = ['enacts', 'asserts', 'attributes', 'alleges', 'denies'] as const;

// A machine proposes a new fact or a new attribute with the page that states it. A change of a
// name or a type and a deletion rewrite what the operator already decided, and no machine
// proposes one.
const PROPOSED_OPS: readonly string[] = ['create_entity', 'create_relation', 'update_attrs'];

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

// The shape a caller sees. The real check is the write contract, after each ref becomes the
// identifier that code mints.
const batchAct = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('create_entity'),
    type: z.string(),
    label: z.string(),
    geom: z.unknown().optional(),
    attrs: attributeEdit.optional(),
  }),
  z.strictObject({
    op: z.literal('create_relation'),
    type: z.string(),
    srcKind: z.enum(['entity', 'relation']).optional(),
    srcId: z.string().describe(END),
    dstKind: z.enum(['entity', 'relation']).optional(),
    dstId: z.string().describe(END),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    attrs: attributeEdit.optional(),
  }),
  z.strictObject({
    op: z.literal('update_attrs'),
    targetKind: z.enum(['entity', 'relation']),
    targetId: z.uuid(),
    attrs: attributeEdit,
  }),
]);

const evidence = z.strictObject({
  document: documentId,
  page: z.number().int().min(1),
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
  modality: z.enum(MODALITIES),
  evidence: z.array(evidence).min(1).max(MAX_EVIDENCE),
});

/** One item of a batch, as a caller gives it. */
export type ProposeItem = z.output<typeof proposeItem>;

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
    AND t.extractor = (SELECT n.extractor FROM public.document_text n
                        WHERE n.document_id = $1::text
                        ORDER BY n.created_at DESC, n.extractor DESC LIMIT 1)`;

const pageRow = z.strictObject({ extractor: z.string(), text: z.string() });

const TABLE = { entity: 'api.entity', relation: 'api.relation' } as const;

type Kind = keyof typeof TABLE;

// External constraint: the door raises its refusals with this code, and any other code is a fault
// of the database that the caller must see.
const REFUSED_CODE = '22023';

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
  if (!PROPOSED_OPS.includes(parsed.data.op))
    refuse(given.ref, `a machine proposes one of ${PROPOSED_OPS.join(', ')}`);
  return parsed.data;
};

const checkTarget = async (session: Session, ref: string, act: WriteRequest): Promise<void> => {
  if (act.op !== 'update_attrs') return;
  if (!(await present(session, act.targetKind, act.targetId)))
    refuse(ref, `the target ${act.targetId} does not exist`);
};

const outcome = z.strictObject({
  ref: z.string(),
  proposalId: z.uuid(),
  written: z.boolean(),
  disputed: z.boolean(),
  unstated: z.array(z.string()),
});

export const propose = defineTool({
  name: 'propose',
  description:
    'Proposes a batch of linked facts: new entities, new relations, and attributes to add. Each ' +
    'item gives the act, the party that first stated it, how the page states it, and for its ' +
    'values the page and an excerpt copied word for word from the stored text. Code finds each ' +
    'excerpt in the page and refuses the whole batch when one is not there; the refusal names ' +
    'the item. A value that no excerpt states marks the item as disputed. A relation names an ' +
    'entity of an earlier item by its ref. A retry of the same batch writes nothing twice. The ' +
    'proposals wait for the operator. Look up an entity first, so you do not propose one that ' +
    'the record already holds.',
  input: z.strictObject({
    items: proposeItems,
    modelCallId: z.uuid().optional(),
  }),
  output: z.strictObject({ proposals: z.array(outcome) }),
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
      const draft = machineAct(request, documents);
      if (!draft.ready) refuse(given.ref, draft.refusal);
      const unstated = unstatedValues(
        request,
        cited.map((one) => one.passage),
      );
      prepared.push({ given, act: draft.act, cited, unstated, id: minted.get(given.ref)?.id });
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
    const supported = reach?.check === undefined ? null : await reach.check(toCheck);
    const disputed = (ref: string, unstated: readonly string[]): boolean =>
      unstated.length > 0 || (supported !== null && !supported.has(ref));

    const items = prepared.map(({ given, act, cited, unstated, id }) => {
      return {
        id,
        op: act.op,
        payload: act.payload,
        src: act.src,
        target_kind: act.targetKind,
        target_id: act.targetId,
        names: act.names,
        dissent: disputed(given.ref, unstated),
        model_call_id: input.modelCallId ?? null,
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
      if (cause instanceof Error && 'code' in cause && cause.code === REFUSED_CODE)
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
          disputed: disputed(given.ref, unstated),
          unstated,
        };
      }),
    };
  },
});
