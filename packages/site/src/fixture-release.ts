import { withChain } from './chain-fixture.ts';
import { withEvents } from './event-fixture.ts';
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

const filesOf = (files: Readonly<Record<string, string>>): Map<string, string> =>
  new Map(Object.entries(files).map(([path, text]) => [path.split('/').pop() ?? path, text]));

const releaseOf = (files: Readonly<Record<string, string>>): SiteRelease =>
  readSiteRelease(filesOf(files));

/** The fixed release of the stories, without and with the NATO pair, the release with events,
 * and the release with a chain of physical links. */
export const FIXTURE_RELEASE = {
  off: releaseOf(OFF),
  on: releaseOf(ON),
  events: readSiteRelease(withEvents(filesOf(OFF))),
  chain: readSiteRelease(withChain(filesOf(OFF))),
} as const;
