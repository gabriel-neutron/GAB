import type { Source } from '../parity';
import en from './report-en.md?raw';
import frText from './report-fr.md?raw';
import { noteTwins } from './note-twins';

// The number of each figure of the French text (V1, V2...) on the page, where the numbers follow
// the final English text.
const FIGURES: Readonly<Record<string, number>> = {
  V1: 2,
  V2: 1,
  V3: 3,
  V4: 4,
  V5: 5,
  V6: 6,
  V7: 7,
  V8: 8,
  V9: 9,
  V10: 10,
  V11: 11,
  V13: 12,
};

const figureOf = (key: string): string => {
  const number = FIGURES[key];
  if (number === undefined) throw new Error(`The French text has a figure ${key} with no number.`);
  return String(number);
};

/** The French text in the form of the English text: the note ids of the English text (through
 * their twins), the figure numbers of the page, and one caption line and one note line for each
 * figure, with no blockquote mark and no layout comment. The words stay the words of the author. The n-th marker of a French note gets the n-th
 * English note that has it as twin; the last one when the English text has fewer. */
export function rekey(text: string, twins: Readonly<Record<string, string | null>>): string {
  const english = new Map<string, string[]>();
  for (const [id, twin] of Object.entries(twins))
    if (twin !== null) english.set(twin, [...(english.get(twin) ?? []), id]);
  const seen = new Map<string, number>();
  const marker = (id: string): string => {
    const ids = english.get(id);
    if (ids === undefined) throw new Error(`The French note ${id} has no English twin.`);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    return ids[Math.min(count, ids.length - 1)] ?? id;
  };
  return text
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((line) => {
      // A comment of the author is a layout instruction, not text of the report.
      if (line.startsWith('<!--')) return [];
      const note = /^\[\^([^\]]+)\]: (.*)$/.exec(line);
      if (note !== null)
        return (english.get(note[1] ?? '') ?? []).map((id) => `[^${id}]: ${note[2] ?? ''}`);
      const body = line
        .replace(/^> /, '')
        .replace(/\[\^([^\]]+)\]/g, (_, id: string) => `[^${marker(id)}]`);
      const caption = /^Figure (V\d+)\. (.*?)\. Note\. (.*)$/.exec(body);
      if (caption === null)
        return [
          body.replace(
            /\b(figures?) (V\d+)/g,
            (_, word: string, key: string) => `${word} ${figureOf(key)}`,
          ),
        ];
      return [
        `FIGURE: Figure ${figureOf(caption[1] ?? '')}: ${caption[2] ?? ''}`,
        '',
        `*Note.* ${caption[3] ?? ''}`,
      ];
    })
    .join('\n');
}

// The final text of each locale, as the author delivers it, and where each part of the page
// starts in it. The web cuts "2 Pay" in two parts: pay (2.1 to 2.3) and ports-fleet (2.4 to 2.6).
export const sources = {
  en: {
    text: en,
    starts: [
      ['summary', '## Summary'],
      ['introduction', '## Introduction'],
      ['method-chronology', '## 1 Method'],
      ['pay', '## 2 Pay'],
      ['ports-fleet', '### 2.4 The ports'],
      ['finance', '## 3 Finance'],
      ['fight', '## 4 Fight'],
      ['ownership', '## 5 Who owns what'],
      ['limits', '## 6 Limitations'],
      ['conclusion', '## Conclusion'],
      ['annex-method', '## Annex A Research method'],
    ],
  },
  // The French text (V4) with the note ids of the English text.
  fr: {
    text: rekey(frText, noteTwins),
    starts: [
      ['summary', '## Synthèse'],
      ['introduction', '## Introduction'],
      ['method-chronology', '## [N]. Méthode'],
      ['pay', '## [N]. Payer'],
      ['ports-fleet', '### 2.4 Les ports'],
      ['finance', '## [N]. Financer'],
      ['fight', '## [N]. Combattre'],
      ['ownership', '## [N]. Qui possède quoi'],
      ['limits', '## [N]. Limites'],
      ['conclusion', '## Conclusion'],
      ['annex-method', '## Annexe A. Méthode de recherche'],
    ],
  },
} as const satisfies Readonly<Record<string, Source>>;
