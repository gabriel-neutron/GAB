// OCR of a PNG and a JPEG image. Each fixture holds large black words on white, in English, in
// Ukrainian and in Russian, so a check of whole words stays true when OCR misreads one sign.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { endOcr, extractText, mimeOfFileName } from './extract.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');

const fixture = async (name: string): Promise<Uint8Array> => readFile(join(FIXTURES, name));

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
    ['tree.png', 'image/png'],
    ['photo.JPG', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
  ])('the file name %s names the type %s', (name, mime) => {
    expect(mimeOfFileName(name)).toBe(mime);
  });
});
