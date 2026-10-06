import { describe, expect, test } from 'vitest';

import { SHORT_PAGE, unreadablePage } from './unreadable-page.ts';

describe('an answer that is a challenge or a missing page is no record of the source', () => {
  test.each([
    ['a challenge', 'Just a moment...\n\nEnable JavaScript and cookies to continue'],
    ['a browser check', 'Checking your browser before accessing the register of Example Port.'],
    ['a captcha', 'Please complete the CAPTCHA to prove that you are not a robot.'],
    ['a refusal', 'Access denied\n\nYou do not have access to this page.'],
    ['a soft 404', '# 404\n\nPage not found\n\nThe register entry does not exist.'],
    ['a soft 404 in another order', 'Not found (error 404)'],
    ['a page that was removed', 'This record is no longer available.'],
  ])('refuses %s', (_name, text) => {
    expect(unreadablePage('text/html', [text])).not.toBeNull();
  });

  test('admits a short page that is a record', () => {
    expect(unreadablePage('text/html', ['Text'])).toBeNull();
    expect(
      unreadablePage('text/html', [
        'Example Port Authority\n\nBerth 4 holds the vessel Example Star.',
      ]),
    ).toBeNull();
  });

  test('admits a long article that mentions a captcha', () => {
    const article = `An article on bot filters. ${'The captcha was solved by a person. '.repeat(80)}`;
    expect(article.length).toBeGreaterThan(SHORT_PAGE);
    expect(unreadablePage('text/html', [article])).toBeNull();
  });

  test('judges the text of the whole answer, not the first page', () => {
    expect(unreadablePage('text/html', ['Just a moment...', ''])).not.toBeNull();
  });

  test('judges a page of HTML alone', () => {
    expect(unreadablePage('application/pdf', ['Access denied'])).toBeNull();
    expect(unreadablePage('text/plain', ['404 not found'])).toBeNull();
  });
});
