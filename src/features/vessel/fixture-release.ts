// The fixed release of the stories of the vessel page: the release that the release code wrote,
// without and with the NATO pair of each claim. The rows are made for the test and are not data
// of the record.

import { readSiteRelease } from '@gab/release/site-release';

const OFF = import.meta.glob<string>('../../../packages/site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const ON = import.meta.glob<string>('../../../packages/site/fixtures/release-nato/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const releaseOf = (files: Readonly<Record<string, string>>) =>
  readSiteRelease(
    new Map(Object.entries(files).map(([path, text]) => [path.split('/').pop() ?? path, text])),
  );

/** The fixed release without the NATO pair, and with it. */
export const FIXTURE_RELEASE = { off: releaseOf(OFF), on: releaseOf(ON) } as const;
