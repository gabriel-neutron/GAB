import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  copies,
  htmlOf,
  LANGS,
  pagesOf,
  pdfOf,
  recordOf,
  STAMP,
  stampOf,
  withReferences,
} from './report-pdf.ts';
import { citeText, entries } from '../src/features/report/bibliography.ts';

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
    const stamp = JSON.parse(readFileSync(STAMP, 'utf8')) as Record<
      string,
      { hash: string; pages: number }
    >;
    for (const lang of LANGS) {
      expect(existsSync(pdfOf(lang))).toBe(true);
      expect(statSync(pdfOf(lang)).size).toBeLessThan(10 * 1024 * 1024);
      // The layout pass adds and removes pages: the stamp holds the count that it printed.
      const pdf = readFileSync(pdfOf(lang), 'latin1');
      expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(stamp[lang]?.pages ?? 0);
      expect(stamp[lang]?.pages).toBeGreaterThan(0);
      // A failure here means: run `pnpm report:pdf`, and commit the PDF files and the stamp.
      expect(stamp[lang]?.hash).toBe(stampOf(lang, all[lang]));
    }
  });

  it('the stamp names the data release that is pinned', () => {
    const stamp = JSON.parse(readFileSync(STAMP, 'utf8')) as { record?: unknown };
    // A failure here means: the release was pinned again, so run `pnpm report:pdf` and commit.
    expect(stamp.record).toEqual(recordOf());
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
        // The title of the bibliography page is no words of the final text.
        .filter((block) => block !== 'Bibliography' && !text.includes(block))
        .map((block) => `${file}: ${block}`),
    );
    expect(missing).toEqual([]);
  });

  it('prints each call as its reference, and each short note at the foot of its page', async () => {
    const { en } = await copies((file) => import(/* @vite-ignore */ file));
    const html = htmlOf('en', en);
    const plain = (text: string) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/features/report/source/report-en.md'),
      'utf8',
    );
    const lines = new Map(
      [...source.matchAll(/^\[\^(\d+)\]: (.*)$/gmu)].map(([, id = '', text = '']) => [id, text]),
    );
    const cites = [...html.matchAll(/<span data-cite="(\d+)">(.*?)<\/span>(?=<sup|[^<]|<\/)/gs)];
    expect(cites.length).toBeGreaterThan(100);
    for (const [, id = '', cite = ''] of cites)
      expect(plain(cite)).toBe(`(${citeText(lines.get(id) ?? '')})`);
    // Each link of a reference goes to its entry of the bibliography.
    for (const [, key] of html.matchAll(/href="#ref-([a-z0-9-]+)"/g))
      expect(html).toContain(`id="ref-${key ?? ''}"`);
    for (const entry of entries) expect(html).toContain(`id="ref-${entry.key}"`);
    // The short notes: one row for each, after the rule of its page, with the words of the text.
    const shorts = [...lines.values()].filter((text) => text.includes(' | '));
    const rows = [...html.matchAll(/<span style="overflow-wrap: anywhere">(.*?)<\/span><\/div>/gs)];
    expect(rows.map(([, text = '']) => plain(text))).toEqual(
      shorts.map((text) => text.slice(text.indexOf(' | ') + 3)),
    );
    expect(html).not.toContain('{{bibliography}}');
  });

  it('moves the reference before the punctuation of the call, and drops the call of a figure note', () => {
    const notes = {
      '1': { cite: 'A, 2026', short: '' },
      '2': { cite: 'B', short: 'Why.', number: 1 },
    };
    const sup = (id: string) => `<sup data-fn="${id}" style="x">${id}</sup>`;
    const rule =
      '<div style="width: 32px; border-top: 1px solid #cfcac7; margin-bottom: 8px"></div>';
    expect(withReferences(`<p>fell 84%;${sup('1')} then</p>`, notes)).toBe(
      '<p>fell 84% <span data-cite="1">(A, 2026)</span>; then</p>',
    );
    expect(withReferences(`<p><em>Note.</em> Data: A (2026).${sup('1')}</p>`, notes)).toBe(
      '<p><em>Note.</em> Data: A (2026).</p>',
    );
    const page = withReferences(`<p>x.${sup('2')}</p>${rule}`, notes);
    expect(page).toContain('<span data-cite="2">(B)</span><sup data-fn="1"');
    expect(page).toContain('<span style="overflow-wrap: anywhere">Why.</span></div>');
    expect(() => withReferences(`<p>x${sup('2')}</p>`, notes)).toThrow(/no block of notes/);
  });
});
