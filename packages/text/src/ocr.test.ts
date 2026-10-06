import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { extractText, OCR_EXTRACTOR } from './extract.ts';

// An invented card, written once by a script in a browser. No value on it is real.
const CARD = readFileSync(new URL('../fixtures/ocr-card.png', import.meta.url));

// Origin: measured on 6 October 2026. One OCR run of the card takes about four seconds on the
// VPS, and the first run also copies the language data.
const OCR_TIMEOUT = 60_000;

describe('the OCR text of an image', () => {
  test(
    'reads the words of the card from the pinned language data, as one page',
    async () => {
      const { pages, extractor } = await extractText(CARD, 'image/png');
      expect(extractor).toBe(OCR_EXTRACTOR);
      expect(pages).toHaveLength(1);
      expect(pages[0]).toContain('NAYARA STAR');
      expect(pages[0]).toContain('IMO 9123453');
      expect(pages[0]).toContain('Ivan Petrov');
    },
    OCR_TIMEOUT,
  );

  test(
    'refuses bytes that are no image, and throws nothing outside the call',
    async () => {
      const bytes = new TextEncoder().encode('not an image');
      await expect(extractText(bytes, 'image/png')).rejects.toThrow();
    },
    OCR_TIMEOUT,
  );

  test('the extractor names the engine version and the data version', () => {
    expect(OCR_EXTRACTOR).toMatch(/^tesseract:\d+\.\d+\.\d+:4\.0\.0_best_int$/u);
  });
});
