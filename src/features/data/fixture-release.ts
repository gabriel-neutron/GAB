// The fixed release of the stories of the data page: the release that the release code wrote. The
// rows are made for the test and are not data of the record.

import { readSiteRelease } from '@gab/release/site-release';

const FILES = import.meta.glob<string>('../../../packages/site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const DATA_RELEASE = readSiteRelease(
  new Map(Object.entries(FILES).map(([path, text]) => [path.split('/').pop() ?? path, text])),
);
