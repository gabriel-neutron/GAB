import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LANGS, pdfOf, sourceHash, STAMP, toHtml } from './report-pdf.ts';

describe('report PDF', () => {
  it.each(LANGS)('the %s PDF is made from the current source text', (lang) => {
    const stamp = JSON.parse(readFileSync(STAMP, 'utf8')) as Record<string, string>;
    expect(existsSync(pdfOf(lang))).toBe(true);
    // A failure here means: run `pnpm report:pdf`, and commit the PDF files and the stamp.
    expect(stamp[lang]).toBe(sourceHash(lang));
    expect(statSync(pdfOf(lang)).size).toBeLessThan(5 * 1024 * 1024);
  });

  it('numbers the notes by first marker, joins a cut paragraph and drops the text of a figure', () => {
    const { body, notes } = toHtml(
      [
        'A cut',
        '',
        '[^7]: First, op. cit., n. 9.',
        '[^9]: See n. 2.',
        '',
        'paragraph.[^9] More.[^7]',
        'FIGURE 1 TIMELINE (text inside the figure)',
        '- 2014 | inside',
        'FIGURE: Figure 1: Title',
        '*Note.* Data.',
      ].join('\n'),
    );
    expect(body).toContain('<p>A cut paragraph.<sup>1</sup> More.<sup>2</sup></p>');
    expect(body).not.toContain('inside');
    expect(body).toContain('<span class="label">Figure 1</span>Title');
    expect(notes).toContain('<li value="1">See n. 2.</li>');
    expect(notes).toContain('<li value="2">First, op. cit., n. 1.</li>');
  });
});
