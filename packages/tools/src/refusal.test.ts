import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { callTool, type Session, type Tool } from './tool.ts';

// A session that fails the test when a tool reaches it. Each refusal below must come before SQL.
const noSql: Session = {
  query: () => {
    throw new Error('the tool reached the database, and it had to refuse first');
  },
};

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const DOC = 'doc_0123456789ab';
const ID = '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b';

const ITEM = {
  ref: 'nayara',
  act: { op: 'create_entity', type: 'vessel', label: 'Nayara' },
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt: 'the tanker Nayara' }],
};

const REFUSED: readonly (readonly [string, string, unknown])[] = [
  ['search_graph', 'a blank query', { query: '  ' }],
  ['search_graph', 'a limit above fifty', { query: 'nayara', limit: 51 }],
  ['search_graph', 'neither a query nor an identifier', { type: 'vessel' }],
  [
    'search_graph',
    'an identifier key that is not a fixed spelling',
    { identifier: { key: 'imo_number', value: '9074729' } },
  ],
  ['search_graph', 'a blank identifier value', { identifier: { key: 'imo', value: '  ' } }],
  ['neighbourhood', 'a root that is no identifier', { root: 'nayara' }],
  ['neighbourhood', 'a depth above three', { root: ID, depth: 4 }],
  ['document_text', 'a range above the cap', { document: DOC, fromPage: 1, toPage: 11 }],
  [
    'document_text',
    'a range that ends before it starts',
    { document: DOC, fromPage: 5, toPage: 2 },
  ],
  ['document_text', 'a range that starts at page zero', { document: DOC, fromPage: 0 }],
  ['read_entity', 'an entity that is no identifier', { entity: 'nayara' }],
  ['list_proposals', 'a status outside the list', { status: 'open' }],
  ['find_document', 'neither a url nor a title', {}],
  ['list_vocabulary', 'a field that nothing declares', { type: 'vessel' }],
  ['enqueue_extract', 'a blank document', { document: ' ' }],
  ['enqueue_mapping', 'a blank document', { document: ' ' }],
  ['job_status', 'a missing document', {}],
  ['propose', 'an empty batch', { items: [] }],
  [
    'propose',
    'a delete, which a machine does not propose',
    { items: [{ ...ITEM, act: { op: 'delete_entity', targetId: ID } }] },
  ],
  ['propose', 'an item with no excerpt', { items: [{ ...ITEM, evidence: [] }] }],
  ['propose', 'two items with one ref', { items: [ITEM, ITEM] }],
  ['propose', 'a field that nothing declares', { items: [ITEM], role: 'app' }],
];

for (const [name, why, raw] of REFUSED)
  test(`${name} refuses ${why} and runs no SQL`, async () => {
    const outcome = await callTool(toolNamed(name), noSql, raw);
    expect(outcome.ok).toBe(false);
  });

test('document_text names the cap in the sentence of its refusal', async () => {
  const outcome = await callTool(toolNamed('document_text'), noSql, {
    document: DOC,
    fromPage: 1,
    toPage: 11,
  });
  expect(outcome).toMatchObject({ ok: false, refusal: expect.stringContaining('10') as string });
});
