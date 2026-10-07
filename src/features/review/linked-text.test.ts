import { expect, it } from 'vitest';

import { linkedText } from './linked-text';

it('turns each long address into one link that shows its host', () => {
  const address =
    'https://ru.wikipedia.org/wiki/5-%D1%8F_%D0%B3%D0%B2%D0%B0%D1%80%D0%B4%D0%B5%D0%B9%D1%81%D0%BA%D0%B0%D1%8F';
  expect(linkedText(`sources: https://www.newyorkfed.org/a.pdf ${address}`)).toStrictEqual([
    { kind: 'text', text: 'sources: ' },
    { kind: 'link', href: 'https://www.newyorkfed.org/a.pdf', host: 'newyorkfed.org' },
    { kind: 'text', text: ' ' },
    { kind: 'link', href: address, host: 'ru.wikipedia.org' },
  ]);
});

it('keeps a text with no address as one part', () => {
  expect(linkedText('echelon: Army | affiliation: Hostile')).toStrictEqual([
    { kind: 'text', text: 'echelon: Army | affiliation: Hostile' },
  ]);
});

it('keeps the bar that follows an address out of the link', () => {
  expect(linkedText('https://t.me/s/channel| next')).toStrictEqual([
    { kind: 'link', href: 'https://t.me/s/channel', host: 't.me' },
    { kind: 'text', text: '| next' },
  ]);
});
