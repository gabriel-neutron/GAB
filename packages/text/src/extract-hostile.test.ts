// A page that hedges, negates, retracts or quotes a reader must not come out as a plain statement.
// Every fixture is invented. Each page is built in two shapes, because the extractor takes one
// road for a page with an article and another for a page with none.

import { describe, expect, test } from 'vitest';

import { extractText } from './extract.ts';

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);

const page = (body: string): string =>
  `<!doctype html><html><head><title>Wire</title></head><body>${body}</body></html>`;

// Readability keeps a block only when it holds enough text, so the filler makes the article road.
const FILLER = 'The ministry of the invented republic issued a long and dull statement. '.repeat(8);

interface Shape {
  readonly name: string;
  readonly wrap: (inner: string) => string;
  readonly mime?: string;
}

const SHAPES: readonly Shape[] = [
  {
    name: 'a page with an article',
    wrap: (inner) => page(`<article><p>${FILLER}</p>${inner}</article>`),
  },
  { name: 'a short page with no article', wrap: (inner) => page(inner) },
  {
    name: 'an XHTML page, read whole',
    wrap: (inner) =>
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml">` +
      `<head><title>Wire</title></head><body>${inner}</body></html>`,
    mime: 'application/xhtml+xml',
  },
];

const textOf = async (html: string, mime = 'text/html'): Promise<string> => {
  const { pages } = await extractText(bytesOf(html), mime);
  expect(pages).toHaveLength(1);
  return pages[0] ?? '';
};

const withoutStruck = (text: string): string => text.replaceAll(/~~[\s\S]*?~~/gu, '');

describe.each(SHAPES)('extractText on $name', ({ wrap, mime }) => {
  const read = (html: string): Promise<string> => textOf(html, mime);

  test('a two-row table keeps each unit on the line of its own place', async () => {
    const text = await read(
      wrap(
        '<table><thead><tr><th>Unit</th><th>Place</th></tr></thead><tbody>' +
          '<tr><td>Unit 4</td><td>Pokrovsk</td></tr>' +
          '<tr><td>Unit 47</td><td>Mulino</td></tr></tbody></table>',
      ),
    );
    const rows = text.split('\n');
    expect(rows.find((row) => row.includes('Unit 47'))).toContain('Mulino');
    expect(rows.find((row) => row.includes('Unit 4 ') || row.endsWith('Unit 4'))).not.toContain(
      'Mulino',
    );
    expect(rows.find((row) => row.includes('Pokrovsk'))).not.toContain('Unit 47');
  });

  test('an empty cell stays a cell, so the next row never slides into its place', async () => {
    const text = await read(
      wrap(
        '<table><thead><tr><th>Unit</th><th>Place</th><th>Day</th></tr></thead><tbody>' +
          '<tr><td>Unit 4</td><td></td><td>2026-05-04</td></tr>' +
          '<tr><td>Unit 47</td><td>Mulino</td><td></td></tr></tbody></table>',
      ),
    );
    const rows = text.split('\n');
    const first = rows.find((row) => row.includes('Unit 4') && !row.includes('Unit 47'));
    const second = rows.find((row) => row.includes('Unit 47'));
    expect(first).toContain('2026-05-04');
    expect(first).not.toContain('Mulino');
    expect(second).toContain('Mulino');
    expect(second).not.toContain('2026-05-04');
  });

  test('a bar inside a cell adds no column, so the cells after it keep their place', async () => {
    const text = await read(
      wrap(
        '<table><thead><tr><th>Unit</th><th>Place</th><th>Day</th></tr></thead><tbody>' +
          '<tr><td>Unit 4 | Pokrovsk</td><td></td><td>2026-05-04</td></tr></tbody></table>',
      ),
    );
    const row = text.split('\n').find((line) => line.includes('Unit 4')) ?? '';
    const cells = row.split(/(?<!\\)\|/u).slice(1, -1);
    expect(cells.map((cell) => cell.trim())).toStrictEqual([
      String.raw`Unit 4 \| Pokrovsk`,
      '',
      '2026-05-04',
    ]);
  });

  test('a struck sentence is marked, and never reads as a live one', async () => {
    const text = await read(
      wrap(
        '<p>Unit 47 is <del>at Mulino</del> <s>at Pokrovsk</s> <strike>at Ivanivka</strike>.</p>',
      ),
    );
    for (const place of ['Mulino', 'Pokrovsk', 'Ivanivka']) {
      expect(text).toContain(place);
      expect(withoutStruck(text)).not.toContain(place);
    }
  });

  test.each([
    [
      'inside the article',
      '<div class="comments"><div class="comment"><p>Reader: Unit 47 is at Mulino now.</p></div></div>',
    ],
    [
      'in a section named comments',
      '<section id="comments"><h2>Comments</h2><p>Reader: Unit 47 is at Mulino now.</p></section>',
    ],
    [
      'in a thread of a comment service',
      '<div id="disqus_thread"><p>Reader: Unit 47 is at Mulino now.</p></div>',
    ],
    [
      'in a list of comments',
      '<ol class="comment-list"><li>Reader: Unit 47 is at Mulino now.</li></ol>',
    ],
    [
      'marked as a Comment by the page',
      '<div itemprop="comment" itemscope itemtype="https://schema.org/Comment"><p>Reader: Unit 47 is at Mulino now.</p></div>',
    ],
  ])('a reader comment %s is not part of the text', async (_name, comment) => {
    const text = await read(wrap(`<p>Unit 47 may be moved next month.</p>${comment}`));
    expect(text).toContain('Unit 47 may be moved next month.');
    expect(text).not.toContain('Reader');
    expect(text).not.toContain('is at Mulino now');
  });

  test.each([
    ['a style', '<p style="display:none">Unit 47 is at Mulino.</p>'],
    ['the hidden attribute', '<p hidden>Unit 47 is at Mulino.</p>'],
    ['a script', '<script>var s = "Unit 47 is at Mulino.";</script>'],
    ['a comment of the page', '<!-- Unit 47 is at Mulino. -->'],
    ['a template', '<template>Unit 47 is at Mulino.</template>'],
    ['a noscript block', '<noscript>Unit 47 is at Mulino.</noscript>'],
  ])('text hidden by %s adds no sentence', async (_name, hidden) => {
    const text = await read(wrap(`<p>Unit 47 may be moved next month.</p>${hidden}`));
    expect(text).toContain('Unit 47 may be moved next month.');
    expect(text).not.toContain('is at Mulino');
  });

  // The extractor must hand over the words as the page wrote them. A fold of a digit, a letter or
  // a spelling would make two different claims equal before any check could see the difference.
  test.each([
    'Unit 47 may be moved to Mulino next month.',
    'Підрозділ 47 може бути переведений до Мулино наступного місяця.',
    'Часть 47 может быть переведена в Мулино в следующем месяце.',
    'قد تُنقل الوحدة 47 إلى مولينو في الشهر المقبل.',
    'Unit 47 is at Mulino, not at Pokrovsk.',
    'Unit 47 is at Mulino. The report is false.',
    '04/05/2026, 1.200, 48,5',
    'IMO 9482137 and ІМО 9482137 and IMO ９４８２１３７ and IMO ٩٤٨٢١٣٧',
    'Kharkov and Kharkiv, Ivanivka (Donetsk Oblast) and Ivanivka (Kherson Oblast)',
    'Position 48°30′N 35°00′E (old datum SK-42), not WGS 84',
    'An official, who asked not to be named, said the unit could be moved.',
  ])('the words of "%s" come out as they went in', async (sentence) => {
    expect(await read(wrap(`<p>${sentence}</p>`))).toContain(sentence);
  });

  test('a hedge and a negation inside markup stay attached to their words', async () => {
    const text = await read(
      wrap(
        '<p>Unit 47 <em>may</em> be moved to <strong>Mulino</strong>, <i>not</i> to Pokrovsk.</p>',
      ),
    );
    expect(text).toMatch(
      /Unit 47 [*_]may[*_] be moved to \*\*Mulino\*\*, [*_]not[*_] to Pokrovsk\./u,
    );
  });
});

describe('the span gate that no code builds yet', () => {
  // These lines name the attacks that only a stored span, a modality and a value check can stop.
  // The code holds none of the three, so a test that calls them would call nothing. A todo
  // here turns into a test on the day the gate exists.
  test.todo('a hedged span ("may be moved") never gives a plain present-tense value');
  test.todo('a value that the cited text negates after the value is refused');
  test.todo('a swapped role ("replaced Unit 4") never moves the unit that was named second');
  test.todo('a value written with full-width or Arabic-Indic digits never equals the ASCII value');
  test.todo('a place name shared by two regions never fixes one place without its region');
  test.todo('a coordinate pair on an old datum is never shown as a WGS 84 point');
  test.todo('a span of a page that changed after capture is read in the capture that holds it');
});

test('an XHTML page gives no code, no head and no frame of the site as text', async () => {
  const text = await textOf(
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head>` +
      '<title>T</title><style>.a{color:red}</style><script>var secret="SCRIPTBODY";</script>' +
      '</head><body><nav><a href="/">Home NAV</a></nav><header>Site header</header>' +
      '<script>alert("INLINE")</script><noscript>NOSCRIPT</noscript><p>Body of the act</p>' +
      '<footer>Site footer</footer></body></html>',
    'application/xhtml+xml',
  );
  expect(text).toBe('Body of the act');
});
