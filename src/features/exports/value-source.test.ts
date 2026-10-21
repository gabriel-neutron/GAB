import { expect, test } from 'vitest';

import type { FigureRow } from './figure-rows';
import { EXPORTS_RELEASE } from './fixture-release';
import { documentsOf, sourceOf } from './value-source';

const row = (document: string): FigureRow => ({
  serie: 'A',
  period: '2025',
  value: 1,
  unit: '%',
  document,
  page: '3',
  excerpt: 'B2',
  note: '',
});

test('a document of the release gives its title, its address and the place of the value', () => {
  const documents = documentsOf(EXPORTS_RELEASE);
  const [id, known] = [...documents].find(([, one]) => one.href !== null) ?? [];
  expect(id).toBeDefined();
  const source = sourceOf(row(id ?? ''), documents);
  expect(source.href).toBe(known?.href);
  expect(source.words).toBe(`${known?.words ?? ''}, p. 3, B2`);
});

test('an address in the file is the link when the release does not hold the document', () => {
  const source = sourceOf(row('https://example.org/file.pdf'), new Map());
  expect(source.href).toBe('https://example.org/file.pdf');
});

test('an unknown identifier stays text, so the page never links to a guess', () => {
  expect(sourceOf(row('doc_unknown'), new Map()).href).toBeNull();
  expect(sourceOf(row('javascript:alert(1)'), new Map()).href).toBeNull();
});
