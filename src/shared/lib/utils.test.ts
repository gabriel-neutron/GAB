import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('class names joined for one element', () => {
  it('keeps the small size beside a colour', () => {
    expect(cn('text-small/4', 'text-label')).toBe('text-small/4 text-label');
  });
});
