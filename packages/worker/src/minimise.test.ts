import { describe, expect, it } from 'vitest';

import { minimiseForCall, personalCategories, READER_MINIMISER } from './minimise.ts';

// An invented page. No person, date or address on it is real.
const PAGE =
  'Notice of suspicion. Ivan Petrov, born 3 February 1970, address: 12 Harbour Street, Sikka; ' +
  'passport AB1234567, tel. +7 900 123 45 67, e-mail ivan.petrov@example.org. He is the master ' +
  'of the tanker Nayara Star (IMO 9123453), which left Sikka on 3 May 2026.';

const codePoints = (text: string): number => Array.from(text).length;

/** The span of `part` in `text`, in code points. */
const spanOf = (text: string, part: string): { start: number; end: number } => {
  const start = codePoints(text.slice(0, text.indexOf(part)));
  return { start, end: start + codePoints(part) };
};

const slice = (text: string, span: { start: number; end: number }): string =>
  Array.from(text).slice(span.start, span.end).join('');

describe('the minimiser', () => {
  const { text, removed } = minimiseForCall(PAGE, []);

  it('removes the date of birth, the address, the identity number, the phone and the e-mail', () => {
    for (const value of [
      '3 February 1970',
      '12 Harbour Street, Sikka',
      'AB1234567',
      '+7 900 123 45 67',
      'ivan.petrov@example.org',
    ])
      expect(text).not.toContain(value);
    expect(removed).toStrictEqual([
      'date_of_birth',
      'address',
      'identity_number',
      'phone',
      'email',
    ]);
  });

  it('keeps the name, the vessel, its IMO and the date of the voyage', () => {
    for (const value of ['Ivan Petrov', 'Nayara Star', 'IMO 9123453', '3 May 2026'])
      expect(text).toContain(value);
  });

  it('keeps the length in code points, so each span of a reader passes on the untouched page', () => {
    expect(codePoints(text)).toBe(codePoints(PAGE));
    // A stub reader finds its spans in the minimised text, and the untouched page holds the same
    // characters at the same offsets.
    for (const part of ['Ivan Petrov', 'the tanker Nayara Star (IMO 9123453), which left Sikka']) {
      const span = spanOf(text, part);
      expect(slice(PAGE, span)).toBe(part);
    }
  });

  it('keeps a character outside the basic plane as one code point', () => {
    const page = '\u{1F6A2} born 3 February 1970 \u{1F6A2}';
    expect(codePoints(minimiseForCall(page, []).text)).toBe(codePoints(page));
  });

  it('keeps a category that the task allows', () => {
    expect(minimiseForCall(PAGE, ['email']).text).toContain('ivan.petrov@example.org');
  });

  it('leaves no category in the text that the readers send', () => {
    expect(personalCategories(READER_MINIMISER.apply(PAGE))).toStrictEqual([]);
    expect(personalCategories(PAGE)).toStrictEqual([
      'date_of_birth',
      'address',
      'identity_number',
      'phone',
      'email',
    ]);
  });

  it('removes the same fields from a Russian and a Ukrainian page', () => {
    const russian = 'Иван Петров, дата рождения 03.02.1970, проживает по адресу: ул. Морская, 12.';
    const ukrainian =
      'Іван Петров, дата народження 03.02.1970, проживає за адресою: вул. Морська, 12.';
    for (const page of [russian, ukrainian]) {
      const out = minimiseForCall(page, []).text;
      expect(out).not.toContain('03.02.1970');
      expect(out).not.toContain('12');
      expect(codePoints(out)).toBe(codePoints(page));
    }
  });
});
