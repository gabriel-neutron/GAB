import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { checkProfiles, PROFILE_LIMIT, PROFILES } from './profiles.ts';

test('the catalogue holds the eight tools of the ticket, once each', () => {
  expect(CATALOGUE.map((tool) => tool.name).sort()).toStrictEqual([
    'document_text',
    'enqueue_extract',
    'job_status',
    'lookup_entity',
    'neighbourhood',
    'proposal_read',
    'propose_change',
    'search_graph',
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
    checkProfiles({ lost: ['search_graph', 'web_search'] }, CATALOGUE);
  }).toThrow(/lost.*web_search/);
});
