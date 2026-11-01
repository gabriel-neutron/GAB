import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { copies, hashOf, htmlOf, LANGS, pdfOf, STAMP, toHtml } from './report-pdf.ts';

describe('report PDF', () => {
  it('each PDF is made from the current page of its language', async () => {
    // Vitest reads the modules of the page as Vite does.
    const all = await copies((file) => import(/* @vite-ignore */ file));
    const stamp = JSON.parse(readFileSync(STAMP, 'utf8')) as Record<string, string>;
    for (const lang of LANGS) {
      expect(existsSync(pdfOf(lang))).toBe(true);
      expect(statSync(pdfOf(lang)).size).toBeLessThan(5 * 1024 * 1024);
      expect(htmlOf(lang, all[lang])).toContain(all[lang].byline);
      // A failure here means: run `pnpm report:pdf`, and commit the PDF files and the stamp.
      expect(stamp[lang]).toBe(hashOf(htmlOf(lang, all[lang])));
    }
  });

  it('numbers the notes and the chapters, joins a cut paragraph and drops the text of a figure', () => {
    const { body, notes } = toHtml(
      [
        '## [N]. Pay',
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
        'Map with no number',
        '*Note.* Base map.',
      ].join('\n'),
    );
    expect(body).toContain('<h2>1. Pay</h2>');
    expect(body).toContain('<p>A cut paragraph.<sup>1</sup> More.<sup>2</sup></p>');
    expect(body).not.toContain('inside');
    expect(body).toContain('<span class="label">Figure 1</span>Title');
    expect(body).not.toContain('Map with no number');
    expect(body).not.toContain('Base map');
    expect(notes).toContain('<li value="1">See n. 2.</li>');
    expect(notes).toContain('<li value="2">First, op. cit., n. 1.</li>');
  });
});
