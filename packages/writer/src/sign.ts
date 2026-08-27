import { proposalAct, type ProposalAct } from '@gab/proposal/payload';
import { writeRequest, type WriteRequest, type WRITE_OPS } from '@gab/proposal/request';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { refusalFrom } from './refusal.ts';
import type { VocabularyReader } from './vocabulary.ts';

// The door signs, and it names no person. Nothing authenticates a caller here, so a name would
// be a fiction that the decided act carries for ever.
const DECIDED_BY = 'the writer door';

const TABLE = { entity: 'public.entities', relation: 'public.relations' } as const;

interface SignedRefusal {
  readonly refusal: string;
  readonly proposalId?: string;
}

/** What one request became. The caller maps the outcome, and takes no decision of its own. */
export type SignedAct =
  | {
      readonly outcome: 'signed';
      readonly reply: {
        readonly proposalId: string;
        readonly targetId: string;
        readonly state: 'signed';
      };
    }
  | {
      readonly outcome: 'refused' | 'missing' | 'blocked' | 'unavailable';
      readonly reply: SignedRefusal;
    }
  | { readonly outcome: 'undecided'; readonly reply: SignedRefusal };

const refused = (refusal: string): SignedAct => ({ outcome: 'refused', reply: { refusal } });
const missing = (refusal: string): SignedAct => ({ outcome: 'missing', reply: { refusal } });
const blocked = (refusal: string): SignedAct => ({ outcome: 'blocked', reply: { refusal } });
const unavailable = (refusal: string): SignedAct => ({
  outcome: 'unavailable',
  reply: { refusal },
});

const identifier = z.uuid();
const counted = z.coerce.number();
const objectBody = z.record(z.string(), z.unknown());
const offered = z.object({ attrs: z.record(z.string(), z.unknown()) });

const rows = async (
  client: PoolClient,
  text: string,
  values: readonly unknown[],
): Promise<readonly Record<string, unknown>[]> =>
  (await client.query<Record<string, unknown>>(text, [...values])).rows;

const inTransaction = async <T>(client: PoolClient, run: () => Promise<T>): Promise<T> => {
  await client.query('BEGIN');
  try {
    const held = await run();
    await client.query('COMMIT');
    return held;
  } catch (cause) {
    await client.query('ROLLBACK');
    throw cause;
  }
};

const PROPOSE = `SELECT public.propose_change($1::text, $2::jsonb, $3::text[], $4::text,
  $5::uuid, $6::uuid[], $7::numeric, $8::boolean) AS id`;

const propose = async (client: PoolClient, act: ProposalAct): Promise<string> => {
  const found = await rows(client, PROPOSE, [
    act.op,
    JSON.stringify(act.payload),
    [...act.src],
    act.targetKind,
    act.targetId,
    [...act.names],
    // An act of the operator carries no confidence. A score is a machine's reading of its own
    // extraction, and a machine may not assert certainty in the name of the operator.
    null,
    false,
  ]);
  return identifier.parse(found[0]?.['id']);
};

const promote = async (client: PoolClient, proposalId: string): Promise<string> => {
  const found = await rows(client, 'SELECT public.promote_proposal($1::uuid, $2::text) AS id', [
    proposalId,
    DECIDED_BY,
  ]);
  return identifier.parse(found[0]?.['id']);
};

type Endpoint = 'entity' | 'relation';

const present = async (client: PoolClient, kind: Endpoint, id: string): Promise<boolean> =>
  (await rows(client, `SELECT 1 FROM ${TABLE[kind]} WHERE id = $1::uuid`, [id])).length === 1;

const attributesOf = async (client: PoolClient, kind: Endpoint, id: string): Promise<unknown> => {
  const found = await rows(client, `SELECT attrs FROM ${TABLE[kind]} WHERE id = $1::uuid`, [id]);
  return found[0]?.['attrs'];
};

const USES = `SELECT count(*) AS uses FROM public.relations r
  WHERE (r.src_kind = $2::text AND r.src_id = $1::uuid)
     OR (r.dst_kind = $2::text AND r.dst_id = $1::uuid)`;

const endpointUses = async (client: PoolClient, kind: Endpoint, id: string): Promise<number> =>
  counted.parse((await rows(client, USES, [id, kind]))[0]?.['uses']);

type Ground =
  | { readonly ready: true; readonly prior: unknown }
  | { readonly ready: false; readonly act: SignedAct };

const ready: Ground = { ready: true, prior: null };

// Every read below removes a failure that `promote_proposal` raises after the proposal is
// already committed, which would strand an undecided act for a fault that nobody chose.
const groundOf = async (client: PoolClient, request: WriteRequest): Promise<Ground> => {
  if (request.op === 'create_relation') {
    if (!(await present(client, request.srcKind, request.srcId)))
      return { ready: false, act: missing(`the source ${request.srcId} does not exist`) };
    if (!(await present(client, request.dstKind, request.dstId)))
      return { ready: false, act: missing(`the target ${request.dstId} does not exist`) };
    return ready;
  }

  if (request.op === 'update_attrs') {
    const prior = await attributesOf(client, request.targetKind, request.targetId);
    if (prior === undefined)
      return { ready: false, act: missing(`the target ${request.targetId} does not exist`) };
    return { ready: true, prior };
  }

  if (request.op === 'delete_entity' || request.op === 'delete_relation') {
    const kind: Endpoint = request.op === 'delete_entity' ? 'entity' : 'relation';
    if (!(await present(client, kind, request.targetId)))
      return { ready: false, act: missing(`the target ${request.targetId} does not exist`) };
    const uses = await endpointUses(client, kind, request.targetId);
    if (uses > 0)
      return {
        ready: false,
        act: blocked(
          `the ${kind} is an endpoint of ${uses} ${uses === 1 ? 'relation' : 'relations'}, ` +
            'and it is not deleted',
        ),
      };
    return ready;
  }

  return ready;
};

const readBody = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

// A top-level field such as `type` names the box the caller must correct, so it leads. A deeper
// path is the address of a value inside a schema, and it is no sentence for a person: the
// message of a nested issue already names the key, so the path is dropped.
const faulted = (issue: { readonly path: PropertyKey[]; readonly message: string }): string => {
  const [first] = issue.path;
  if (issue.path.length !== 1 || typeof first !== 'string') return issue.message;
  return `${first}: ${issue.message}`;
};

const keysOffered = (given: unknown): readonly string[] => {
  const held = offered.safeParse(given);
  return held.success ? Object.keys(held.data.attrs) : [];
};

// One act, in two transactions. `promote_proposal` refuses a proposal that the calling
// transaction wrote, so the proposal commits first and the promotion opens a second one.
export const sign = async (
  pool: Pool,
  vocabulary: VocabularyReader,
  op: (typeof WRITE_OPS)[number],
  raw: string,
): Promise<SignedAct> => {
  const given = objectBody.safeParse(readBody(raw));
  if (!given.success) return refused('the body is not a JSON object');

  let schema: ReturnType<typeof writeRequest>;
  try {
    schema = writeRequest(await vocabulary.forKeys(keysOffered(given.data)));
  } catch (cause) {
    return unavailable(refusalFrom(cause));
  }

  const request = schema.safeParse({ ...given.data, op });
  if (!request.success) return refused(request.error.issues.map(faulted).join('; '));

  // A pool that cannot give a client has written nothing, and the reason belongs to the same
  // map as a raised error: the address of the server is never a sentence for a screen.
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (cause) {
    return unavailable(refusalFrom(cause));
  }

  try {
    const ground = await groundOf(client, request.data);
    if (!ground.ready) return ground.act;

    const draft = proposalAct(request.data, ground.prior);
    if (!draft.ready) return refused(draft.refusal);
    const act: ProposalAct = draft.act;

    let proposalId: string;
    try {
      proposalId = await inTransaction(client, () => propose(client, act));
    } catch (cause) {
      return refused(refusalFrom(cause));
    }

    try {
      const targetId = await inTransaction(client, () => promote(client, proposalId));
      return { outcome: 'signed', reply: { proposalId, targetId, state: 'signed' } };
    } catch (cause) {
      // The proposal is committed and a trigger refuses its deletion. A rejection is a decision
      // the operator did not take, so the act stays pending and the caller is told which one.
      return {
        outcome: 'undecided',
        reply: { refusal: refusalFrom(cause, proposalId), proposalId },
      };
    }
  } finally {
    client.release();
  }
};
