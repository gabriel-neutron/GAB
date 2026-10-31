// The lower-case Cyrillic letters that look the same as a Latin letter, and that Latin letter.
// A source can mix the two scripts in one name. The search reads both as one letter. The stored
// value does not change. Use these two strings with the SQL function `translate`.
export const LOOKALIKE_FROM = 'авекмнорстухіјѕ';
export const LOOKALIKE_TO = 'abekmhopctyxijs';

const LATIN_OF = new Map(Array.from(LOOKALIKE_FROM, (letter, at) => [letter, LOOKALIKE_TO[at]]));

/** Gives each lower-case Cyrillic lookalike as its Latin letter. Call it after `toLowerCase`. */
export const foldLookalikes = (text: string): string =>
  Array.from(text, (letter) => LATIN_OF.get(letter) ?? letter).join('');
