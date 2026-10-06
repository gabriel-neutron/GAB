import { describe, expect, test } from 'vitest';

import { extractText } from './extract.ts';

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);

// A PDF written by hand. Each page holds one text line, or none. The line is the raw operand of
// a string, so a caller can write an octal escape in it.
const pdfOf = (pages: readonly (string | null)[]): Uint8Array => {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((line, i) => {
    const stream = line === null ? '' : `BT /F1 18 Tf 20 100 Td (${line}) Tj ET`;
    objects[4 + i * 2] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] ' +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objects[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
};

describe('extractText', () => {
  test('a PDF of two pages gives two pages', async () => {
    const { pages } = await extractText(
      pdfOf(['Nayara lenders', 'Second page']),
      'application/pdf',
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain('Nayara lenders');
    expect(pages[1]).toContain('Second page');
  });

  test('a PDF page with no text layer is an empty page', async () => {
    const { pages } = await extractText(pdfOf(['Only this', null]), 'application/pdf');
    expect(pages).toHaveLength(2);
    expect(pages[1]).toBe('');
  });

  test('a NUL character in a PDF page is removed, because PostgreSQL text refuses it', async () => {
    const { pages } = await extractText(pdfOf(['AB\\000CD']), 'application/pdf');
    expect(pages).toHaveLength(1);
    expect(pages[0]).not.toContain('\u0000');
    expect(pages[0]).toMatch(/^AB\s?CD$/);
  });

  test('a NUL byte in plain text is removed', async () => {
    const { pages } = await extractText(Uint8Array.of(97, 0, 98), 'text/plain');
    expect(pages).toStrictEqual(['ab']);
  });

  test('an HTML page gives its live text without the navigation', async () => {
    const html = `<html><head><title>Fleet</title></head><body>
      <nav><ul><li><a href="/home">Home page link</a></li><li><a href="/about">About us link</a></li></ul></nav>
      <article><h1>Shadow fleet</h1>
      <p>${'The tanker changed its flag three times in one year, and each owner was a new shell company. '.repeat(6)}</p>
      <p>${'A second paragraph says that the lender sits in a port city of the Gulf. '.repeat(6)}</p>
      </article>
      <footer>Copyright footer text</footer></body></html>`;
    const { pages, extractor } = await extractText(bytesOf(html), 'text/html');
    expect(extractor).toBe('html-live-1');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Shadow fleet');
    expect(pages[0]).toContain('changed its flag');
    expect(pages[0]).not.toContain('Home page link');
  });

  test.each(['text/plain', 'text/markdown', 'text/csv', 'application/xml', 'text/xml'])(
    '%s is returned as it is',
    async (mime) => {
      const { pages, extractor } = await extractText(bytesOf('a,b\n1,2\n'), mime);
      expect(pages).toStrictEqual(['a,b\n1,2\n']);
      expect(extractor).toBe('text-1');
    },
  );

  test('a ZIP is refused with its reason', async () => {
    await expect(extractText(bytesOf('PK'), 'application/zip')).rejects.toThrow(/application\/zip/);
  });
});
