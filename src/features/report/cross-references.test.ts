import { describe, expect, it } from 'vitest';
import {
  GROUPS,
  citeText,
  citingNotes,
  entries,
  groupedEntries,
  keysOf,
  shortNoteNumbers,
  splitNote,
} from './bibliography';
import { parts } from './content';
import { sourceDocuments } from './note-documents';
import { readSource } from './parity';
import { sources } from './source';

const notes = [...readSource(sources.en).notes].map(([id, text]) => ({ id, text }));

describe('the references of the notes', () => {
  it('cite, in each note, at least one entry of the bibliography, and only entries that exist', () => {
    const keys = new Set(entries.map((entry) => entry.key));
    for (const note of notes) {
      expect(keysOf(note.text).length).toBeGreaterThan(0);
      for (const key of keysOf(note.text)) expect(keys.has(key)).toBe(true);
    }
  });

  it('give each source one entry, and each entry at least one note', () => {
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.cite)).size).toBe(entries.length);
    const citing = citingNotes(notes);
    for (const entry of entries) expect(citing.get(entry.key)).toBeDefined();
  });

  it('keep no back reference and no address in the text of a note', () => {
    for (const note of notes) {
      expect(note.text).not.toMatch(/op\. cit\.|See n\. \d/u);
      expect(note.text).not.toMatch(/https?:\/\//u);
    }
  });

  it('show the short reference of each entry, with the locator that follows its key', () => {
    expect(citeText('@kse-rot-feb26, p. 3')).toBe('Dodonov et al., 2026, p. 3');
    expect(citeText("authors' calculations based on @comtrade | HS 2709.")).toBe(
      "authors' calculations based on UN Comtrade, 2026",
    );
    expect(splitNote('@comtrade | A rule.')).toEqual({ cite: '@comtrade', note: 'A rule.' });
    expect(() => citeText('@no-such-key')).toThrow(/no-such-key/);
  });

  it('number the short notes in the order of the text', () => {
    const numbers = shortNoteNumbers(notes);
    expect([...numbers.values()]).toEqual([...numbers.values()].map((_, index) => index + 1));
    // The caveats and counting rules of the first draft stay as short notes.
    for (const id of ['17', '49', '69', '77', '89', '94', '124'])
      expect(numbers.has(id)).toBe(true);
  });

  it('are in the notes that the pages show', () => {
    const held = new Map(notes.map((note) => [note.id, note.text]));
    for (const note of parts.flatMap((part) => part.notes))
      expect(note.text).toBe(held.get(note.id));
  });
});

describe('the bibliography', () => {
  it('puts each entry in one group, in the order of the groups', () => {
    const grouped = groupedEntries();
    expect(grouped.map(([group]) => group)).toEqual(Object.keys(GROUPS));
    expect(grouped.flatMap(([, group]) => group).length).toBe(entries.length);
    for (const [, group] of grouped) expect(group.length).toBeGreaterThan(0);
  });

  it('gives each entry an issuer, a date, a title and an address', () => {
    for (const entry of entries) {
      expect(entry.issuer).not.toBe('');
      expect(entry.date).not.toBe('');
      expect(entry.title).not.toBe('');
      expect(entry.url).toMatch(/^https?:\/\//u);
    }
  });

  it('flags the pages of Ukrainian military intelligence as a party to the conflict', () => {
    const gur = entries.filter((entry) => entry.url.includes('gur.gov.ua'));
    expect(gur.length).toBeGreaterThan(0);
    for (const entry of gur) {
      expect(entry.group).toBe('gur');
      expect(entry.detail).toMatch(/party to the conflict/u);
    }
  });

  it('finds the stored copies of a source in the notes that cite it, never from a bare host', () => {
    const citing = citingNotes(notes);
    const kse = entries.find((entry) => entry.key === 'kse-rot-feb26');
    expect(kse && sourceDocuments(kse, citing.get(kse.key) ?? []).map((one) => one.id)).toEqual([
      'doc_f42628ac12e6',
    ]);
    expect(sourceDocuments({ url: 'https://www.spglobal.com' }, ['40'])).toEqual([]);
  });
});
