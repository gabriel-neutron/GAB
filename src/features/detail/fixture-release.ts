// The fixed release of the stories of the events part: the release that the release code wrote,
// with events on top. The rows are made for the test and are not data of the record.

import { withEvents } from '@gab/release/event-fixture';
import { readSiteRelease } from '@gab/release/site-release';

const FILES = import.meta.glob<string>('../../../packages/site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The fixed release with events. */
export const EVENTS_RELEASE = readSiteRelease(
  withEvents(
    new Map(Object.entries(FILES).map(([path, text]) => [path.split('/').pop() ?? path, text])),
  ),
);
