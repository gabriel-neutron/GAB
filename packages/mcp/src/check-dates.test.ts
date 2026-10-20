// The checker of the second model reads a passage that gives a weekday only. It needs the day of
// publication of the document and the weekday of the claimed day. The model is a stub: this test
// reads what the checker receives, and the prompt that tells it how to use the two values.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ItemToCheck } from '@gab/tools/tool';
import { completionOf, routerOf, verdictsOf } from '@gab/worker/runner-fixture';
import { describe, expect, it } from 'vitest';

import { checkBatch, readSecondCheck } from './second-check.ts';

const CHECKER_ENV = {
  CHECKER_MODEL: 'other-family/check-model',
  CHECKER_FAMILY: 'other-family',
  CHECKER_FIRST_WAIT_MS: '1000',
  CHECKER_WAIT_GROWTH: '2',
  CHECKER_MAX_WAIT_MS: '30000',
  CHECKER_TIMEOUT_MS: '60000',
  CHECKER_MAX_ANSWER_TOKENS: '2000',
  RESEARCH_CHECK_TOKEN_CAP: '40000',
  OPENROUTER_API_KEY: 'a-stub-key',
  GABRIEL_CHECKER_PASSWORD: 'a-checker-secret',
};

const RESEARCH = 'postgresql://gabriel_research:a-research-secret@127.0.0.1:5432/gabriel';

const PASSAGE = {
  document: 'doc_aaaaaaaaaaaa',
  page: 1,
  excerpt: 'on Tuesday',
  context: 'A fire began on Tuesday at the plant.',
};

const ITEM: ItemToCheck = {
  ref: 'ev',
  claim: {
    act: { op: 'create_entity', type: 'event', label: 'claimed attack — Plant — 2026-05-12' },
    originator: 'The general staff',
    modality: 'asserts',
    occurredOnWeekdays: [{ day: '2026-05-12', weekday: 'Tuesday' }],
  },
  passages: [{ ...PASSAGE, publishedOn: '2026-05-13' }],
};

// The text that the checker receives for one item.
const receivedFor = async (item: ItemToCheck): Promise<string> => {
  const bodies: string[] = [];
  const router = routerOf(
    () => completionOf('unused'),
    (_call, body) => {
      // The system message is the prompt. Only the last message holds the claims.
      const messages = (JSON.parse(body) as { messages: { content: string }[] }).messages;
      bodies.push(messages.at(-1)?.content ?? '');
      return verdictsOf([['ev', 'supported']]);
    },
  );
  const pool = { connect: () => Promise.reject(new Error('a unit test opens no session')) };
  const check = readSecondCheck(CHECKER_ENV, RESEARCH, () => pool, router.send);
  if (!check.ready) throw new Error(check.reason);
  const writer = { query: () => Promise.resolve({ rows: [{ id: randomUUID() }] }) };
  await checkBatch(check.setup, writer, 'anthropic', [item]);
  return bodies.join('');
};

describe('the dates that the checker reads with a passage', () => {
  it('receives the publication date and the weekday of the claimed day', async () => {
    const body = await receivedFor(ITEM);
    expect(body).toContain('published_on');
    expect(body).toContain('2026-05-13');
    expect(body).toContain('occurred_on_weekdays');
    expect(body).toContain('Tuesday');
  });

  it('receives the weekday of the claimed Monday when the claim is a Monday', async () => {
    const body = await receivedFor({
      ...ITEM,
      claim: { ...ITEM.claim, occurredOnWeekdays: [{ day: '2026-05-11', weekday: 'Monday' }] },
    });
    expect(body).toContain('"weekday":"Monday"');
    expect(body).not.toContain('"weekday":"Tuesday"');
  });

  it('receives neither key when no source knows the date', async () => {
    const body = await receivedFor({
      ...ITEM,
      claim: { ...ITEM.claim, occurredOnWeekdays: [] },
      passages: [{ ...PASSAGE, publishedOn: null }],
    });
    expect(body).not.toContain('published_on');
    expect(body).not.toContain('occurred_on_weekdays');
  });

  it('has a prompt that tells how to read a weekday with the publication date', () => {
    const prompt = readFileSync(new URL('./check-prompt.md', import.meta.url), 'utf8');
    expect(prompt).toContain('A passage that gives a weekday only');
    expect(prompt).toContain('on or before `published_on`');
    expect(prompt).toContain('`not_supported`');
  });
});
