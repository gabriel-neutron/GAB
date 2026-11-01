import { describe, expect, it } from 'vitest';
import { recordCounts } from './record-counts';
import { sources } from './source';

const format = new Intl.NumberFormat('en-GB');

describe('record counts', () => {
  it('reads the counts and their date from the final text', () => {
    const { text } = sources.en;
    const counts = recordCounts(sources.en);
    const day = counts.date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    expect(text).toContain(
      `On ${day}, the database holds ${format.format(counts.entities)} entities`,
    );
    expect(text).toContain(`In total, ${format.format(counts.critical)} nodes are critical`);
    expect(text).toContain(`For at least ${format.format(counts.official)} of them`);
    expect(counts.official).toBeLessThanOrEqual(counts.critical);
  });

  it('refuses a text that no longer gives a count', () => {
    const text = sources.en.text.replace('In total, ', 'Overall, ');
    expect(() => recordCounts({ ...sources.en, text })).toThrow(/critical nodes/);
  });
});
