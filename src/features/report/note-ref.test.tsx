import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoteRef } from './note-ref';
import { noteDocuments } from './note-documents';

describe('NoteRef', () => {
  it('is a button with the visible number, "Source N" for a screen reader and its open state', () => {
    const html = renderToStaticMarkup(<NoteRef partSlug="summary" id="2" />);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('aria-haspopup="dialog" aria-expanded="false"');
    expect(html).toContain('aria-label="Source 2"');
    expect(html).toMatch(/>2<\/button>$/);
  });

  it('draws nothing for a note that the part does not hold', () => {
    expect(renderToStaticMarkup(<NoteRef partSlug="summary" id="999" />)).toBe('');
  });
});

describe('noteDocuments', () => {
  it('gives the rows of a note, and no row for a note with no document', () => {
    expect(noteDocuments('2')?.documents.map((document) => document.id)).toEqual([
      'doc_f42628ac12e6',
    ]);
    expect(noteDocuments('1')?.documents).toEqual([]);
    expect(noteDocuments('999')).toBeUndefined();
  });
});
