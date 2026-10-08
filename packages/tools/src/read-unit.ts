import { z } from 'zod';

import { pageOutput, readQueuePage } from './review-read.ts';
import { ToolRefusal, defineTool } from './tool.ts';

export const readUnit = defineTool({
  name: 'read_unit',
  description:
    'Reads one unit of the review queue by its id, as the review page shows it: its acts, the ' +
    'cited passage of each act with the words around it, its faults, the reason of each dispute ' +
    'and of each rejection before, and the check of a second model. A unit that no longer waits ' +
    'is refused.',
  input: z.strictObject({ unitId: z.uuid().describe('the id of the unit, from a list') }),
  output: z.strictObject({ unit: pageOutput.shape.units.element }),
  async run(session, input) {
    const page = await readQueuePage(session, { size: 1, lane: null, unit: input.unitId });
    const [unit] = page.units;
    if (unit === undefined)
      throw new ToolRefusal(`no unit ${input.unitId} waits in the queue: it is decided or absent`);
    return { unit };
  },
});
