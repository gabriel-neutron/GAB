// OCR of a PNG and a JPEG image. Each fixture holds large black words on white, in English, in
// Ukrainian and in Russian, so a check of whole words stays true when OCR misreads one sign.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { endOcr, extractText, mimeOfFileName, RefusedImageError } from './extract.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');

const fixture = async (name: string): Promise<Uint8Array> => readFile(join(FIXTURES, name));

const u32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

// The signature and the header chunk of a PNG image of this size, then bytes that are no image.
const pngHead = (width: number, height: number): Uint8Array =>
  Uint8Array.from([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...u32(13),
    ...[0x49, 0x48, 0x44, 0x52],
    ...u32(width),
    ...u32(height),
    ...[8, 2, 0, 0, 0],
    ...u32(0),
    ...new Array<number>(64).fill(0x41),
  ]);

// The start marker and one baseline frame header of a JPEG image of this size.
const jpegHead = (width: number, height: number): Uint8Array =>
  Uint8Array.from([
    ...[0xff, 0xd8],
    ...[0xff, 0xe0, 0x00, 0x04, 0x00, 0x00],
    ...[0xff, 0xc0, 0x00, 0x11, 0x08],
    ...[(height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff],
    ...new Array<number>(10).fill(0),
  ]);

afterAll(async () => {
  await endOcr();
});

describe('extractText of an image', () => {
  test('a PNG image gives one page with its English and Cyrillic words', async () => {
    const { pages } = await extractText(await fixture('unit-tree.png'), 'image/png');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('BRIGADE HEADQUARTERS');
    expect(pages[0]).toContain('Бригада');
    expect(pages[0]).toContain('Командування');
  });

  test('a JPEG image gives one page with its English and Cyrillic words', async () => {
    const { pages } = await extractText(await fixture('unit-tree.jpg'), 'image/jpeg');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('ARTILLERY BATTALION');
    expect(pages[0]).toContain('Батальйон');
    expect(pages[0]).toContain('Полк');
  });

  test('an image with no words gives one empty page', async () => {
    const { pages } = await extractText(await fixture('blank.png'), 'image/png');
    expect(pages).toStrictEqual(['']);
  });

  test.each([
    ['a PNG', pngHead(10_000, 10_000), 'image/png'],
    ['a JPEG', jpegHead(65_000, 1_000), 'image/jpeg'],
  ])('%s image above the pixel cap is refused from its header', async (_, bytes, mime) => {
    await expect(extractText(bytes, mime)).rejects.toThrow(RefusedImageError);
    await expect(extractText(bytes, mime)).rejects.toThrow(/pixels/);
  });

  test('bytes with no image header are refused', async () => {
    await expect(extractText(Uint8Array.of(1, 2, 3), 'image/png')).rejects.toThrow(
      RefusedImageError,
    );
  });

  test('after a failed OCR job, the next image is read', async () => {
    await expect(extractText(pngHead(40, 40), 'image/png')).rejects.toThrow(RefusedImageError);
    const { pages } = await extractText(await fixture('unit-tree.png'), 'image/png');
    expect(pages[0]).toContain('BRIGADE HEADQUARTERS');
  });

  test.each([
    ['tree.png', 'image/png'],
    ['photo.JPG', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
  ])('the file name %s names the type %s', (name, mime) => {
    expect(mimeOfFileName(name)).toBe(mime);
  });
});
