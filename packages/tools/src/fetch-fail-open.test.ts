// Red team, family F1: a search that did not work must never read as a search that found nothing.
// The fetch tool is the door that a denial search will read through. Each test names an answer
// that is no document of the subject. The tool stores nothing for it. Every name is invented.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import {
  FIXTURE_HOST,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { callTool, type Session, type Tool } from './tool.ts';

// A session that fails the test when the tool reaches the database. A refusal comes first.
const noSql: Session = {
  query: () => {
    throw new Error('the tool reached the database, and it had to refuse first');
  },
};

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const page = (head: string, body: string): string =>
  `<html><head><title>${head}</title></head><body>${body}</body></html>`;

const SENTENCE =
  'The press office of Nord Tankers publishes the statements of the company in this room. ' +
  'The archive holds the releases of each year, and a reader finds the contact data below. ';
const FILLER = SENTENCE.repeat(4);

const html = { 'content-type': 'text/html' };

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  fixture = await startFixture({
    '/forbidden': { status: 403, headers: html, body: FILLER },
    '/too-many': { status: 429, headers: html, body: FILLER },
    '/unavailable': { status: 503, headers: html, body: FILLER },
    '/legal': { status: 451, headers: html, body: FILLER },
    '/recaptcha': {
      headers: html,
      body: page(
        'Nord Tankers press room',
        '<p>Please verify that you are human.</p>' +
          '<div class="g-recaptcha" data-sitekey="invented-key"></div>',
      ),
    },
    '/hcaptcha': {
      headers: html,
      body: page(
        'Nord Tankers press room',
        '<p>One more step.</p><div class="h-captcha" data-sitekey="invented-key"></div>',
      ),
    },
    '/challenge': {
      headers: html,
      body: page(
        'Just a moment...',
        '<p>Checking your browser before access.</p>' +
          '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1"></script>',
      ),
    },
    '/turnstile': {
      headers: html,
      body: page('Nord Tankers', '<div class="cf-turnstile" data-sitekey="invented-key"></div>'),
    },
    '/to-captcha': { status: 302, headers: { location: '/recaptcha' } },
    '/article-with-comment-form': {
      headers: html,
      body: page(
        'Nord Tankers answers the allegation',
        `<article><p>${FILLER}</p><p>${FILLER}</p><p>${FILLER}</p></article>` +
          '<form><div class="g-recaptcha" data-sitekey="invented-key"></div></form>',
      ),
    },
    '/article-about-captcha': {
      headers: html,
      body: page(
        'Why a captcha stops a reader',
        `<article><p>A captcha asks a reader to prove that the reader is human. ${FILLER}</p></article>`,
      ),
    },
  });
  base = `http://${FIXTURE_HOST}:${fixture.port}`;
});

afterAll(async () => {
  await fixture.close();
  await endMetadata();
});

const refusalOf = async (path: string): Promise<{ refusal: string; puts: number }> => {
  const store = memoryStore();
  const outcome = await callTool(
    fetchDocument,
    noSql,
    { url: `${base}${path}` },
    fixtureReach(store),
  );
  if (outcome.ok) throw new Error(`the tool took ${path} as a document, and it had to refuse it`);
  return { refusal: outcome.refusal, puts: store.puts.length };
};

describe('a site that blocks the fetch gives no document', () => {
  test.each([
    ['/forbidden', 403],
    ['/too-many', 429],
    ['/unavailable', 503],
    ['/legal', 451],
  ])('%s answers %i with a body of text, and nothing is stored', async (path, status) => {
    const { refusal, puts } = await refusalOf(path);
    expect(refusal).toContain(String(status));
    expect(puts).toBe(0);
  });
});

describe('a challenge page with status 200 gives no document', () => {
  test.each(['/recaptcha', '/hcaptcha', '/challenge', '/turnstile', '/to-captcha'])(
    '%s',
    async (path) => {
      const { refusal, puts } = await refusalOf(path);
      expect(refusal).toMatch(/challenge|captcha/u);
      expect(puts).toBe(0);
    },
  );
});

// A session that accepts the writes of a page, so a page the guard lets through is a document.
const acceptingSession = (): Session => {
  let stored = false;
  return {
    query: (text) => {
      if (text.includes('put_fetched_document')) {
        stored = true;
        return Promise.resolve({ rows: [{ id: 'doc_0123456789ab', pages: 1 }] });
      }
      if (text.includes('WHERE d.sha256'))
        return Promise.resolve({
          rows: stored
            ? [{ id: 'doc_0123456789ab', title: 'A page', mime: 'text/html', retrieved_at: null }]
            : [],
        });
      return Promise.resolve({
        rows: [{ extractor: 'text-1', page: 1, text: 'Text', last_page: 1 }],
      });
    },
  };
};

describe('the guard does not block a real page', () => {
  test.each(['/article-with-comment-form', '/article-about-captcha'])(
    '%s is never refused as a challenge',
    async (path) => {
      const outcome = await callTool(
        fetchDocument,
        acceptingSession(),
        { url: `${base}${path}` },
        fixtureReach(memoryStore()),
      );
      expect(outcome.ok).toBe(true);
    },
  );
});

// The surfaces below are not built on this branch: the web search tool, the denial search, the
// budget of fetches, the register card of an issuer and the public template. A test that names
// one of them stays a todo until its code exists, and it must fail when that code lets it through.
describe('attacks on code that is not built', () => {
  test.todo('an engine that returns an empty list and a site that returns 403 is a failed search');
  test.todo('an engine that times out and a second engine with zero results is a failed search');
  test.todo('a fetch budget that ends after 3 of 12 fetches leaves the search incomplete');
  test.todo('a denial dated 8 months before the search is found outside the news window');
  test.todo('a lookalike host nord-tankers-press.test is no denial by the subject');
  test.todo('a 900-character reply with the qualifier after character 200 keeps its qualifier');
  test.todo('a real denial posted two rounds after the search date replaces the no-response line');
});
