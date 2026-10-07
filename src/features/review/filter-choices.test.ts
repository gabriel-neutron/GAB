import { expect, it } from 'vitest';

import { filterWithinChoices } from './filter-choices';
import { NO_FILTER } from './review-workspace';

const CHOICES = {
  groups: [{ id: 'g1', subject: 'Southern Military District' }],
  documents: [{ id: 'd1', title: 'A report' }],
};

it('keeps a filter whose group and document are still choices', () => {
  const filter = { ...NO_FILTER, group: 'g1', document: 'd1', name: 'brigade' };
  expect(filterWithinChoices(filter, CHOICES)).toBe(filter);
});

it('removes a group or a document that is no longer a choice, and keeps the rest', () => {
  const filter = { ...NO_FILTER, group: 'gone', document: 'gone too', fault: 'dispute' as const };
  expect(filterWithinChoices(filter, CHOICES)).toStrictEqual({ ...NO_FILTER, fault: 'dispute' });
});
