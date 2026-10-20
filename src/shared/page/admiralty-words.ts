// The words of the NATO scale (STANAG 2511): the letter rates the author, the digit rates the fact.
const LETTER_WORDS: Readonly<Record<string, string>> = {
  A: 'completely reliable',
  B: 'usually reliable',
  C: 'fairly reliable',
  D: 'not usually reliable',
  E: 'unreliable',
  F: 'cannot be judged',
};

const DIGIT_WORDS: Readonly<Record<string, string>> = {
  '1': 'confirmed',
  '2': 'probably true',
  '3': 'possibly true',
  '4': 'doubtful',
  '5': 'improbable',
  '6': 'cannot be judged',
};

/** What a pair means, for example "Author: usually reliable. Fact: probably true.". */
export const pairWords = (letter: string, digit: string): string =>
  `Author: ${LETTER_WORDS[letter] ?? ''}. Fact: ${DIGIT_WORDS[digit] ?? ''}.`;
