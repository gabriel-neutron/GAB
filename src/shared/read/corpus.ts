// The corpus, read once and held. A caller awaits `loadCorpus`; a caller that has changed the
// record calls `refreshCorpus`, which is the one way a later state reaches a surface.

import { readRows } from './http';
import { toDomain } from './map';
import type { Corpus } from './model';

// Only the pending acts are read. Every surface filters on that status, and the decided acts are
// a log that no surface draws.
async function read(): Promise<Corpus> {
  const [documents, entities, relations, proposals] = await Promise.all([
    readRows('document'),
    readRows('entity'),
    readRows('relation'),
    readRows('proposal', { status: 'pending' }),
  ]);

  return {
    documents: documents.map((row) => toDomain.document(row)),
    entities: entities.map((row) => toDomain.entity(row)),
    relations: relations.map((row) => toDomain.relation(row)),
    proposals: proposals.map((row) => toDomain.proposal(row)),
  };
}

let reading: Promise<Corpus> | null = null;

/** The read runs once, and a failure clears the memory: a rejected promise that stayed would
 * answer every later attempt with the first failure. */
export function loadCorpus(): Promise<Corpus> {
  reading ??= read().catch((reason: unknown) => {
    reading = null;
    throw reason;
  });
  return reading;
}

/** Forget the answer, then run the loaders again through `reload`. The order is the whole
 * function: a loader that ran first would take the answer that is held, and each surface would
 * draw the record of the read before it. */
export async function refreshCorpus(reload: () => Promise<void>): Promise<void> {
  reading = null;
  await reload();
}
