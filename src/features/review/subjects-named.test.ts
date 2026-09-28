import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { readQueue } from './queue';
import { subjectsNamed } from './subjects-named';

const subjects = readQueue(corpus, null, entityTypes);

describe('the review queue under the filter of the screen', () => {
  it('keeps only the subjects whose label holds the filter', () => {
    const first = subjects[0];
    if (first === undefined) throw new Error('The committed corpus puts no subject in the queue');
    const query = first.label.slice(0, 3).toUpperCase();

    const kept = subjectsNamed(subjects, query);

    expect(kept).toContain(first);
    expect(kept.every((subject) => subject.label.toLowerCase().includes(query.toLowerCase()))).toBe(
      true,
    );
  });
});
