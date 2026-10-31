// A fault of the OCR engine can name a path of the machine. The caller gets a fixed sentence.

import { afterAll, expect, test, vi } from 'vitest';

import { endOcr, extractText, OCR_FAULT, RefusedImageError } from './extract.ts';

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(() =>
    Promise.resolve({
      recognize: () => Promise.reject(new Error('spawn /home/someone/.cache/ocr ENOENT\n  at x')),
      terminate: () => Promise.resolve(),
    }),
  ),
}));

afterAll(async () => {
  await endOcr();
});

// The signature and the header chunk of a PNG image of 10 by 10 pixels.
const PNG = Uint8Array.from([
  ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52],
  ...[0, 0, 0, 10, 0, 0, 0, 10, 8, 2, 0, 0, 0],
]);

test('a fault of the OCR engine gives a fixed sentence, and the path goes to the log', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const failure = await extractText(PNG, 'image/png').catch((fault: unknown) => fault);
  expect(failure).toBeInstanceOf(RefusedImageError);
  expect((failure as Error).message).toBe(OCR_FAULT);
  expect((failure as Error).message).not.toContain('/home/');
  expect(logged).toHaveBeenCalledTimes(1);
  logged.mockRestore();
});
