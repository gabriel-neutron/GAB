import { describe, expect, it } from 'vitest';

import { safeHref } from './safe-href';

describe('the link target of a source address', () => {
  it('keeps a web address and a mail address', () => {
    expect(safeHref('https://example.invalid/a')).toBe('https://example.invalid/a');
    expect(safeHref('mailto:desk@example.invalid')).toBe('mailto:desk@example.invalid');
  });

  it('keeps a script, a data address and a path as text', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
    expect(safeHref('/entity/1')).toBeNull();
  });
});
