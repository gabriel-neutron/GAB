import { describe, expect, it } from 'vitest';

import committed from './data/note-documents.json';
import { noteDocumentFaults, type NoteDocumentsFile } from './note-documents';

// shortcut: the final English text holds the notes 1 to 127 and is not in the repository; read the
// ids from the content once it holds the final notes.
const NOTE_IDS = new Set(Array.from({ length: 127 }, (_, index) => String(index + 1)));

const document = {
  id: 'doc_0123456789ab',
  type: 'legal_act',
  retrievedAt: '2026-10-28',
  url: 'https://example.org/act',
  match: 'exact',
};
const excerpt = 'The Council adopts the price cap of 60 US dollars per barrel for crude oil.';
const fileWith = (note: NoteDocumentsFile['notes'][number]): NoteDocumentsFile => ({
  builtOn: '2026-11-01',
  notes: [...committed.notes.filter((held) => held.id !== note.id), note],
});
const quoted = (quote: Partial<NonNullable<NoteDocumentsFile['notes'][number]['quote']>>) =>
  fileWith({
    id: '15',
    documents: [document],
    quote: {
      text: 'price cap of 60 US dollars',
      document: document.id,
      excerpt,
      licence: 'eu-reuse',
      ...quote,
    },
  });

describe('the note-to-documents file', () => {
  it('holds each note of the final text once, with dated rows and original addresses', () => {
    expect(noteDocumentFaults(committed, NOTE_IDS)).toEqual([]);
  });

  it('refuses a row with a field other than the original address, such as an archive', () => {
    const archived = { ...document, archive: 'raw/doc_0123456789ab.pdf' };
    expect(noteDocumentFaults(fileWith({ id: '15', documents: [archived] }), NOTE_IDS)).toContain(
      'note 15: doc_0123456789ab has other fields than id,match,retrievedAt,type,url',
    );
  });

  it('accepts a short quote of an open source that the stored excerpt holds', () => {
    expect(noteDocumentFaults(quoted({}), NOTE_IDS)).toEqual([]);
  });

  it('refuses an unknown note id', () => {
    expect(noteDocumentFaults(fileWith({ id: '128', documents: [] }), NOTE_IDS)).toContain(
      'note 128: unknown note id',
    );
  });

  it('refuses a quote over 25 words', () => {
    const long = Array.from({ length: 26 }, () => 'word').join(' ');
    expect(noteDocumentFaults(quoted({ text: long, excerpt: long }), NOTE_IDS)).toContain(
      'note 15: quote over 25 words',
    );
  });

  it('refuses a quote that is not in the stored excerpt', () => {
    expect(noteDocumentFaults(quoted({ text: 'price cap of 50 US dollars' }), NOTE_IDS)).toContain(
      'note 15: quote not in the stored excerpt',
    );
  });

  it('refuses a quote with no open licence', () => {
    expect(noteDocumentFaults(quoted({ licence: 'restricted' }), NOTE_IDS)).toContain(
      'note 15: quote with no open licence',
    );
  });
});
