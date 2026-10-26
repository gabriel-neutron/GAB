import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('class names joined for one element', () => {
  it('keeps the small size beside a colour', () => {
    expect(cn('text-small/4', 'text-label')).toBe('text-small/4 text-label');
  });
});

describe('the reading scale beside a colour', () => {
  it('keeps each size of the reading scale', () => {
    expect(cn('text-body-sm', 'text-label')).toBe('text-body-sm text-label');
    expect(cn('text-body', 'text-foreground')).toBe('text-body text-foreground');
    expect(cn('text-heading-sm', 'text-muted-foreground')).toBe(
      'text-heading-sm text-muted-foreground',
    );
  });
});
