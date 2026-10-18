// The release that the application was built with, read once and held.

import type { SiteRelease } from '@gab/release/site-release';

import { readOnce } from './once';
import { fetchRelease, ReleaseAbsent } from './release-files';

const memory = readOnce<SiteRelease>(() =>
  fetchRelease(new URL(`${import.meta.env.BASE_URL}release/`, document.baseURI)),
);

export const loadRelease = memory.load;

/** Forget the release, so the next read fetches the files again. */
export const forgetRelease = memory.forget;

/** The release when the site holds one, and null when it holds none. A release that the site
 * holds and cannot read still stops the caller: that is a fault of the build. */
export async function loadReleaseOrNull(): Promise<SiteRelease | null> {
  try {
    return await loadRelease();
  } catch (cause) {
    if (cause instanceof ReleaseAbsent) return null;
    throw cause;
  }
}
