import { expect, test } from 'vitest';

import { disclaimerBlocks } from './disclaimer-blocks.ts';
import { REFERENCE_LABEL_LINE, withReferenceLabel } from './reference-label.ts';

const TEXT = 'About.\n\n- **A:** one.\n- **B:** two.\n\nEnd.';

test('the line of the reference dataset follows the last label', () => {
  expect(withReferenceLabel(TEXT)).toBe(
    `About.\n\n- **A:** one.\n- **B:** two.\n${REFERENCE_LABEL_LINE}\n\nEnd.`,
  );
});

test('the line is added once', () => {
  expect(withReferenceLabel(withReferenceLabel(TEXT))).toBe(withReferenceLabel(TEXT));
});

test('a text with no list stays as it is', () => {
  expect(withReferenceLabel('No list.')).toBe('No list.');
});

test('the site reads the line as one more item of the list', () => {
  const [, list] = disclaimerBlocks(withReferenceLabel(TEXT));
  expect(list?.kind === 'list' ? list.items.length : 0).toBe(3);
});
