import { describe, expect, it } from 'vitest';

import { exportHeading } from './export-heading';

const RELEASE = { version: '1.2.0', date: '2026-10-01', disclaimer: 'The disclaimer.' };

describe('the heading of a saved selection', () => {
  it('names the release, the licence and the disclaimer', () => {
    const lines = exportHeading(RELEASE, false);
    expect(lines[0]).toBe('GAB dataset, a selection of the release 1.2.0 of 2026-10-01.');
    expect(lines).toContain('Licence: CC-BY 4.0.');
    expect(lines.at(-1)).toBe('The disclaimer.');
  });

  it('says that a live read is no release, and keeps the disclaimer', () => {
    const lines = exportHeading(RELEASE, true);
    expect(lines[0]).toBe('GAB dataset, a selection of the live record. It is not a release.');
    expect(lines.at(-1)).toBe('The disclaimer.');
  });
});
