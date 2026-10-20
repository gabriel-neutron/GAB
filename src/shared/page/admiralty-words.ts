// The words of the NATO scale (STANAG 2511): the letter rates the author, the digit rates the fact.
const LETTER_WORDS: Readonly<Record<string, string>> = {
  A: 'completely reliable author',
  B: 'usually reliable author',
  C: 'fairly reliable author',
  D: 'not usually reliable author',
  E: 'unreliable author',
  F: 'author cannot be judged',
};

const DIGIT_WORDS: Readonly<Record<string, string>> = {
  '1': 'confirmed',
  '2': 'probably true',
  '3': 'possibly true',
  '4': 'doubtful',
  '5': 'improbable',
  '6': 'fact cannot be judged',
};

/** The pair in plain words, for example "usually reliable author, probably true". */
export const pairWords = (letter: string, digit: string): string =>
  `${LETTER_WORDS[letter] ?? ''}, ${DIGIT_WORDS[digit] ?? ''}`;
