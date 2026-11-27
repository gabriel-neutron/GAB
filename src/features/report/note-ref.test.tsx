import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoteRef } from './note-ref';
import { noteDocuments } from './note-documents';

describe('NoteRef', () => {
  it('is a link of the text to the bibliography, with its short reference and its open state', () => {
    const html = renderToStaticMarkup(<NoteRef partSlug="summary" id="2" />);
    expect(html).toMatch(/^<a href="[^"]*bibliography#ref-kse-rot-feb26"/);
    expect(html).toContain('aria-haspopup="dialog" aria-expanded="false"');
    expect(html).toMatch(/>\(Dodonov et al\., 2026, p\. 3\)<\/a>$/);
  });

  it('gives a note with a short note the number of its short note', () => {
    const html = renderToStaticMarkup(<NoteRef partSlug="pay" id="12" />);
    expect(html).toMatch(/NY\.GDP\.NGAS\.RT\.ZS\)<span[^>]*>1<\/span><\/a>$/);
  });

  it('is a small marker with the name of its reference when compact', () => {
    const html = renderToStaticMarkup(<NoteRef partSlug="summary" id="2" compact />);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('aria-label="Reference: Dodonov et al., 2026, p. 3"');
    expect(html).toMatch(/>src<\/button>$/);
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
    expect(noteDocuments('128')?.documents).toEqual([]);
    expect(noteDocuments('999')).toBeUndefined();
  });
});
