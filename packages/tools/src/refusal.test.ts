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

const CREATE = { op: 'create_entity', type: 'vessel', label: 'Nayara' };

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
  ['lookup_entity', 'a blank key', { key: '', value: '9123456' }],
  ['proposal_read', 'an identifier that is not one', { proposal: 'p1' }],
  ['enqueue_extract', 'a blank document', { document: ' ' }],
  ['job_status', 'a missing document', {}],
  [
    'propose_change',
    'a payload that the request schema refuses',
    {
      act: { op: 'create_entity', type: '', label: 'Nayara' },
      documents: [DOC],
    },
  ],
  ['propose_change', 'an act that cites no document', { act: CREATE, documents: [] }],
  ['propose_change', 'a reserved document', { act: CREATE, documents: ['manual'] }],
  ['propose_change', 'the second reserved document', { act: CREATE, documents: ['inherited'] }],
  [
    'propose_change',
    'a delete, which a machine does not propose',
    {
      act: { op: 'delete_entity', targetId: ID },
      documents: [DOC],
    },
  ],
  [
    'propose_change',
    'a field that nothing declares',
    { act: CREATE, documents: [DOC], role: 'app' },
  ],
];

for (const [name, why, raw] of REFUSED)
  test(`${name} refuses ${why} and runs no SQL`, async () => {
    const outcome = await callTool(toolNamed(name), noSql, raw);
    expect(outcome.ok).toBe(false);
  });

test('a tool called with its run function and a reserved document still refuses before SQL', async () => {
  const tool = toolNamed('propose_change');
  await expect(tool.run(noSql, { act: CREATE, documents: ['manual'] })).rejects.toThrow(
    /reserved document/,
  );
});

test('document_text names the cap in the sentence of its refusal', async () => {
  const outcome = await callTool(toolNamed('document_text'), noSql, {
    document: DOC,
    fromPage: 1,
    toPage: 11,
  });
  expect(outcome).toMatchObject({ ok: false, refusal: expect.stringContaining('10') as string });
});
