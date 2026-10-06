// The seeds of the evidence-check tests. Each helper writes through the door that a real worker
// uses, as the role that the worker holds, so a test reaches the door by the same path. No code
// outside a test imports this file.

import { z } from 'zod';

import type { Ask } from './probe.ts';

export const SHA = 'c'.repeat(64);

const one = z.array(z.object({ id: z.uuid() })).length(1);

export const idOf = async (
  ask: Ask,
  text: string,
  values: readonly unknown[] = [],
): Promise<string> => {
  const [row] = one.parse(await ask(text, values));
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

// The reset runs only after the work succeeds. After a refusal the transaction is aborted, a reset
// would raise a second error that hides the first, and the rollback resets the role anyway.
export const asRole = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

/** The offset in code points of the first place of `part` in `text`. */
export const at = (text: string, part: string, from = 0): number => {
  const index = text.indexOf(part, from);
  if (index < 0) throw new Error(`"${part}" is not in the text`);
  return Array.from(text.slice(0, index)).length;
};

/** The span of `part` in `text`, as two offsets in code points. */
export const spanOf = (
  text: string,
  part: string,
  from = 0,
): { readonly start: number; readonly end: number } => {
  const start = at(text, part, from);
  return { start, end: start + Array.from(part).length };
};

export interface DocumentSeed {
  readonly id: string;
  readonly pages: readonly string[];
  readonly textSet?: string;
  readonly mime?: string;
  readonly uri?: string | null;
  readonly retrievedAt?: string;
  readonly kind?: string;
}

export const TEXT_SET = 'evidence-test@1';

/** A document with its bytes and one text set. */
export const aDocument = async (ask: Ask, seed: DocumentSeed): Promise<void> => {
  await ask(
    `SELECT public.put_document($1, $2, 'A test of the evidence checks', $3, $4, NULL, NULL, $5,
       $6::date)`,
    [
      seed.id,
      seed.kind ?? 'url',
      `raw/${seed.id}`,
      seed.uri === undefined ? `https://example.org/${seed.id}` : seed.uri,
      seed.mime ?? 'text/html',
      seed.retrievedAt ?? '2026-05-04',
    ],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    seed.id,
    JSON.stringify(seed.pages),
    seed.textSet ?? TEXT_SET,
  ]);
};

export type JobKind = 'extract_text' | 'second_read' | 'evidence_check';

/** A job of the worker. A running job is held by gabriel_agent, as the claim door leaves it. */
export const aJob = (
  ask: Ask,
  document: string,
  kind: JobKind,
  status: 'queued' | 'running' = 'running',
): Promise<string> =>
  status === 'running'
    ? idOf(
        ask,
        `INSERT INTO public.jobs (document_id, kind, status, attempts, claimed_by, claimed_at)
         VALUES ($1, $2, 'running', 1, 'gabriel_agent', now()) RETURNING id`,
        [document, kind],
      )
    : idOf(ask, 'INSERT INTO public.jobs (document_id, kind) VALUES ($1, $2) RETURNING id', [
        document,
        kind,
      ]);

export const endJob = async (
  ask: Ask,
  job: string,
  status: 'done' | 'failed' = 'done',
): Promise<void> => {
  await ask(
    `UPDATE public.jobs SET status = $2, finished_at = now(),
       failure_reason = CASE WHEN $2 = 'failed' THEN 'a test failure' END WHERE id = $1`,
    [job, status],
  );
};

export interface CallSeed {
  readonly model?: string;
  readonly served?: string | null;
  readonly outcome?: string;
}

export const aCall = (ask: Ask, job: string, seed: CallSeed = {}): Promise<string> =>
  asRole(ask, 'gabriel_agent', () =>
    idOf(
      ask,
      `SELECT public.record_model_call(p_agent => 'a-reader', p_agent_version => 'v1',
         p_endpoint => 'freellmapi', p_requested_model => $2, p_prompt_sha256 => $3,
         p_latency_ms => 10, p_outcome => $4, p_job_id => $1::uuid, p_served_model => $5,
         p_minimiser => 'minimiser-test@1', p_personal_categories => '{}'::text[]) AS id`,
      [
        job,
        seed.model ?? 'family-a/model-a',
        SHA,
        seed.outcome ?? 'ok',
        seed.served === undefined ? (seed.model ?? 'family-a/model-a') : seed.served,
      ],
    ),
  );

export interface ClaimSeed {
  readonly documents: readonly string[];
  readonly call: string;
  readonly op?: 'create_entity' | 'create_relation' | 'update_attrs';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly targetKind?: 'entity' | 'relation';
  readonly targetId?: string;
  readonly names?: readonly string[];
}

/** The payload with each plain attribute value wrapped as the record holds it: the value and the
 * documents that cite it. */
export const sourcedPayload = (
  payload: Readonly<Record<string, unknown>>,
  documents: readonly string[],
): Record<string, unknown> => {
  const attrs: unknown = payload['attrs'];
  if (attrs === undefined || attrs === null || typeof attrs !== 'object') return { ...payload };
  return {
    ...payload,
    attrs: Object.fromEntries(
      Object.entries(attrs as Record<string, unknown>).map(([key, value]) => [
        key,
        { v: value, src: [...documents] },
      ]),
    ),
  };
};

export const aClaim = (ask: Ask, seed: ClaimSeed): Promise<string> =>
  asRole(ask, 'gabriel_agent', () =>
    idOf(
      ask,
      `SELECT public.propose_change($1, $2::jsonb, $3::text[], $4, $5::uuid, $6::uuid[], NULL,
         false, $7::uuid) AS id`,
      [
        seed.op ?? 'create_entity',
        JSON.stringify(sourcedPayload(seed.payload, seed.documents)),
        seed.documents,
        seed.targetKind ?? null,
        seed.targetId ?? null,
        seed.names ?? [],
        seed.call,
      ],
    ),
  );

export interface ReadingSeed {
  readonly job: string;
  readonly claim?: string | null;
  readonly textSet?: string;
  readonly page?: number;
  readonly start: number;
  readonly end: number;
  readonly modality?: string;
  readonly adverse?: boolean | null;
  readonly call?: string | null;
  readonly family?: string | null;
  readonly fingerprint?: string;
  readonly parsed?: Readonly<Record<string, unknown>> | null;
  readonly actEffect?: string | null;
  readonly key?: string;
}

let readings = 0;

/** A reading through the door, as gabriel_agent. The key differs on each call unless given. */
export const aReading = (ask: Ask, seed: ReadingSeed): Promise<string> => {
  readings += 1;
  const key = seed.key ?? readings.toString(16).padStart(64, '0');
  return asRole(ask, 'gabriel_agent', () =>
    idOf(
      ask,
      `SELECT public.put_claim_reading(p_job => $1::uuid, p_claim => $2::uuid,
         p_text_extractor => $3, p_page => $4::int, p_start => $5::int, p_end => $6::int,
         p_modality => $7, p_adverse => $8::boolean, p_model_call => $9::uuid,
         p_input_form => 'text', p_reader_fingerprint => $10, p_chunk_hash => $11,
         p_idempotency_key => $12, p_model_family => $13, p_parsed => $14::jsonb,
         p_act_effect => $15) AS id`,
      [
        seed.job,
        seed.claim ?? null,
        seed.textSet ?? TEXT_SET,
        seed.page ?? 1,
        seed.start,
        seed.end,
        seed.modality ?? 'asserts',
        seed.adverse ?? null,
        seed.call ?? null,
        seed.fingerprint ?? 'a-model abc',
        SHA,
        key,
        seed.family === undefined ? null : seed.family,
        seed.parsed === undefined || seed.parsed === null ? null : JSON.stringify(seed.parsed),
        seed.actEffect ?? null,
      ],
    ),
  );
};

/** A proposal of the operator, which an entity or a relation of the record needs. */
export const anOperatorProposal = (ask: Ask, document: string): Promise<string> =>
  asRole(ask, 'gabriel_app', () =>
    idOf(
      ask,
      `SELECT public.propose_change('create_entity', '{"type":"vessel","label":"seed"}'::jsonb,
         ARRAY[$1]::text[]) AS id`,
      [document],
    ),
  );

/** An entity of the record, written by the owner as the promotion would write it. */
export const anEntity = async (
  ask: Ask,
  document: string,
  type: string,
  label: string,
  attrs: Readonly<Record<string, unknown>> = {},
): Promise<string> => {
  const from = await anOperatorProposal(ask, document);
  const sourced = Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [key, { v: value, src: [document] }]),
  );
  return idOf(
    ask,
    `INSERT INTO public.entities (type, label, attrs, sources, promoted_from)
     VALUES ($1, $2, $3::jsonb, ARRAY[$4]::text[]::doc_id[], $5) RETURNING id`,
    [type, label, JSON.stringify(sourced), document, from],
  );
};

export interface RelationSeed {
  readonly type: string;
  readonly src: string;
  readonly dst: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
}

export const aRelation = async (
  ask: Ask,
  document: string,
  seed: RelationSeed,
): Promise<string> => {
  const from = await anOperatorProposal(ask, document);
  const sourced = Object.fromEntries(
    Object.entries(seed.attrs ?? {}).map(([key, value]) => [key, { v: value, src: [document] }]),
  );
  return idOf(
    ask,
    `INSERT INTO public.relations (type, src_kind, src_id, dst_kind, dst_id, attrs, valid_from,
       valid_to, sources, promoted_from)
     VALUES ($1, 'entity', $2, 'entity', $3, $4::jsonb, $5::date, $6::date,
       ARRAY[$7]::text[]::doc_id[], $8) RETURNING id`,
    [
      seed.type,
      seed.src,
      seed.dst,
      JSON.stringify(sourced),
      seed.validFrom ?? null,
      seed.validTo ?? null,
      document,
      from,
    ],
  );
};

export const checkRow = z.object({
  check_id: z.uuid(),
  citation_id: z.uuid(),
  counts: z.boolean(),
  held: z.record(z.string(), z.string()),
  span_result: z.string(),
  support: z.string(),
  identity: z.string(),
  same_family: z.string(),
});

export type CheckRow = z.output<typeof checkRow>;

/** The door, as gabriel_agent. It returns no row when the claim has no first reading here. */
export const runChecks = (ask: Ask, job: string, claim: string): Promise<CheckRow[]> =>
  asRole(ask, 'gabriel_agent', async () =>
    z
      .array(checkRow)
      .max(1)
      .parse(
        await ask(
          `SELECT check_id, citation_id, counts, held, span_result, support, identity, same_family
             FROM public.run_evidence_checks($1::uuid, $2::uuid)`,
          [job, claim],
        ),
      ),
  );

/** The whole stored check row, read by the owner. */
export const storedCheck = async (
  ask: Ask,
  id: string,
): Promise<Readonly<Record<string, unknown>>> => {
  const rows = z
    .array(z.object({ row: z.record(z.string(), z.unknown()) }))
    .length(1)
    .parse(
      await ask('SELECT to_jsonb(c) AS row FROM public.citation_check c WHERE c.id = $1', [id]),
    );
  const [first] = rows;
  if (first === undefined) throw new Error('no check row');
  return first.row;
};

export interface Pair {
  readonly document: string;
  readonly page: string;
  readonly claim: string;
  readonly evidence: string;
  readonly first: string;
  readonly second: string | null;
  readonly firstCall: string;
}

export interface PairSeed {
  readonly document?: string;
  readonly page: string;
  readonly pages?: readonly string[];
  readonly mime?: string;
  readonly uri?: string | null;
  readonly retrievedAt?: string;
  readonly textSet?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly op?: ClaimSeed['op'];
  readonly targetKind?: ClaimSeed['targetKind'];
  readonly targetId?: string;
  readonly names?: readonly string[];
  readonly extraDocuments?: readonly string[];
  readonly span: { readonly start: number; readonly end: number };
  readonly modality?: string;
  readonly adverse?: boolean;
  /** The second reading. `none` stores no reading, and the job still ends as `secondJob` says. */
  readonly second?:
    | 'none'
    | {
        readonly start: number;
        readonly end: number;
        readonly modality?: string;
        readonly adverse?: boolean;
        readonly model?: string;
        readonly served?: string | null;
        readonly family?: string;
        readonly page?: number;
      };
  readonly secondJob?: 'done' | 'failed' | 'absent';
  readonly secondCallOutcome?: string;
  readonly firstFamily?: string;
  readonly firstModel?: string;
  /** Seeds that need the document before the claim, such as an entity of the record. */
  readonly before?: (ask: Ask, document: string) => Promise<void>;
}

/** The common path: a document, the first reading of one claim, the second reading of its job,
 * and a running evidence job of the same document. */
export const aPair = async (ask: Ask, seed: PairSeed): Promise<Pair> => {
  const document = seed.document ?? 'doc_evidence_pair';
  await aDocument(ask, {
    id: document,
    pages: seed.pages ?? [seed.page],
    ...(seed.mime === undefined ? {} : { mime: seed.mime }),
    ...(seed.uri === undefined ? {} : { uri: seed.uri }),
    ...(seed.retrievedAt === undefined ? {} : { retrievedAt: seed.retrievedAt }),
    ...(seed.textSet === undefined ? {} : { textSet: seed.textSet }),
  });
  if (seed.before !== undefined) await seed.before(ask, document);

  const extract = await aJob(ask, document, 'extract_text');
  const firstModel = seed.firstModel ?? 'family-a/model-a';
  const firstCall = await aCall(ask, extract, { model: firstModel });
  const claim = await aClaim(ask, {
    documents: [document, ...(seed.extraDocuments ?? [])],
    call: firstCall,
    ...(seed.op === undefined ? {} : { op: seed.op }),
    payload: seed.payload,
    ...(seed.targetKind === undefined ? {} : { targetKind: seed.targetKind }),
    ...(seed.targetId === undefined ? {} : { targetId: seed.targetId }),
    ...(seed.names === undefined ? {} : { names: seed.names }),
  });
  const first = await aReading(ask, {
    job: extract,
    claim,
    ...(seed.textSet === undefined ? {} : { textSet: seed.textSet }),
    start: seed.span.start,
    end: seed.span.end,
    modality: seed.modality ?? 'asserts',
    adverse: seed.adverse === true ? true : null,
    call: firstCall,
    family: seed.firstFamily ?? 'family-a',
  });
  await endJob(ask, extract);

  let second: string | null = null;
  const secondJob = seed.secondJob ?? 'done';
  if (secondJob !== 'absent') {
    const job = await aJob(ask, document, 'second_read');
    const given = seed.second ?? {
      start: seed.span.start,
      end: seed.span.end,
      modality: seed.modality ?? 'asserts',
      ...(seed.adverse === true ? { adverse: true } : {}),
    };
    const model = given === 'none' ? 'family-b/model-b' : (given.model ?? 'family-b/model-b');
    const call = await aCall(ask, job, {
      model,
      served: given === 'none' ? model : given.served === undefined ? model : given.served,
      outcome: seed.secondCallOutcome ?? 'ok',
    });
    if (given !== 'none')
      second = await aReading(ask, {
        job,
        ...(seed.textSet === undefined ? {} : { textSet: seed.textSet }),
        page: given.page ?? 1,
        start: given.start,
        end: given.end,
        modality: given.modality ?? 'asserts',
        adverse: given.adverse === true ? true : null,
        call,
        family: given.family ?? 'family-b',
        fingerprint: 'family-b/model-b prompt-b',
      });
    await endJob(ask, job, secondJob === 'failed' ? 'failed' : 'done');
  }

  const evidence = await aJob(ask, document, 'evidence_check');
  return { document, page: seed.page, claim, evidence, first, second, firstCall };
};
