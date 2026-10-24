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
    for (const type of SEEDED_RELATION_TYPES) {
      expect({ key: type.key, defined: type.definition.trim() !== '' }).toEqual({
        key: type.key,
        defined: true,
      });
    }
  });
});
