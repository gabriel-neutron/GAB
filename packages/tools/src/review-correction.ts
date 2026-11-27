import { z } from 'zod';

import { ToolRefusal } from './tool.ts';

// Departure: two exports, one job. The corrections of an AI reviewer (ADR 0038) share their
// origin and the check that the cited passage holds the new words.

export const origin = z.literal('decided by an AI reviewer');

/** The words in one form: one case, one space, the compatibility form of Unicode. */
const folded = (text: string): string =>
  text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();

/** Refuses the call when the excerpt does not hold the new words of the correction. */
export const holdsWords = (field: string, excerpt: string, words: string): void => {
  if (!folded(excerpt).includes(folded(words)))
    throw new ToolRefusal(
      `${field}: the excerpt does not hold ${JSON.stringify(words)}. Cite the passage that ` +
        'writes the new words.',
    );
};
