import { expect, test } from 'vitest';

import { shareWords } from './share.ts';

test('a share reads in percent, and a share that GEM estimated says so', () => {
  expect(shareWords({ share_pct: { v: 40.4 } })).toBe('share 40.4%');
  expect(shareWords({ share_pct: { v: 40.4 }, share_imputed: { v: false } })).toBe('share 40.4%');
  expect(shareWords({ share_pct: { v: 51 }, share_imputed: { v: true } })).toBe(
    'share 51%, estimated by GEM',
  );
  expect(shareWords({ share_imputed: { v: true } })).toBe('share estimated by GEM');
  expect(shareWords({})).toBeNull();
  expect(shareWords({ share_pct: { v: 'half' } })).toBeNull();
});
