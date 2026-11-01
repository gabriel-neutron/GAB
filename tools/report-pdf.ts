// Render the final text of the report to one A4 PDF for each language, in the public folder of
// the site, and write the hash of each printed page beside the PDFs.
//
//     pnpm report:pdf
//
// The PDF holds a title page, the text, the captions of the figures and the notes at the end. It
// holds no figure: the figures are live parts of the web page. Headless Chromium prints the page.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const FOLDER = resolve(import.meta.dirname, '../public/report');
export const STAMP = join(FOLDER, 'stamp.json');
export const LANGS = ['en', 'fr'] as const;
export const pdfOf = (lang: string): string => join(FOLDER, `gab-report-${lang}.pdf`);

type Lang = (typeof LANGS)[number];
interface Content {
  readonly report: { readonly title: string; readonly byline: string };
}
interface Copy {
  readonly text: string;
  readonly title: string;
  readonly byline: string;
}

/** The final text, the title and the byline of each language, read from the modules of the page
 * through `load`. The PDF gets the same French text as the page (note ids and figure numbers of
 * the English text). The types stay local: the tools project does not compile the application. */
export async function copies(
  load: (file: string) => Promise<unknown>,
): Promise<Record<Lang, Copy>> {
  const at = (file: string) => resolve(import.meta.dirname, '../src/features/report', file);
  const { sources } = (await load(at('source/index.ts'))) as {
    sources: Record<Lang, { text: string }>;
  };
  const { en } = (await load(at('content.ts'))) as { en: Content };
  const { fr } = (await load(at('content-fr.ts'))) as { fr: Content };
  const copy = (lang: Lang, content: Content): Copy => ({
    text: sources[lang].text,
    ...content.report,
  });
  return { en: copy('en', en), fr: copy('fr', fr) };
}

/** The hash of the page that Chromium prints: it changes with the text, the byline, the tool and
 * the tokens of the design system. A checkout on Windows can have CRLF line ends, so the hash
 * drops each carriage return. */
export const hashOf = (html: string): string =>
  createHash('sha256').update(html.replace(/\r/g, '')).digest('hex');

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = (text: string, marker: (id: string) => string): string =>
  escape(text)
    .replace(/\[\^([^\]]+)\]/g, (_, id: string) => `<sup>${marker(id)}</sup>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/https?:\/\/[^\s<]*[^\s<.,;)]/g, (url) => `<a href="${url}">${url}</a>`);

/** The body and the notes of a source text, as HTML. The notes get numbers in the order of their
 * first marker, and a cross-reference "n. N" in a note follows the new number. */
export function toHtml(text: string): { body: string; notes: string } {
  const lines = text.replace(/\r/g, '').split('\n');
  const notes = new Map<string, string>();
  const order: string[] = [];
  for (const line of lines) {
    const note = /^\[\^([^\]]+)\]: (.*)$/.exec(line);
    if (note !== null) notes.set(note[1] ?? '', note[2] ?? '');
    else
      for (const [, id = ''] of line.matchAll(/\[\^([^\]]+)\]/g))
        if (!order.includes(id)) order.push(id);
  }
  const number = (id: string): string => String(order.indexOf(id) + 1);
  const blocks: string[] = [];
  let figure: string | null = null;
  let inside = false;
  let chapter = 0;
  // The text of the last block when it is a paragraph.
  let paragraph: string | null = null;
  for (const line of lines) {
    // A comment of the author is a layout instruction, and the words inside a figure belong to
    // the figure.
    if (line.startsWith('<!--') || line.startsWith('[^') || line.trim() === '') continue;
    if (/^FIGURE \d+ /.test(line)) inside = true;
    if (inside) {
      inside = line.startsWith('- ') || /^FIGURE \d+ /.test(line);
      if (inside) continue;
    }
    const body = line.replace(/^> /, '');
    if (body.startsWith('## ')) {
      chapter += body.startsWith('## [N].') ? 1 : 0;
      blocks.push(`<h2>${inline(body.slice(3).replace('[N]', String(chapter)), number)}</h2>`);
    } else if (body.startsWith('### ')) blocks.push(`<h3>${inline(body.slice(4), number)}</h3>`);
    else if (body.startsWith('FIGURE: ')) figure = body.slice('FIGURE: '.length);
    else if (body.startsWith('*Note.* ')) {
      // A note with no numbered figure before it closes a map with no number: the PDF drops both.
      if (figure === null) blocks.pop();
      else {
        const [label = '', ...title] = figure.split(': ');
        blocks.push(
          `<figure><figcaption><span class="label">${escape(label)}</span>${inline(title.join(': '), number)}</figcaption><p>${inline(body, number)}</p></figure>`,
        );
      }
      figure = null;
    } else if (body.startsWith('- '))
      blocks.push(`<li>${inline(body.slice(2).replace(/^–/, ''), number)}</li>`);
    else {
      // The source text cuts some paragraphs in two around their notes: a paragraph that ends
      // with no stop goes on in the next one.
      if (paragraph !== null && /[\p{L}\d,]$/u.test(paragraph)) {
        blocks.pop();
        paragraph = `${paragraph} ${body}`;
      } else paragraph = body;
      blocks.push(`<p>${inline(paragraph, number)}</p>`);
      continue;
    }
    paragraph = null;
  }
  const list = order
    .filter((id) => notes.has(id))
    .map((id) => {
      const note = (notes.get(id) ?? '').replace(/\bn\. (\d+)/g, (match, old: string) =>
        order.includes(old) ? `n. ${number(old)}` : match,
      );
      return `<li value="${number(id)}">${inline(note, number)}</li>`;
    });
  return {
    // A run of list items is one list. An item holds no line end.
    body: blocks.join('\n').replace(/(?:<li>.*<\/li>\n?)+/g, (run) => `<ul>${run}</ul>`),
    notes: `<ol class="notes">${list.join('\n')}</ol>`,
  };
}

const font = (family: string, file: string, weight: number): string => {
  const data = readFileSync(
    resolve(import.meta.dirname, `../node_modules/@fontsource/${family}/files/${file}`),
  ).toString('base64');
  const name = family === 'geist' ? 'Geist' : 'Geist Mono';
  return `@font-face{font-family:'${name}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
};

// The type of the design system: Geist for the text, Geist Mono for the labels. Weight 400, and
// 500 for a strong run. The colours are the tokens of the light theme of the site.
function css(): string {
  const tokens =
    /^:root \{([^}]*)\}/m.exec(
      readFileSync(resolve(import.meta.dirname, '../src/index.css'), 'utf8'),
    )?.[1] ?? '';
  const fonts = ['latin', 'latin-ext', 'cyrillic']
    .flatMap((set) => [
      font('geist', `geist-${set}-400-normal.woff2`, 400),
      font('geist', `geist-${set}-500-normal.woff2`, 500),
      font('geist-mono', `geist-mono-${set}-400-normal.woff2`, 400),
    ])
    .join('\n');
  return `${fonts}
:root{${tokens}}
@page{size:A4;margin:22mm 24mm 24mm;@bottom-right{content:counter(page);font:400 7.5pt 'Geist Mono';color:var(--label)}}
@page:first{@bottom-right{content:none}}
html{font:400 9.5pt/1.55 Geist,sans-serif;color:var(--foreground);hyphens:auto;text-rendering:optimizeLegibility}
body{margin:0}
.cover{height:251mm;display:flex;flex-direction:column;justify-content:flex-end;break-after:page}
.byline{font:400 8.5pt 'Geist Mono';color:var(--muted-foreground);margin:6mm 0 0}
.cover .rule{height:3mm;width:24mm;background:var(--signal);margin-bottom:8mm}
h1{font-weight:400;font-size:34pt;line-height:1.02;letter-spacing:-0.035em;margin:0;max-width:150mm}
h2{font-weight:400;font-size:20pt;line-height:1.1;letter-spacing:-0.02em;margin:0 0 6mm;padding-top:2mm;border-top:0.4mm solid var(--foreground);break-before:page;break-after:avoid}
h3{font-weight:500;font-size:11pt;line-height:1.3;margin:6mm 0 2mm;break-after:avoid}
p{margin:0 0 2.6mm;orphans:3;widows:3}
strong{font-weight:500}
sup{font:400 0.68em 'Geist Mono';line-height:0;color:var(--signal);margin-left:0.1em}
a{color:inherit;text-decoration:none}
ul{list-style:none;padding:0;margin:0 0 3mm}
ul li{position:relative;padding-left:5mm;margin-bottom:1.6mm}
ul li::before{content:'–';position:absolute;left:0;color:var(--signal)}
figure{margin:4mm 0 5mm;padding:2.5mm 0 0;border-top:0.25mm solid var(--border);break-inside:avoid}
figcaption{font-weight:500;font-size:9.5pt;line-height:1.35;margin-bottom:1.2mm}
.label{display:block;font:400 7.5pt 'Geist Mono';letter-spacing:0.06em;text-transform:uppercase;color:var(--label);margin-bottom:0.8mm}
figure p{font-size:8pt;line-height:1.45;color:var(--muted-foreground);margin:0}
.notes{font-size:7.5pt;line-height:1.45;padding-left:8mm;margin:0;overflow-wrap:anywhere;hyphens:manual}
.notes li{margin-bottom:1.4mm;padding-left:1mm}
.notes li::marker{font-family:'Geist Mono';color:var(--label)}`;
}

/** The page that Chromium prints for one language. */
export function htmlOf(lang: Lang, { text, title, byline }: Copy): string {
  const { body, notes } = toHtml(text);
  const sign = `<p class="byline">${escape(byline)}</p>`;
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escape(title)}</title><meta name="author" content="${escape(byline)}"><style>${css()}</style></head><body>` +
    `<section class="cover"><div class="rule"></div><h1>${escape(title)}</h1>${sign}</section>` +
    `${body}${sign}<h2>Notes</h2>${notes}</body></html>`
  );
}

async function main(): Promise<void> {
  const { chromium } = await import('playwright');
  const { runnerImport } = await import('vite');
  const all = await copies(async (file) => (await runnerImport(file)).module);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const stamp: Record<string, string> = {};
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
  await browser.close();
  writeFileSync(
    STAMP,
    `${JSON.stringify(stamp, null, 2)}
`,
  );
}

if (import.meta.main) await main();
