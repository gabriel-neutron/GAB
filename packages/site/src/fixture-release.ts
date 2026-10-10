import { readSiteRelease, type SiteRelease } from './site-release.ts';

// The stories read the fixed release that the release code wrote, as the site reads it.
const OFF = import.meta.glob<string>('../fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const ON = import.meta.glob<string>('../fixtures/release-nato/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const releaseOf = (files: Readonly<Record<string, string>>): SiteRelease =>
  readSiteRelease(
    new Map(Object.entries(files).map(([path, text]) => [path.split('/').pop() ?? path, text])),
  );

/** The fixed release of the stories, without and with the NATO pair. */
export const FIXTURE_RELEASE = { off: releaseOf(OFF), on: releaseOf(ON) } as const;
