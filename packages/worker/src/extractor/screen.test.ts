import { expect, test } from 'vitest';

import { screenBatch, type ScreenItem } from './screen.ts';

const WORDS = {
  entityTypes: ['vessel', 'company', 'person', 'bank', 'state_body', 'legal_act', 'unknown'],
  relationTypes: ['owns', 'operates', 'appoints', 'designated_by', 'settles_through', 'unknown'],
};

type Attrs = Record<string, { v: string }>;

const entity = (ref: string, type: string, label: string, attrs?: Attrs): ScreenItem => ({
  ref,
  act: { op: 'create_entity', type, label, ...(attrs === undefined ? {} : { attrs }) },
  originator: 'The authors',
  modality: 'asserts',
  evidence: [{ document: 'doc_a', page: 1, excerpt: label }],
});

const relation = (ref: string, type: string, srcId: string, dstId: string): ScreenItem => ({
  ref,
  act: { op: 'create_relation', type, srcId, dstId },
  originator: 'The authors',
  modality: 'asserts',
  evidence: [{ document: 'doc_a', page: 1, excerpt: 'a passage' }],
});

const refsOf = (items: readonly ScreenItem[]) => items.map((item) => item.ref);

test('an entity or a relation with a type outside the vocabulary is dropped, and unknown stays', () => {
  const screened = screenBatch(
    [
      entity('russia', 'country', 'Russia'),
      entity('volume', 'economic_indicator', 'Messaging volume'),
      entity('spfs', 'unknown', 'SPFS'),
      entity('swift', 'company', 'SWIFT'),
      relation('r1', 'competes_with', 'spfs', 'swift'),
    ],
    WORDS,
    new Set(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['spfs', 'swift']);
  expect(screened.dropped).toStrictEqual({ type_outside_vocabulary: 3 });
});

test('a generic group of countries is no state body, and a named body or state stays', () => {
  const screened = screenBatch(
    [
      entity('g1', 'state_body', 'European countries'),
      entity('g2', 'state_body', 'African countries'),
      entity('g3', 'state_body', 'the Asian countries'),
      entity('g4', 'state_body', 'Western nations'),
      entity('g5', 'state_body', 'Member States'),
      entity('s1', 'state_body', 'United States'),
      entity('s2', 'state_body', 'United Nations'),
      entity('s3', 'state_body', 'Organization of American States'),
      entity('s4', 'state_body', 'Bank of Russia'),
    ],
    WORDS,
    new Set(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['s1', 's2', 's3', 's4']);
  expect(screened.dropped).toStrictEqual({ generic_group: 5 });
});

test('a generic concept is no legal act, and a named act stays', () => {
  const screened = screenBatch(
    [
      entity('a1', 'legal_act', 'Financial sanctions'),
      entity('a2', 'legal_act', 'Export controls'),
      entity('a3', 'legal_act', 'Council Regulation (EU) No 833/2014'),
      entity('a4', 'legal_act', 'Executive Order 14024'),
    ],
    WORDS,
    new Set(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['a3', 'a4']);
  expect(screened.dropped).toStrictEqual({ generic_concept: 2 });
});

test('a person stays only with a designation, an appointment or an ownership in the batch', () => {
  const screened = screenBatch(
    [
      entity('author', 'person', 'Alex Example', { email: { v: 'alex@bank.example' } }),
      entity('quoted', 'person', 'Kim Quoted'),
      entity('listed', 'person', 'Ivan Listed', {
        contact: { v: 'ivan@firm.example' },
        nationality: { v: 'RU' },
      }),
      entity('act', 'legal_act', 'Executive Order 14024'),
      entity('firm', 'company', 'Firm LLC'),
      entity('director', 'person', 'Dana Director'),
      relation('r1', 'designated_by', 'listed', 'act'),
      relation('r2', 'appoints', 'firm', 'director'),
      relation('r3', 'operates', 'quoted', 'firm'),
    ],
    WORDS,
    new Set(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['listed', 'act', 'firm', 'director', 'r1', 'r2']);
  // The e-mail address of a person is never proposed, also for a person that stays.
  expect(screened.items[0]?.act).toStrictEqual({
    op: 'create_entity',
    type: 'person',
    label: 'Ivan Listed',
    attrs: { nationality: { v: 'RU' } },
  });
  expect(screened.dropped).toStrictEqual({
    person_outside_publication_rule: 2,
    email_address: 1,
    names_a_dropped_item: 1,
  });
});

test('the same entity again in one batch is dropped, and its relations name the first one', () => {
  const screened = screenBatch(
    [
      entity('swift', 'company', 'SWIFT'),
      entity('bank', 'bank', 'Bank of Russia'),
      entity('swift_2', 'company', ' swift. '),
      relation('r1', 'settles_through', 'bank', 'swift_2'),
    ],
    WORDS,
    new Set(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['swift', 'bank', 'r1']);
  expect(screened.items[2]?.act).toMatchObject({ srcId: 'bank', dstId: 'swift' });
  expect(screened.dropped).toStrictEqual({ duplicate_in_job: 1 });
});

test('an entity that an earlier part of the job proposed is dropped with the relations that name it', () => {
  const first = screenBatch([entity('swift', 'company', 'SWIFT')], WORDS, new Set());
  const seen = new Set(first.proposed);

  const screened = screenBatch(
    [
      entity('swift', 'company', 'Swift'),
      entity('spfs', 'unknown', 'SPFS'),
      entity('swift_bank', 'bank', 'SWIFT'),
      relation('r1', 'unknown', 'spfs', 'swift'),
    ],
    WORDS,
    seen,
  );

  // The same name with another type is another entity.
  expect(refsOf(screened.items)).toStrictEqual(['spfs', 'swift_bank']);
  expect(screened.dropped).toStrictEqual({ duplicate_in_job: 1, names_a_dropped_item: 1 });
  expect(screened.proposed).toHaveLength(2);
});
