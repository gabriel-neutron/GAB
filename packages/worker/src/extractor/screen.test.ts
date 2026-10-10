import { expect, test } from 'vitest';

import { screenBatch, type ScreenItem } from './screen.ts';

const WORDS = {
  entityTypes: ['vessel', 'company', 'person', 'bank', 'state_body', 'legal_act', 'unknown'],
  relationTypes: ['owns', 'operates', 'appoints', 'designated_by', 'settles_through', 'unknown'],
  datedRelationTypes: ['owns', 'operates', 'appoints', 'designated_by'],
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
    new Map(),
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
    new Map(),
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
      entity('a5', 'legal_act', 'Export Administration Regulations'),
      entity('a6', 'legal_act', 'Russia Sanctions Regulations'),
      entity('a7', 'legal_act', 'sanctions'),
    ],
    WORDS,
    new Map(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['a3', 'a4', 'a5', 'a6']);
  expect(screened.dropped).toStrictEqual({ generic_concept: 3 });
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
    new Map(),
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
    new Map(),
  );

  expect(refsOf(screened.items)).toStrictEqual(['swift', 'bank', 'r1']);
  expect(screened.items[2]?.act).toMatchObject({ srcId: 'bank', dstId: 'swift' });
  expect(screened.dropped).toStrictEqual({ duplicate_in_job: 1 });
});

test('an entity of an earlier part that adds nothing is dropped, and one that a kept relation names stays', () => {
  const first = screenBatch([entity('swift', 'company', 'SWIFT')], WORDS, new Map());
  const seen = new Map(first.proposed);

  const screened = screenBatch(
    [
      entity('swift_again', 'company', 'Swift'),
      entity('spfs', 'unknown', 'SPFS'),
      entity('swift_bank', 'bank', 'SWIFT'),
      relation('r1', 'unknown', 'spfs', 'swift_again'),
    ],
    WORDS,
    seen,
  );

  // The later part cannot name the pending proposal of the first part, so the entity stays with
  // its relation. The same name with another type is another entity.
  expect(refsOf(screened.items)).toStrictEqual(['swift_again', 'spfs', 'swift_bank', 'r1']);
  expect(screened.dropped).toStrictEqual({});
  // The repeat is the act of the first part, with its label and its passages, so the door returns
  // the act that waits and the job gives one proposal for SWIFT. The repeat keeps its own ref,
  // so the relation of this part names it.
  expect(screened.items[0]).toStrictEqual({ ...first.items[0], ref: 'swift_again' });
  expect(screened.items[3]?.act).toMatchObject({ srcId: 'spfs', dstId: 'swift_again' });
  expect(screened.items[0]?.evidence).toStrictEqual([
    { document: 'doc_a', page: 1, excerpt: 'SWIFT' },
  ]);

  const bare = screenBatch(
    [
      entity('swift', 'company', 'SWIFT'),
      entity('swift_2', 'company', 'SWIFT'),
      entity('europe', 'state_body', 'European countries'),
      relation('r1', 'settles_through', 'europe', 'swift_2'),
    ],
    WORDS,
    seen,
  );

  // A repeat that only a dropped relation names adds nothing.
  expect(refsOf(bare.items)).toStrictEqual([]);
  expect(bare.dropped).toStrictEqual({
    duplicate_in_job: 2,
    generic_group: 1,
    names_a_dropped_item: 1,
  });
});

test('an entity of an earlier part with attributes stays', () => {
  const seen = new Map(
    screenBatch([entity('swift', 'company', 'SWIFT')], WORDS, new Map()).proposed,
  );
  const screened = screenBatch(
    [entity('swift', 'company', 'Swift', { hq_country: { v: 'BE' } })],
    WORDS,
    seen,
  );

  expect(refsOf(screened.items)).toStrictEqual(['swift']);
  expect(screened.dropped).toStrictEqual({});
});

test('an entity of an earlier part with an empty attributes object adds nothing', () => {
  const first = screenBatch([entity('swift', 'company', 'SWIFT')], WORDS, new Map());
  const seen = new Map(first.proposed);
  const screened = screenBatch(
    [
      entity('swift', 'company', 'Swift', {}),
      entity('spfs', 'unknown', 'SPFS'),
      entity('swift_2', 'company', 'SWIFT', {}),
      relation('r1', 'unknown', 'spfs', 'swift'),
    ],
    WORDS,
    seen,
  );

  // The repeat that the relation names is the act of the first part. The second repeat is a
  // duplicate in this batch.
  expect(refsOf(screened.items)).toStrictEqual(['swift', 'spfs', 'r1']);
  expect(screened.items[0]).toStrictEqual({ ...first.items[0], ref: 'swift' });
  expect(screened.dropped).toStrictEqual({ duplicate_in_job: 1 });

  const alone = screenBatch([entity('swift', 'company', 'Swift', {})], WORDS, seen);

  expect(refsOf(alone.items)).toStrictEqual([]);
  expect(alone.dropped).toStrictEqual({ duplicate_in_job: 1 });
});

test('an entity of an earlier part with a new geometry stays with its geometry', () => {
  const port = (ref: string, geom?: { type: 'Point'; coordinates: [number, number] }) => {
    const item = entity(ref, 'unknown', 'Sikka');
    return geom === undefined ? item : ({ ...item, act: { ...item.act, geom } } as ScreenItem);
  };
  const point = { type: 'Point' as const, coordinates: [69.8, 22.4] as [number, number] };
  const first = screenBatch([port('sikka')], WORDS, new Map());
  const seen = new Map(first.proposed);

  const screened = screenBatch(
    [
      port('sikka', point),
      entity('spfs', 'unknown', 'SPFS'),
      relation('r1', 'unknown', 'spfs', 'sikka'),
    ],
    WORDS,
    seen,
  );

  expect(refsOf(screened.items)).toStrictEqual(['sikka', 'spfs', 'r1']);
  expect(screened.items[0]?.act).toMatchObject({ geom: point });
  expect(screened.dropped).toStrictEqual({});

  // The same geometry again adds nothing.
  const placed = new Map(screenBatch([port('sikka', point)], WORDS, new Map()).proposed);
  const again = screenBatch([port('sikka', point)], WORDS, placed);

  expect(refsOf(again.items)).toStrictEqual([]);
  expect(again.dropped).toStrictEqual({ duplicate_in_job: 1 });

  // The same geometry with its keys in another order adds nothing.
  const turned = { coordinates: [69.8, 22.4] as [number, number], type: 'Point' as const };
  const reordered = screenBatch([port('sikka', turned)], WORDS, placed);

  expect(refsOf(reordered.items)).toStrictEqual([]);
  expect(reordered.dropped).toStrictEqual({ duplicate_in_job: 1 });
});

test('an entity of an earlier part with the same attributes adds nothing', () => {
  const seen = new Map(
    screenBatch([entity('nayara', 'vessel', 'Nayara', { flag: { v: 'India' } })], WORDS, new Map())
      .proposed,
  );

  const same = screenBatch(
    [entity('nayara', 'vessel', 'Nayara', { flag: { v: 'India' } })],
    WORDS,
    seen,
  );

  expect(refsOf(same.items)).toStrictEqual([]);
  expect(same.dropped).toStrictEqual({ duplicate_in_job: 1 });

  // A new value of an attribute adds something.
  const other = screenBatch(
    [entity('nayara', 'vessel', 'Nayara', { flag: { v: 'Panama' } })],
    WORDS,
    seen,
  );

  expect(refsOf(other.items)).toStrictEqual(['nayara']);
  expect(other.dropped).toStrictEqual({});
});

const dated = (ref: string, type: string, bounds: { validFrom?: string; validTo?: string }) => {
  const item = relation(ref, type, 'a', 'b');
  return { ...item, act: { ...item.act, ...bounds } };
};

test('a relation of a dated type keeps its two bounds, and another type loses them', () => {
  const screened = screenBatch(
    [
      entity('a', 'company', 'Rosneft'),
      entity('b', 'vessel', 'Nayara'),
      dated('r1', 'owns', { validFrom: '2019-05-02', validTo: '2023-11-30' }),
      dated('r2', 'settles_through', { validFrom: '2019-05-02', validTo: '2023-11-30' }),
    ],
    WORDS,
    new Map(),
  );
  expect(screened.items.map((item) => item.act)).toStrictEqual([
    { op: 'create_entity', type: 'company', label: 'Rosneft' },
    { op: 'create_entity', type: 'vessel', label: 'Nayara' },
    {
      op: 'create_relation',
      type: 'owns',
      srcId: 'a',
      dstId: 'b',
      validFrom: '2019-05-02',
      validTo: '2023-11-30',
    },
    { op: 'create_relation', type: 'settles_through', srcId: 'a', dstId: 'b' },
  ]);
  expect(screened.dropped).toStrictEqual({ bound_on_undated_type: 2 });
});
