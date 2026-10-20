import { describe, expect, it } from 'vitest';

import { hiddenRelationsAfterSwitch } from './relation-filter';

describe('the switch of a relation type', () => {
  it('adds a type to the hidden list when it goes off', () => {
    expect(hiddenRelationsAfterSwitch({ hiddenRelationTypes: [] }, 'owns', false)).toEqual([
      'owns',
    ]);
  });

  it('removes a type from the hidden list when it goes on', () => {
    expect(
      hiddenRelationsAfterSwitch({ hiddenRelationTypes: ['owns', 'sts_with'] }, 'owns', true),
    ).toEqual(['sts_with']);
  });

  it('keeps one entry when a type is switched off two times', () => {
    expect(hiddenRelationsAfterSwitch({ hiddenRelationTypes: ['owns'] }, 'owns', false)).toEqual([
      'owns',
    ]);
  });
});
