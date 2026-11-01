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

export const FOLDER = resolve(import.meta.dirname, '../public/report');
export const STAMP = join(FOLDER, 'stamp.json');
export const LANGS = ['en', 'fr'] as const;
export const pdfOf = (lang: string): string => join(FOLDER, `gab-report-${lang}.pdf`);
export const TEMPLATES = resolve(import.meta.dirname, 'report-pdf');
export const pagesOf = (lang: string): string[] =>
  readdirSync(join(TEMPLATES, 'pages', lang))
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => join(TEMPLATES, 'pages', lang, file));

type Lang = (typeof LANGS)[number];
interface Copy {
  readonly byline: string;
}

/** The byline of each language, read from the modules of the page through `load`. The types stay
 * local: the tools project does not compile the application. */
export async function copies(
  load: (file: string) => Promise<unknown>,
): Promise<Record<Lang, Copy>> {
  const at = (file: string) => resolve(import.meta.dirname, '../src/features/report', file);
  const { en } = (await load(at('content.ts'))) as { en: { report: Copy } };
  const { fr } = (await load(at('content-fr.ts'))) as { fr: { report: Copy } };
  return { en: { byline: en.report.byline }, fr: { byline: fr.report.byline } };
}

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
export function htmlOf(lang: Lang, { byline }: Copy): string {
  const sheets = pagesOf(lang).map((file) => {
    const page = readFileSync(file, 'utf8')
      .replace('{{byline}}', escape(byline))
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
  const stamp: Record<string, string> = {};
  try {
    const page = await browser.newPage();
    for (const lang of LANGS) {
      const html = htmlOf(lang, all[lang]);
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: pdfOf(lang),
        preferCSSPageSize: true,
        printBackground: true,
        tagged: true,
        outline: true,
      });
      stamp[lang] = hashOf(html);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(STAMP, `${JSON.stringify(stamp, null, 2)}\n`);
}

if (import.meta.main) await main();
