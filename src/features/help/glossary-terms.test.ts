import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';
import { describe, expect, it } from 'vitest';

import { GLOSSARY_TERMS } from './glossary-terms';

describe('the glossary', () => {
  it('defines claim, pending proposal and hostile', () => {
    expect(GLOSSARY_TERMS.map(({ term }) => term)).toEqual([
      'Claim',
      'Pending proposal',
      'Hostile',
    ]);
    for (const { definition } of GLOSSARY_TERMS) expect(definition.trim()).not.toBe('');
  });

  it('refuses a relation type with no definition', () => {
    const undefinedKeys = SEEDED_RELATION_TYPES.filter((type) => type.definition.trim() === '').map(
      (type) => type.key,
    );
    expect(undefinedKeys).toEqual([]);
  });
});
