import { describe, expect, test } from 'vitest';

import { HIDDEN, liveText } from './live-text.ts';

const page = (body: string): string =>
  `<html><head><title>T</title></head><body>${body}</body></html>`;

const codePoints = (text: string): number => Array.from(text).length;

/** The offset in code points of the first place of `part` in `text`. */
const at = (text: string, part: string): number => codePoints(text.slice(0, text.indexOf(part)));

describe('the live text of an HTML page', () => {
  test('visible text stays as it is', () => {
    expect(liveText(page('<p>The tanker Nayara Star left Sikka.</p>'))).toBe(
      'The tanker Nayara Star left Sikka.',
    );
  });

  for (const [name, html] of [
    ['display none', '<span style="display: none">secret</span>'],
    ['visibility hidden', '<span style="visibility:hidden">secret</span>'],
    ['zero font size', '<span style="font-size:0">secret</span>'],
    ['zero size', '<span style="width:0;height:0">secret</span>'],
    ['the hidden attribute', '<span hidden>secret</span>'],
    ['aria-hidden', '<span aria-hidden="true">secret</span>'],
    ['struck-through text', '<s>secret</s>'],
    ['a deleted element', '<del>secret</del>'],
    ['a line-through style', '<span style="text-decoration: line-through">secret</span>'],
    ['a comment', '<!--secret-->'],
  ] as const)
    test(`${name} becomes one placeholder for each code point, at the same place`, () => {
      const text = liveText(page(`<p>Before ${html} after.</p>`));
      expect(text).toBe(`Before ${HIDDEN.repeat(6)} after.`);
      expect(text).not.toContain('secret');
    });

  test('a placeholder character in the source becomes a space, so it never marks hidden text', () => {
    expect(liveText(page(`<p>A${HIDDEN}B</p>`))).toBe('A B');
  });

  test('the offsets of visible text after hidden text stay valid', () => {
    const text = liveText(
      page('<p>Hidden <span hidden>owner Volga</span> tanker Nayara Star.</p>'),
    );
    const start = at(text, 'Nayara Star');
    expect(
      Array.from(text)
        .slice(start, start + 11)
        .join(''),
    ).toBe('Nayara Star');
    expect(Array.from(text).slice(7, 18).join('')).toBe(HIDDEN.repeat(11));
  });

  test('a character outside the basic plane counts as one code point', () => {
    const text = liveText(page('<p>\u{1F6A2} <span hidden>\u{1F6A2}x</span> Nayara</p>'));
    expect(text).toBe(`\u{1F6A2} ${HIDDEN.repeat(2)} Nayara`);
  });

  test('each table row is one line, with its cells between bars', () => {
    const text = liveText(
      page(
        '<table><tr><td>Nayara Star</td><td>9123453</td></tr><tr><td>Volga</td><td>9876505</td></tr></table>',
      ),
    );
    expect(text).toBe('| Nayara Star | 9123453 |\n| Volga | 9876505 |');
  });

  test('a script, a style and the navigation are no part of the page', () => {
    const text = liveText(
      page('<nav>Menu</nav><script>var x = 1;</script><style>p{}</style><p>Body text.</p>'),
    );
    expect(text).toBe('Body text.');
  });

  test('each block starts a line', () => {
    expect(liveText(page('<h1>Title</h1><p>One.</p><p>Two.</p>'))).toBe('Title\nOne.\nTwo.');
  });
});
