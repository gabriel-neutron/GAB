import { expect, it } from 'vitest';

import { documentName } from './document-name';

const document = (title: string, uri: string | null) => ({ id: 'd1', title, uri, mime: null });

it('names a document by its title', () => {
  expect(
    documentName(document('Financial sanctions and the trade of Russia', 'https://a.org/b.pdf')),
  ).toBe('Financial sanctions and the trade of Russia');
});

it('names a document whose title is its address by the host and the file name', () => {
  const address = 'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr1047.pdf';
  expect(documentName(document(address, address))).toBe('newyorkfed.org: sr1047.pdf');
});

it('reads a title that is an address with no scheme as an address', () => {
  const title =
    'www.ebrd.com/content/dam/ebrd_dxp/assets/pdfs/office-of-the-chief-economist/working-papers/working-papers-2023/WP-276.pdf';
  expect(documentName(document(title, `https://${title}`))).toBe('ebrd.com: WP-276.pdf');
});

it('names a document with an empty title by its address, or by its identifier', () => {
  expect(documentName(document('', 'https://ebrd.com/'))).toBe('ebrd.com');
  expect(documentName(document(' ', null))).toBe('d1');
});
