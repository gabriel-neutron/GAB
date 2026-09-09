// The corpus, read once and held. A caller awaits `loadCorpus`; a caller that has changed the
// record calls `refreshCorpus`, which is the one way a later state reaches a surface.

import { readRows } from './http';
import { toDomain } from './map';
import { readOnce } from './once';
import type { Corpus } from './model';

// Only the pending acts are read. Every surface filters on that status, and the decided acts are
// a log that no surface draws.
async function read(): Promise<Corpus> {
  const [documents, entities, relations, proposals, positions] = await Promise.all([
    readRows('document'),
    readRows('entity'),
    readRows('relation'),
    readRows('proposal', { status: 'pending' }),
    // A fifth read and not a column of `entity`: the point it carries is walked and not stored.
    // It is as long as the entity list, and the two carry the same exemption from a row cap.
    readRows('full_map'),
  ]);

  return {
    documents: documents.map((row) => toDomain.document(row)),
    entities: entities.map((row) => toDomain.entity(row)),
    relations: relations.map((row) => toDomain.relation(row)),
    proposals: proposals.map((row) => toDomain.proposal(row)),
    positions: positions.map((row) => toDomain.mapPosition(row)),
  };
}

const memory = readOnce(read);

export const loadCorpus = memory.load;

/** Forget the answer, then run the loaders again through `reload`. The order is the whole
 * function: a loader that ran first would take the answer that is held, and each surface would
 * draw the record of the read before it. */
export async function refreshCorpus(reload: () => Promise<void>): Promise<void> {
  memory.forget();
  await reload();
}
