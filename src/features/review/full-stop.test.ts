import { expect, it } from 'vitest';

import { withFullStop } from './full-stop';

it('adds a full stop to a text with none, and never a second one', () => {
  expect(withFullStop('The position is approximate')).toBe('The position is approximate.');
  expect(withFullStop('Note: located at 71 Lenin Avenue, Yekaterinburg.')).toBe(
    'Note: located at 71 Lenin Avenue, Yekaterinburg.',
  );
  expect(withFullStop('Note: where? ')).toBe('Note: where?');
});
