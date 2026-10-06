// Writes the invented card that the OCR test reads. Run it once with `node` when the card must
// change; the PNG it writes is committed in the text package. Every value on the card is invented.

import { writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const HTML = `<!doctype html><html><body style="margin:0;background:#fff">
<div id="card" style="width:640px;padding:24px;font:28px/1.5 'DejaVu Sans',Arial,sans-serif;color:#000">
<div>NAYARA STAR</div>
<div>IMO 9123453</div>
<div>Master: Ivan Petrov</div>
<div>Born 3 February 1970</div>
<div>Address: 12 Harbour Street, Sikka</div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(HTML);
  const card = page.locator('#card');
  writeFileSync(
    new URL('../packages/text/fixtures/ocr-card.png', import.meta.url),
    await card.screenshot({ type: 'png' }),
  );
} finally {
  await browser.close();
}
