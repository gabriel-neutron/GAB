// Print the report to one A4 PDF for each language, in the public folder of the site, and write
// the hash of each printed page beside the PDFs.
//
//     pnpm report:pdf
//
// Each page of a PDF is one template of `report-pdf/pages/<lang>/`, in the order of the file
// names. The templates are the pages of the print design of the operator, with the same markup and
// styles; the English pages have the final English text. The figures are the pictures in
// `report-pdf/figures/`. Headless Chromium prints the pages, with no network access.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DATA_RELEASE_SHA256, DATA_RELEASE_TAG } from './data-release.ts';
import { layout, type LayoutInput } from './report-pdf/layout.ts';

const FOLDER = resolve(import.meta.dirname, '../public/report');
export const STAMP = join(FOLDER, 'stamp.json');
/** The data release that the report names: the public record that a reader can load and count. */
export const recordOf = (): { tag: string; sha256: string } => ({
  tag: DATA_RELEASE_TAG,
  sha256: DATA_RELEASE_SHA256,
});
export const LANGS = ['en'] as const;
export const pdfOf = (lang: string): string => join(FOLDER, `gab-report-${lang}.pdf`);
const TEMPLATES = resolve(import.meta.dirname, 'report-pdf');
export const pagesOf = (lang: string): string[] =>
  readdirSync(join(TEMPLATES, 'pages', lang))
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => join(TEMPLATES, 'pages', lang, file));

type Lang = (typeof LANGS)[number];
/** One note of the text: its reference as HTML, and its short note with its number. */
interface PrintedNote {
  readonly cite: string;
  readonly short: string;
  readonly number?: number;
}
interface Copy {
  readonly byline: string;
  readonly notes: Readonly<Record<string, PrintedNote>>;
  /** The blocks of the bibliography page, as HTML. */
  readonly bibliography: string;
}

// The types of the modules of the page that the tool reads. The types stay local: the tools
// project does not compile the application.
interface Entry {
  readonly key: string;
  readonly group: string;
  readonly cite: string;
  readonly issuer: string;
  readonly date: string;
  readonly title: string;
  readonly url: string;
  readonly detail?: string;
}
interface Line {
  readonly id: string;
  readonly text: string;
}
interface Bibliography {
  readonly GROUPS: Record<string, string>;
  readonly entryOf: (key: string) => Entry;
  readonly citeParts: (text: string) => readonly { label: string; key: string }[];
  readonly noteText: (text: string) => string;
  readonly locatorsOf: (notes: Line[]) => ReadonlyMap<string, readonly string[]>;
  readonly shortNoteNumbers: (notes: Line[]) => ReadonlyMap<string, number>;
  readonly citingNotes: (notes: Line[]) => ReadonlyMap<string, string[]>;
  readonly groupedEntries: () => readonly (readonly [string, readonly Entry[]])[];
}
interface Documents {
  readonly sourceDocuments: (
    source: Entry,
    noteIds: Iterable<string>,
  ) => { id: string; retrievedAt: string }[];
}

const SOURCE = resolve(import.meta.dirname, '../src/features/report/source/report-en.md');
const MONO = "font-family: 'Geist Mono', ui-monospace, monospace";
const LINK = 'color: inherit; text-decoration: none';
const ENTRY =
  'margin: 0 0 3px; max-width: 650px; padding-left: 14px; text-indent: -14px; font-size: 10px; line-height: 12.5px; color: #101010; overflow-wrap: anywhere; text-wrap: pretty';
const GROUP =
  'margin: 14px 0 6px; max-width: 650px; font-size: 15px; line-height: 20px; font-weight: 400; color: #101010; text-wrap: balance; clear: both';
const META = `${MONO}; font-size: 9px; color: #645f5c`;
const CALL_STYLE = `${MONO}; font-size: 11px; line-height: 0; vertical-align: super; color: #b8470d`;

/** The byline, the notes and the bibliography of each language, read from the final text and the
 * modules of the page through `load`. */
export async function copies(
  load: (file: string) => Promise<unknown>,
): Promise<Record<Lang, Copy>> {
  const at = (file: string) => resolve(import.meta.dirname, '../src/features/report', file);
  const { en } = (await load(at('content.ts'))) as { en: { report: { byline: string } } };
  const bib = (await load(at('bibliography.ts'))) as Bibliography;
  const { sourceDocuments } = (await load(at('note-documents.ts'))) as Documents;
  const lines: Line[] = [...readFileSync(SOURCE, 'utf8').matchAll(/^\[\^(\d+)\]: (.*)$/gmu)].map(
    ([, id = '', text = '']) => ({ id, text: text.trim() }),
  );
  const numbers = bib.shortNoteNumbers(lines);
  const notes: Record<string, PrintedNote> = {};
  for (const { id, text } of lines) {
    // The reference in the text: (author, year) items, each a link to its entry.
    const html = bib
      .citeParts(text)
      .map(({ label, key }) => `<a href="#ref-${key}" style="${LINK}">${escape(label)}</a>`)
      .join('; ');
    const number = numbers.get(id);
    notes[id] = {
      cite: html,
      short: bib.noteText(text),
      ...(number === undefined ? {} : { number }),
    };
  }
  const locators = bib.locatorsOf(lines);
  const citing = bib.citingNotes(lines);
  const bibliography = bib
    .groupedEntries()
    .flatMap(([group, entries]) => [
      `<h3 style="${GROUP}">${escape(bib.GROUPS[group] ?? group)}</h3>`,
      ...entries.map((entry) => {
        const stored = sourceDocuments(entry, citing.get(entry.key) ?? []);
        // The latest stored copy: the web page and the source list give every copy.
        const latest = [...stored]
          .sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt))
          .at(-1);
        const more = stored.length > 1 ? ` and ${String(stored.length - 1)} more` : '';
        const record =
          latest === undefined
            ? ''
            : ` <span style="${META}">Accessed ${latest.retrievedAt}; stored ${latest.id}${more}.</span>`;
        const detail = entry.detail === undefined ? '' : ` ${escape(entry.detail)}.`;
        const at = locators.get(entry.key) ?? [];
        const cited = at.length === 0 ? '' : ` Cited: ${escape(at.join('; '))}.`;
        return `<p id="ref-${entry.key}" style="${ENTRY}"><strong style="font-weight: 500">${escape(entry.cite.replace(/\.$/u, ''))}.</strong> ${escape(entry.issuer)} (${escape(entry.date)}). <em>${escape(entry.title)}</em>.${detail}${cited} ${escape(entry.url)}${record}</p>`;
      }),
    ])
    .join('\n');
  return { en: { byline: en.report.byline, notes, bibliography } };
}

const CALL = /([.,;:]*)<sup data-fn="(\d+)"[^>]*>\d+<\/sup>/g;
// The short rule above the notes of a page: the short notes of the page go after it.
const RULE = '<div style="width: 32px; border-top: 1px solid #cfcac7; margin-bottom: 8px"></div>';
const FIGURE_NOTE = '<em>Source:</em>';

/** One page with its references in the text: each call of a note becomes the reference in its
 * parenthesis, before the punctuation that came before the call, and a note with a short note
 * keeps a call with its number. A figure note names its sources already: its call goes. The
 * short notes of the calls of the page go in its block of notes. */
export function withReferences(page: string, notes: Copy['notes']): string {
  const shorts: string[] = [];
  const text = page
    .split(/(?=<p\b)/)
    .map((block) =>
      block.replace(CALL, (_, stop: string, id: string) => {
        const note = notes[id];
        if (note === undefined) throw new Error(`note ${id} is not in the final text`);
        let call = '';
        if (note.number !== undefined) {
          const number = String(note.number);
          call = `<sup data-fn="${number}" style="${CALL_STYLE}">${number}</sup>`;
          shorts.push(
            `<div style="display: grid; grid-template-columns: 28px minmax(0, 1fr); margin: 0 0 3px; font-size: 12px; line-height: 16px; color: #4d4947"><span style="${MONO}; color: #b8470d">${number}</span><span style="overflow-wrap: anywhere">${escape(note.short)}</span></div>`,
          );
        }
        if (block.includes(FIGURE_NOTE) || note.cite === '') return `${call}${stop}`;
        return ` <span data-cite="${id}">(${note.cite})</span>${call}${stop}`;
      }),
    )
    .join('');
  if (shorts.length === 0) return text;
  if (!text.includes(RULE)) throw new Error('a page with a short note has no block of notes');
  return text.replace(RULE, () => RULE + shorts.join(''));
}

/** The input of the layout pass. A footnote of the PDF is a short note (an explanation or a
 * caveat), and the bibliography gives the address of each source: no footnote gets a link line. */
export function layoutInputOf(): LayoutInput {
  return { linkLabel: 'Link:', links: {} };
}

/** The stamp of one language: the printed page, the code of the layout pass and its input. */
export const stampOf = (lang: Lang, copy: Copy): string =>
  hashOf(
    htmlOf(lang, copy) +
      readFileSync(join(TEMPLATES, 'layout.ts'), 'utf8') +
      JSON.stringify(layoutInputOf()),
  );

/** The hash of the page that Chromium prints: it changes with a template, a figure, the byline and
 * the tool. A checkout on Windows can have CRLF line ends, so the hash drops each carriage return. */
export const hashOf = (html: string): string =>
  createHash('sha256').update(html.replace(/\r/g, '')).digest('hex');

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const font = (family: string, file: string, weight: number): string => {
  const data = readFileSync(
    resolve(import.meta.dirname, `../node_modules/@fontsource/${family}/files/${file}`),
  ).toString('base64');
  const name = family === 'geist' ? 'Geist' : 'Geist Mono';
  return `@font-face{font-family:'${name}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
};

// The type of the design: Geist 400 and 500, Geist Mono 400. The page box is the A4 sheet; the
// root of each template is 794 × 1123 px, the A4 sheet at 96 px per inch.
function css(): string {
  const fonts = ['latin', 'latin-ext', 'cyrillic']
    .flatMap((set) => [
      font('geist', `geist-${set}-400-normal.woff2`, 400),
      font('geist', `geist-${set}-500-normal.woff2`, 500),
      font('geist-mono', `geist-mono-${set}-400-normal.woff2`, 400),
    ])
    .join('\n');
  return `${fonts}
@page{size:A4;margin:0}
body{margin:0;background:#eeeeee}
a{color:#101010}
.sheet{width:210mm;height:297mm;overflow:hidden;break-after:page}`;
}

/** The page that Chromium prints for one language: each template in a sheet, the byline in place
 * of `{{byline}}` and each figure inline. */
export function htmlOf(lang: Lang, copy: Copy): string {
  const { byline } = copy;
  const sheets = pagesOf(lang).map((file) => {
    const page = withReferences(readFileSync(file, 'utf8'), copy.notes)
      .replace('{{byline}}', () => escape(byline))
      .replace('{{bibliography}}', () => copy.bibliography)
      .replace(/src="(figures\/[^"]+\.png)"/g, (_, path: string) => {
        const data = readFileSync(join(TEMPLATES, path)).toString('base64');
        return `src="data:image/png;base64,${data}"`;
      });
    return `<div class="sheet">${page}</div>`;
  });
  // The title of the PDF is the title of the cover.
  const title = /<h1[^>]*>([^<]*)<\/h1>/.exec(sheets[0] ?? '')?.[1] ?? '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title><meta name="author" content="${escape(byline)}"><style>${css()}</style></head><body>${sheets.join('\n')}</body></html>`;
}

async function main(): Promise<void> {
  const { chromium } = await import('playwright');
  const { runnerImport } = await import('vite');
  const all = await copies(async (file) => (await runnerImport(file)).module);
  const browser = await chromium.launch();
  const stamp: Record<string, { hash: string; pages: number }> = {};
  try {
    const page = await browser.newPage();
    for (const lang of LANGS) {
      await page.setContent(htmlOf(lang, all[lang]), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const { faults, ...counts } = await page.evaluate(layout, layoutInputOf());
      // A clipped element, a note that does not fit, or a note away from its call stops the tool.
      if (faults.length > 0) throw new Error(`The ${lang} PDF has faults:\n${faults.join('\n')}`);
      console.log(lang, JSON.stringify(counts));
      await page.pdf({
        path: pdfOf(lang),
        preferCSSPageSize: true,
        printBackground: true,
        tagged: true,
        outline: true,
      });
      stamp[lang] = { hash: stampOf(lang, all[lang]), pages: counts.pages };
    }
  } finally {
    await browser.close();
  }
  writeFileSync(STAMP, `${JSON.stringify({ ...stamp, record: recordOf() }, null, 2)}\n`);
}

if (import.meta.main) await main();
