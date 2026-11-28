// Save the still figures of the paper report as standalone SVG files, in the light (Bone) theme of the site.
//
//     node tools/report/export-figures.mjs [--png] OUT_DIR [NAME ...]   (the dev server must run: pnpm dev)
//
// Each figure is the React component of the web report in its print mode (route /report-figure). The
// computed styles are written into each SVG element and the Geist fonts are embedded, so the file
// looks the same in an <img> tag, in the PDF and in a browser.
//
// --png saves NAME.png instead: the figure at 3 pixels for each CSS pixel, with a clear background.
// These are the images of tools/report-pdf/figures/en/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.REPORT_BASE ?? 'http://localhost:5173';
const args = process.argv.slice(2);
const png = args.includes('--png');
const [out, ...names] = args.filter((a) => a !== '--png');
if (!out) throw new Error('usage: node tools/report/export-figures.mjs [--png] OUT_DIR [NAME ...]');
const figures = names.length ? names : ['prices'];
const font = (pkg, file) =>
  readFileSync(join('node_modules', '@fontsource', pkg, 'files', file)).toString('base64');
const fontFaces =
  `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font('geist', 'geist-latin-400-normal.woff2')}) format('woff2')}` +
  `@font-face{font-family:'Geist Mono';src:url(data:font/woff2;base64,${font('geist-mono', 'geist-mono-latin-400-normal.woff2')}) format('woff2')}`;
const PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'letter-spacing',
  'text-transform',
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  // A tall viewport: the page does not scroll, so a figure must fit in it whole.
  viewport: { width: 800, height: png ? 4000 : 600 },
  deviceScaleFactor: png ? 3 : 1,
});
// The theme script of index.html reads this key before the first paint.
await page.addInitScript(() =>
  localStorage.setItem('gab.shell.v1', JSON.stringify({ theme: 'light' })),
);
for (const name of figures) {
  await page.goto(`${BASE}/report-figure?name=${encodeURIComponent(name)}`);
  if (png) {
    const root = page.locator('.report-page svg').first();
    await root.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content:
        'html,body,#root,.report-page,.report-page > figure,.report-page svg{background:transparent!important}',
    });
    const file = join(out, `${name}.png`);
    await root.screenshot({ path: file, omitBackground: true, animations: 'disabled' });
    console.log(file);
    continue;
  }
  const svg = page.locator('.report-page svg').first();
  await svg.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const markup = await svg.evaluate((root, props) => {
    const copy = root.cloneNode(true);
    const source = [root, ...root.querySelectorAll('*')];
    [copy, ...copy.querySelectorAll('*')].forEach((el, i) => {
      const style = getComputedStyle(source[i]);
      el.removeAttribute('class');
      el.setAttribute('style', props.map((p) => `${p}:${style.getPropertyValue(p)}`).join(';'));
    });
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return copy.outerHTML;
  }, PROPS);
  const file = join(out, `${name}.svg`);
  writeFileSync(file, markup.replace(/^<svg([^>]*)>/, `<svg$1><style>${fontFaces}</style>`));
  console.log(file);
}
await browser.close();
