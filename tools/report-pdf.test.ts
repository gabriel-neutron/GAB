import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { copies, hashOf, htmlOf, LANGS, pagesOf, pdfOf, STAMP } from './report-pdf.ts';

const words = (text: string): string =>
  text
    .replace(/\[\^\d+\]/g, '')
    .replace(/\*+/g, '')
    .replace(/&nbsp;|\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

describe('report PDF', () => {
  it('each PDF is made from the current templates of its language', async () => {
    // Vitest reads the modules of the page as Vite does.
    const all = await copies((file) => import(/* @vite-ignore */ file));
    const stamp = JSON.parse(readFileSync(STAMP, 'utf8')) as Record<string, string>;
    for (const lang of LANGS) {
      expect(existsSync(pdfOf(lang))).toBe(true);
      expect(statSync(pdfOf(lang)).size).toBeLessThan(10 * 1024 * 1024);
      // One PDF page for each template.
      const pdf = readFileSync(pdfOf(lang), 'latin1');
      expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(pagesOf(lang).length);
      // A failure here means: run `pnpm report:pdf`, and commit the PDF files and the stamp.
      expect(stamp[lang]).toBe(hashOf(htmlOf(lang, all[lang])));
    }
    expect(pagesOf('en')).toHaveLength(pagesOf('fr').length);
  });

  it('each block of text and each note of an English page is in the final English text', () => {
    const text = words(
      readFileSync(
        resolve(import.meta.dirname, '../src/features/report/source/report-en.md'),
        'utf8',
      ),
    );
    const missing = pagesOf('en').flatMap((file) =>
      [
        ...readFileSync(file, 'utf8')
          .replace(/<sup[^>]*>.*?<\/sup>/g, '')
          // A block of text, or the text of a note at the foot of the page.
          .matchAll(
            /<(p|h2|h3|figcaption)\b[^>]*>(.*?)<\/\1>|<span style="overflow-wrap: anywhere">(.*?)<\/span><\/div>/gs,
          ),
      ]
        .map((block) =>
          words((block[2] ?? block[3] ?? '').replace(/<span[^>]*>–<\/span>|<[^>]+>/g, '')),
        )
        .filter((block) => !text.includes(block))
        .map((block) => `${file}: ${block}`),
    );
    expect(missing).toEqual([]);
  });
});
