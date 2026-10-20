// The corpus, read once and held. A caller awaits `loadCorpus`; a caller that has changed the
// record calls `refreshCorpus`, which is the one way a later state reaches a surface.

import { forgetDecidedActs } from './decided-acts';
import { readRows } from './http';
import { toDomain } from './map';
import { readOnce } from './once';
import type { Corpus } from './model';
import { forgetReadMode, readFrom, readMode } from './read-mode';
import { setReadAt } from './read-time';
import { corpusFromRelease } from './release-corpus';
import { setReleaseNote } from './release-note';
import { forgetRelease, loadRelease } from './release-record';
import { forgetVocabulary, loadRelationTypes } from './vocabulary';

// Only the pending acts are read. Every surface of the corpus filters on that status, and the
// history of the review reads the decided acts on its own.
async function readFromService(): Promise<Corpus> {
  const [documents, entities, relations, proposals, positions, relationTypes] = await Promise.all([
    readRows('document'),
    readRows('entity'),
    readRows('relation'),
    readRows('proposal', { status: 'pending' }),
    // A fifth read and not a column of `entity`: the point it carries is walked and not stored.
    // It is as long as the entity list, and the two carry the same exemption from a row cap.
    readRows('full_map'),
    // The words of a relation type travel with the corpus, because every surface that words a
    // relation reads the corpus. The list is held once, and a refresh of the record reuses it.
    loadRelationTypes(),
  ]);

  return {
    documents: documents.map((row) => toDomain.document(row)),
    entities: entities.map((row) => toDomain.entity(row)),
    relations: relations.map((row) => toDomain.relation(row)),
    proposals: proposals.map((row) => toDomain.proposal(row)),
    positions: positions.map((row) => toDomain.mapPosition(row)),
    relationTypes,
  };
}

// The service does not answer: the files of the release give the same shapes. The release has no
// pending act, because the review is a part that writes, and it is hidden.
// The footer names the version only here: with the service up, the record is the live one.
let generation = 0;

async function readFromRelease(): Promise<Corpus> {
  const own = generation;
  const [release, relationTypes] = await Promise.all([loadRelease(), loadRelationTypes()]);
  // A load that ends after a forget must not show the footer: the service may be back.
  if (own === generation)
    setReleaseNote({
      version: release.manifest.version,
      date: release.manifest.date,
      reportError: release.manifest.contacts.reportError,
      rightOfReply: release.manifest.contacts.rightOfReply,
    });
  return corpusFromRelease(release, relationTypes);
}

const memory = readOnce(async () => {
  const own = generation;
  const read = await readFrom(readFromService, readFromRelease);
  // A read that ends after a forget is not the record on the screen.
  if (own === generation) setReadAt(new Date());
  return read;
});

export const loadCorpus = memory.load;

/** Forget each held answer, the decided acts too. A write that shows no corpus calls it alone,
 * so the next surface that opens reads the record again. */
export function forgetCorpus(): void {
  memory.forget();
  forgetDecidedActs();
  // A retry asks the service again. The words of the vocabulary stay when the service gave them.
  if (readMode() === 'release') forgetVocabulary();
  forgetReadMode();
  forgetRelease();
  generation += 1;
  setReleaseNote(null);
}

/** Forget each held answer, then run the loaders again through `reload`. The order is the whole
 * function: a loader that ran first would take the answer that is held, and each surface would
 * draw the record of the read before it. */
export async function refreshCorpus(reload: () => Promise<void>): Promise<void> {
  forgetCorpus();
  await reload();
}
