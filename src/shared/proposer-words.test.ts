import { expect, it } from 'vitest';

import { proposerWords } from './proposer-words';

it('names each proposer as the operator reads it, and never as a machine', () => {
  expect(
    (['v1_import', 'research_ai', 'extractor', 'operator'] as const).map(proposerWords),
  ).toStrictEqual(['v1 import', 'research AI', 'extractor', 'operator']);
});
