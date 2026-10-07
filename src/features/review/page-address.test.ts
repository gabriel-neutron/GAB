import { expect, it } from 'vitest';

import { pageAddress } from './page-address';

const PDF = {
  id: 'doc_2852b6ae9b28',
  title: 'A report',
  uri: 'https://www.newyorkfed.org/medialibrary/sr1047.pdf',
  mime: 'application/pdf',
};

it('opens a PDF at the page that the act cites', () => {
  expect(pageAddress(PDF, 14)).toBe('https://www.newyorkfed.org/medialibrary/sr1047.pdf#page=14');
});

it('opens any other document at its address', () => {
  expect(pageAddress({ ...PDF, uri: 'https://example.org/a', mime: 'text/html' }, 3)).toBe(
    'https://example.org/a',
  );
});

it('gives no address for a document that has none', () => {
  expect(pageAddress({ ...PDF, uri: null, mime: 'text/plain' }, 1)).toBeNull();
});
