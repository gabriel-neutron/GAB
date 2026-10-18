// The release that the application was built with, read once and held. The footer names its
// version and its two contacts, so the load also tells the footer.

import type { SiteRelease } from '@gab/release/site-release';

import { readOnce } from './once';
import { fetchRelease } from './release-files';
import { setReleaseNote } from './release-note';

// A load that ends after a forget must not tell the footer: the service may be back.
let generation = 0;

const memory = readOnce<SiteRelease>(async () => {
  const own = generation;
  const folder = new URL(`${import.meta.env.BASE_URL}release/`, document.baseURI);
  const release = await fetchRelease(folder);
  if (own === generation)
    setReleaseNote({
      date: release.manifest.date,
      reportError: release.manifest.contacts.reportError,
      rightOfReply: release.manifest.contacts.rightOfReply,
    });
  return release;
});

export const loadRelease = memory.load;

/** Forget the release and the note, so the next read fetches the files again. */
export function forgetRelease(): void {
  generation += 1;
  memory.forget();
  setReleaseNote(null);
}
