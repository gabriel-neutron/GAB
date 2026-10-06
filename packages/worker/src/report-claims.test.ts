// The parser of the report claims files, read on the invented fixture. No file of the private data
// repository is read.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { claimDocument, parseClaims } from './report-claims.ts';

const FIXTURES = join(import.meta.dirname, '../../../tools/fixtures/claims');

const fixture = async (name: string): Promise<string> => readFile(join(FIXTURES, name), 'utf8');

test('the parser returns three kept blocks and the deleted one, and reports the missing Limite', async () => {
  const blocks = parseClaims(await fixture('alpha-final.md'), 'alpha-final.md');

  expect(blocks.map((block) => [block.claimId, block.deleted])).toStrictEqual([
    ['C-ALPHA-1', false],
    ['C-ALPHA-2', false],
    ['C-ALPHA-3', true],
    ['C-ALPHA-4', false],
  ]);
  expect(blocks.map((block) => block.missing)).toStrictEqual([[], ['Limite'], [], []]);
  expect(blocks[2]?.reason).toBe('SUPPRIMÉ. The invented figure repeats C-ALPHA-1.');
  expect(blocks.every((block) => block.file === 'alpha-final.md')).toBe(true);
});

test('each block keeps its line range and each field as raw text', async () => {
  const [full, twoLines, , reviewed] = parseClaims(
    await fixture('alpha-final.md'),
    'alpha-final.md',
  );

  expect([full?.firstLine, full?.lastLine]).toStrictEqual([5, 14]);
  expect(full?.fields.map((field) => [field.name, field.text])).toStrictEqual([
    ['Énoncé', 'The invented harbour of Nowhere handled 12 invented units in the year 2020.'],
    ['Chiffre', '12 units'],
    ['Source', 'S01, table 3; S02'],
    ['Nature de la mesure', 'invented count'],
    ['ADMIRALTY', 'B2'],
    ['Licence', 'invented licence'],
    ['Limite', 'the count is invented'],
    ['Rail', 'invented rail'],
  ]);
  expect(twoLines?.fields[0]?.text).toBe(
    'The invented company Example Trading owns two invented ships.\n' +
      '  The second line of the statement stays with the statement.',
  );
  expect(reviewed?.fields.slice(8).map((field) => field.name)).toStrictEqual([
    'Correction appliquée',
    'Révision',
    'Verdict',
  ]);
  expect(reviewed?.unknown).toStrictEqual([]);
});

test('an unknown field name is reported, and its text stays in the block', async () => {
  const [block] = parseClaims(await fixture('beta-final.md'), 'beta-final.md');

  expect(block?.unknown).toStrictEqual(['Remarque']);
  expect(block?.fields.at(-1)).toMatchObject({
    name: 'Remarque',
    text: 'an invented field name that the parser does not know',
  });
  expect(block?.lines.at(-1)).toBe(
    '- **Remarque** : an invented field name that the parser does not know',
  );
});

test('a bold name with its colon inside, a plain known name and a table row are fields too', () => {
  const text = [
    '### C-SHAPE-1',
    '**Énoncé :** first',
    'Chiffre: 1',
    '| Source | S09 |',
    '**Not a field** because no colon follows it.',
  ].join('\r\n');
  const [block] = parseClaims(text, 'shape-final.md');

  expect(block?.fields.map((field) => [field.name, field.text])).toStrictEqual([
    ['Énoncé', 'first'],
    ['Chiffre', '1'],
    ['Source', 'S09\n**Not a field** because no colon follows it.'],
  ]);
});

test('a heading that says the block is deleted gives the reason too', () => {
  const [block] = parseClaims('### ~~C-SHAPE-2~~ (supprimé: invented duplicate)\n', 'x-final.md');

  expect(block).toMatchObject({
    claimId: 'C-SHAPE-2',
    deleted: true,
    reason: '(supprimé: invented duplicate)',
  });
});

test('two blocks with one claim id are both returned, so the load can see the second one', () => {
  const text = '### C-SHAPE-3\n**Énoncé** : one\n\n### C-SHAPE-3\n**Énoncé** : two\n';
  const blocks = parseClaims(text, 'x-final.md');

  expect(blocks.map((block) => block.claimId)).toStrictEqual(['C-SHAPE-3', 'C-SHAPE-3']);
  const [first, second] = blocks;
  if (first === undefined || second === undefined) throw new Error('two blocks are expected');
  expect(claimDocument(first, [])).not.toBe(claimDocument(second, []));
});

test('the document of a block names its sources first, then holds the block as the file holds it', async () => {
  const [full] = parseClaims(await fixture('alpha-final.md'), 'alpha-final.md');
  if (full === undefined) throw new Error('the fixture has a first block');

  const text = claimDocument(full, ['doc_b2b2b2b2b2b2', 'doc_a1a1a1a1a1a1']);
  expect(text.split('\n').slice(0, 5)).toStrictEqual([
    'Claim: C-ALPHA-1',
    'File: alpha-final.md',
    'Sources: doc_a1a1a1a1a1a1, doc_b2b2b2b2b2b2',
    '',
    '### C-ALPHA-1',
  ]);
  expect(text).toContain('- **ADMIRALTY** : B2\n');
  expect(text.endsWith('- **Rail** : invented rail\n')).toBe(true);
  expect(claimDocument(full, ['doc_a1a1a1a1a1a1', 'doc_b2b2b2b2b2b2'])).toBe(text);
  expect(claimDocument(full, []).split('\n')[2]).toBe('Sources: none');
});

test('a file with Windows line ends gives the same document as a file with line feeds', async () => {
  const unix = await fixture('alpha-final.md');
  const [fromUnix] = parseClaims(unix, 'alpha-final.md');
  const [fromWindows] = parseClaims(unix.replaceAll('\n', '\r\n'), 'alpha-final.md');
  if (fromUnix === undefined || fromWindows === undefined) throw new Error('a block is expected');

  expect(claimDocument(fromWindows, [])).toBe(claimDocument(fromUnix, []));
});
