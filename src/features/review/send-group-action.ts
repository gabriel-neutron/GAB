import { z } from 'zod';

import { askWriter } from '@/shared/write/door';
import type { WriteResult } from '@/shared/write/write-state';

/** What the group action did to one unit that the screen sent: promoted, or refused with the
 * reason. */
export interface UnitResult {
  readonly unit: string;
  readonly name: string;
  readonly outcome: 'promoted' | 'refused';
  readonly said: string | null;
}

const answered = z.object({
  results: z.array(
    z.object({
      unit: z.string(),
      name: z.string(),
      outcome: z.enum(['promoted', 'refused']),
      said: z.string().nullable(),
    }),
  ),
});

/** Promote the clean units of one group that the screen showed. Each unit is promoted or refused
 * on its own. A lost answer is a doubt: some units may stand in the record. */
export const sendGroupAction = (
  groupId: string,
  unitIds: readonly string[],
): Promise<WriteResult<{ readonly results: readonly UnitResult[] }>> =>
  askWriter('/write/promote-group', { groupId, unitIds }, answered);
