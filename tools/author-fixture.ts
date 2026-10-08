// The shared gestures of the tests of the letter, the independence and the digit. Each test runs
// inside a transaction that rolls back, so a gesture here never commits.

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { Ask } from './probe.ts';

export const MODEL = 'a-strong-model';
const EXTRACTOR = 'author-fixture@1';

export const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

// A refused statement aborts the transaction, so each one runs behind a savepoint.
export const refusal = async (ask: Ask, work: () => Promise<unknown>): Promise<string | null> => {
  await ask('SAVEPOINT refusal');
  try {
    await work();
  } catch (cause) {
    await ask('ROLLBACK TO SAVEPOINT refusal');
    return cause instanceof Error ? cause.message : String(cause);
  }
  await ask('RELEASE SAVEPOINT refusal');
  return null;
};

export interface Options {
  readonly references?: readonly string[];
  readonly controller?: string | null;
  readonly party?: boolean;
}

const STORE = `SELECT public.store_author_letter($1, $2, $3, $4, $5::text[], $6, $7) AS id`;
const REFERENCE = `SELECT public.store_reference_author($1, $2, $3, $4, $5::text[], $6, $7) AS id`;

/** The worker rates a new author. */
export const rate = (ask: Ask, name: string, letter: string, options: Options = {}) =>
  as(ask, 'gabriel_agent', () =>
    ask(STORE, [
      name,
      letter,
      MODEL,
      'a reason',
      options.references ?? ['Reference Agency'],
      options.controller ?? null,
      options.party ?? false,
    ]),
  );

/** The operator puts an author into the reference set. */
export const reference = (ask: Ask, name: string, letter: string, options: Options = {}) =>
  as(ask, 'gabriel_app', () =>
    ask(REFERENCE, [
      name,
      letter,
      MODEL,
      'an approved reason',
      options.references ?? [],
      options.controller ?? null,
      options.party ?? false,
    ]),
  );

/** The worker joins a new name to a known author. */
export const join = (ask: Ask, name: string, known: string) =>
  as(ask, 'gabriel_agent', () => ask('SELECT public.join_author_name($1, $2)', [name, known]));

export interface Source {
  /** The name that the act gives as its originator. */
  readonly author: string;
  /** The address of the document. Absent when the document has none. */
  readonly uri?: string | null;
  /** The cited passage: the document holds this text alone. */
  readonly text?: string;
  readonly modality?: 'enacts' | 'asserts' | 'attributes' | 'alleges' | 'denies';
  /** Acts with one label make one claim. */
  readonly label: string;
  /** An attribute that the act gives for the entity. */
  readonly value?: string;
  /** The reason of a dispute that the extractor wrote with the act. */
  readonly dissentReason?: string;
}

export interface Cited {
  readonly act: string;
  readonly citation: string;
  readonly claimKey: string;
}

let counter = 0;

/** One act of the research AI, with one citation of a document of its own. */
export const cited = async (ask: Ask, source: Source): Promise<Cited> => {
  counter += 1;
  const doc = `doc_${randomUUID().slice(0, 8)}`;
  const text = source.text ?? `The passage number ${counter} says what it says here.`;
  await ask(
    `SELECT public.put_document($1, 'file', $2, $3, $4, NULL, NULL, 'text/plain',
       '2026-10-07'::date)`,
    [doc, `Source ${doc}`, `raw/${doc}.txt`, source.uri ?? null],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    doc,
    JSON.stringify([text]),
    EXTRACTOR,
  ]);
  const payload: Record<string, unknown> = {
    type: 'military_unit',
    label: source.label,
    sources: [doc],
  };
  if (source.value !== undefined) payload['attrs'] = { strength: { v: source.value, src: [doc] } };
  const id = randomUUID();
  const item = {
    id,
    op: 'create_entity',
    payload,
    src: [doc],
    names: [],
    model_call_id: null,
    originator: source.author,
    modality: source.modality ?? 'asserts',
    ...(source.dissentReason === undefined
      ? {}
      : { dissent: true, dissent_reason: source.dissentReason }),
    citations: [
      { document: doc, text_extractor: EXTRACTOR, page: 1, start: 0, end: Array.from(text).length },
    ],
  };
  const written = z
    .array(z.object({ proposal_id: z.uuid() }))
    .parse(
      await as(ask, 'gabriel_research', () =>
        ask('SELECT proposal_id FROM public.propose_batch($1::jsonb)', [JSON.stringify([item])]),
      ),
    );
  const act = written[0]?.proposal_id;
  if (act === undefined) throw new Error('the door wrote no act');
  const [row] = z.array(z.object({ claim_key: z.string(), citation: z.uuid() })).parse(
    await ask(
      `SELECT p.claim_key, c.id AS citation FROM public.proposals p
           JOIN public.citation c ON c.claim_id = p.id WHERE p.id = $1::uuid`,
      [act],
    ),
  );
  if (row === undefined) throw new Error('the act has no citation');
  return { act, citation: row.citation, claimKey: row.claim_key };
};

/** A label that no other test uses. */
export const label = (): string => `Fact ${randomUUID()}`;
