import { z } from 'zod';

import { eventPairs } from './event-pairs.ts';
import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const EVENTS = `SELECT id::text AS id, label FROM api.entity WHERE type = 'event' ORDER BY id`;

const event = z.object({ id: z.uuid(), label: z.string() });

export const readEventPairs = defineTool({
  name: 'read_event_pairs',
  description:
    'Lists the groups of two or more events with the same kind, the same day and the same site ' +
    'once the site is written in Latin letters. One group is one event recorded twice, one label ' +
    'in Latin and one in Cyrillic. It reads the record, flags and never merges: send each group ' +
    'to a reviewer. An event with no occurred_at link is still in the check, as it reads the label.',
  input: z.strictObject({}),
  output: z.strictObject({
    pairs: z.array(
      z.strictObject({
        kind: z.string(),
        day: z.string(),
        events: z.array(z.strictObject({ id: z.uuid(), label: z.string() })),
      }),
    ),
  }),
  async run(session) {
    return { pairs: eventPairs(await rowsOf(session, event, EVENTS, [])) };
  },
});
