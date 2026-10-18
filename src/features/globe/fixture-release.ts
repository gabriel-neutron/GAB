// The fixed release of the tests and the stories of the globe: the release that the release code
// wrote, and the same release with a chain of physical links on top. The rows are made for the
// test and are not data of the record.

import { CHAIN, withChain } from '@gab/release/chain-fixture';
import { readSiteRelease } from '@gab/release/site-release';

const FILES = import.meta.glob<string>('../../../packages/site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const filesOf = (): Map<string, string> =>
  new Map(Object.entries(FILES).map(([path, text]) => [path.split('/').pop() ?? path, text]));

export { CHAIN };

/** The fixed release, without and with a chain. */
export const FIXTURE_RELEASE = {
  plain: readSiteRelease(filesOf()),
  chain: readSiteRelease(withChain(filesOf())),
} as const;
