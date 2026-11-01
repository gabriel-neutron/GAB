import { describe, expect, it } from 'vitest';
import { frParts } from './parts-fr';
import { parts } from './content';
import { readSource } from './parity';
import { rekey, sources } from './source';

const CITE = /(?:^|; ?|, )([^;]*?) \(([^()]*)\),? op\. cit\., n\. (\d+)/g;

/** The words of a cited work that its first note must hold: the year, and a name or its initials. */
const sameWork = (author: string, year: string, target: string): boolean => {
  const words = author
    .replace(/^(Calculs de l’auteur d’après|Author's calculations based on)\s+/u, '')
    .split(/[\s,&.()]+/u)
    .filter((word) => word.length >= 4 || /^[A-Z]{2,}$/u.test(word));
  // An acronym names a body that the note can write in full: OFAC for Office of Foreign Assets Control.
  const spelled = (acronym: string) =>
    new RegExp(acronym.split('').join('\\w*\\s+(?:of\\s+|the\\s+)*'), 'u').test(target);
  // And the other way: a body in full that the note writes as its acronym.
  const initials = words
    .filter((word) => /^\p{Lu}/u.test(word))
    .map((word) => word[0])
    .join('');
  return (
    target.includes(year.replace(/^(s\. d\.|n\.d\.)$/u, '')) &&
    (words.some((word) => target.includes(word) || (/^[A-Z]{2,}$/u.test(word) && spelled(word))) ||
      (initials.length > 1 && target.includes(initials)))
  );
};

/** Each "op. cit., n. N" of the notes of a locale that names no note, or a note of another work. */
const faults = (notes: ReadonlyMap<string, string>): string[] =>
  [...notes].flatMap(([id, text]) =>
    [...text.matchAll(CITE)].flatMap(([, author = '', year = '', number = '']) => {
      const target = notes.get(number);
      if (target === undefined) return [`${id}: n. ${number} is no note`];
      return sameWork(author, year, target)
        ? []
        : [`${id}: n. ${number} is not ${author} (${year})`];
    }),
  );

describe('the cross-references of the notes', () => {
  it('name, on the English page, a note of the same work', () => {
    expect(faults(readSource(sources.en).notes)).toEqual([]);
  });

  it('name, on the French page, the page id of a note of the same work', () => {
    expect(faults(readSource(sources.fr).notes)).toEqual([]);
  });

  it('take, in the French text, the page id of the note that the French publication numbers', () => {
    // The French publication numbers x as note 1 and y as note 2; the page gives y the id 7.
    const text = 'a[^x] b[^y] c[^x]\n\n[^x]: Kpler (2025).\n[^y]: Kpler (2025), op. cit., n. 1.';
    expect(rekey(text, { '3': 'x', '7': 'y' })).toContain('[^7]: Kpler (2025), op. cit., n. 3.');
  });

  it('are in the notes that the pages show', () => {
    for (const [held, source] of [
      [parts, sources.en],
      [frParts, sources.fr],
    ] as const) {
      const notes = readSource(source).notes;
      for (const note of held.flatMap((part) => part.notes))
        expect(note.text).toBe(notes.get(note.id));
    }
  });
});
