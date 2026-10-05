import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { checkProfiles, PROFILE_LIMIT, PROFILES } from './profiles.ts';

test('the catalogue holds the thirteen tools that are built, once each', () => {
  expect(CATALOGUE.map((tool) => tool.name).sort()).toStrictEqual([
    'archive_snapshot',
    'document_text',
    'enqueue_extract',
    'fetch_document',
    'job_status',
    'lookup_entity',
    'neighbourhood',
    'news_search',
    'proposal_read',
    'propose_change',
    'put_claim_reading',
    'search_graph',
    'web_search',
  ]);
});

test('the five profiles are data, and the real data passes the check', () => {
  expect(Object.keys(PROFILES)).toStrictEqual([
    'research',
    'extractor',
    'mapper',
    'verifier',
    'chat',
  ]);
  expect(() => {
    checkProfiles(PROFILES, CATALOGUE);
  }).not.toThrow();
});

test('the research profile fetches a page, and the chat profile, which stores nothing, does not', () => {
  expect(PROFILES.research).toContain('fetch_document');
  expect(PROFILES.research).toHaveLength(8);
  expect(PROFILES.research).not.toContain('lookup_entity');
  expect(PROFILES.chat).not.toContain('fetch_document');
});

test('the research profile and the chat profile hold web_search', () => {
  expect(PROFILES.research).toContain('web_search');
  expect(PROFILES.chat).toContain('web_search');
  expect(PROFILES.chat).toHaveLength(5);
});

test('the extractor keeps the entity lookup and the claim reading write', () => {
  expect(PROFILES.extractor).toContain('lookup_entity');
  expect(PROFILES.extractor).toContain('put_claim_reading');
});

test('the extractor and the verifier, which read stored text alone, hold no web tool', () => {
  for (const name of ['web_search', 'archive_snapshot', 'news_search'] as const) {
    expect(PROFILES.extractor).not.toContain(name);
    expect(PROFILES.verifier).not.toContain(name);
  }
});

test('a profile holds no more than eight tools', () => {
  for (const tools of Object.values(PROFILES)) expect(tools.length).toBeLessThanOrEqual(8);
  expect(PROFILE_LIMIT).toBe(8);
});

test('a profile of nine tools fails the check', () => {
  const nine = ['document_text', 'enqueue_extract', 'job_status', 'lookup_entity', 'neighbourhood'];
  const crowded = {
    crowded: [...nine, 'propose_change', 'proposal_read', 'search_graph', 'job_status'],
  };
  expect(crowded.crowded).toHaveLength(9);
  expect(() => {
    checkProfiles(crowded, CATALOGUE);
  }).toThrow(/crowded.*9/);
});

test('a profile that names a tool outside the catalogue fails the check', () => {
  expect(() => {
    checkProfiles({ lost: ['search_graph', 'fetch_pigeon'] }, CATALOGUE);
  }).toThrow(/lost.*fetch_pigeon/);
});

test('the extractor profile holds the two reads of its model and the two writes of its code', () => {
  expect(PROFILES.extractor).toStrictEqual([
    'document_text',
    'lookup_entity',
    'propose_change',
    'put_claim_reading',
  ]);
});
