// The release that the application was built with, read once and held.

import type { SiteRelease } from '@gab/release/site-release';

import { readOnce } from './once';
import { fetchRelease } from './release-files';

const memory = readOnce<SiteRelease>(() =>
  fetchRelease(new URL(`${import.meta.env.BASE_URL}release/`, document.baseURI)),
);

export const loadRelease = memory.load;

/** Forget the release, so the next read fetches the files again. */
export const forgetRelease = memory.forget;
