import { expect, test } from 'vitest';

import { releaseChangelog } from './changelog.ts';
import { csvFile } from './csv-file.ts';
import type { ReleaseFile } from './csv-export.ts';
import type { PreviousRelease } from './previous-release.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { readReleaseTable, readReleaseTables } from './release-table.ts';

const HEADING: ReleaseHeading = {
  version: '2.0',
  date: '2026-12-01',
  title: 'GAB dataset, version 2.0 of 01/12/2026.',
  disclaimer: '**About this data.** A test disclaimer.',
};

const ENTITY = ['id', 'type', 'label', 'origin_label', 'licence', 'document_ids'];
const RELATION = ['id', 'type', 'from_id', 'from_label', 'to_id', 'to_label', 'valid_to'];
const CLAIM = [
  'claim_id',
  'claim_kind',
  'subject_id',
  'subject_label',
  'attribute',
  'value',
  'relation_type',
  'object_label',
  'document_id',
];
const NATO = ['nato_letter', 'nato_digit'];
const MERGE = ['act_id', 'action', 'absorbed_id', 'survivor_id', 'resolves_to'];

interface Folder {
  readonly entities: readonly string[][];
  readonly relations: readonly string[][];
  readonly claims: readonly string[][];
  readonly merges: readonly string[][];
  readonly claimHeader?: readonly string[];
}

const PREAMBLE =
  'GAB dataset, version x.\n\n**About this data.** A line with "a quote, and a comma.';

const filesOf = (folder: Folder): ReleaseFile[] => [
  { path: 'entities.csv', text: csvFile(PREAMBLE, ENTITY, folder.entities) },
  { path: 'relations.csv', text: csvFile(PREAMBLE, RELATION, folder.relations) },
  { path: 'claims.csv', text: csvFile(PREAMBLE, folder.claimHeader ?? CLAIM, folder.claims) },
  { path: 'merges.csv', text: csvFile(PREAMBLE, MERGE, folder.merges) },
];

const previousOf = (folder: Folder): PreviousRelease => {
  const files = new Map(filesOf(folder).map((file) => [file.path, file.text]));
  return {
    version: '1.0',
    date: '2026-11-08',
    tables: readReleaseTables((path) => files.get(path)),
  };
};

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const TWIN = '00000000-0000-4000-8000-000000000004';
const SPLIT = '00000000-0000-4000-8000-000000000005';
const NEW = '00000000-0000-4000-8000-000000000006';
const GONE = '00000000-0000-4000-8000-000000000007';
const OWNS = '00000000-0000-4000-8000-0000000000a1';
const FLAGS = '00000000-0000-4000-8000-0000000000a2';
const MERGE_ACT = '00000000-0000-4000-8000-0000000000b1';
const UNDO_ACT = '00000000-0000-4000-8000-0000000000b2';
const OLD_MERGE = '00000000-0000-4000-8000-0000000000b3';
const LABEL = 'Validated manually by the operator, on 2026-10-08';

const entity = (id: string, label: string, licence = 'CC-BY 4.0') => [
  id,
  'vessel',
  label,
  LABEL,
  licence,
  'doc_a',
];

// The previous release: a ship, its owner, a twin of the ship, an entity that a later release
// leaves out, and an entity that an earlier merge absorbed into the ship.
const BEFORE: Folder = {
  entities: [
    entity(SHIP, 'TEST TANKER'),
    entity(OWNER, 'TEST OWNER'),
    entity(TWIN, 'TEST TWIN'),
    entity(GONE, 'TEST GONE'),
  ],
  relations: [
    [OWNS, 'owns', OWNER, 'TEST OWNER', SHIP, 'TEST TANKER', ''],
    [FLAGS, 'flagged_in', TWIN, 'TEST TWIN', OWNER, 'TEST OWNER', ''],
  ],
  claims: [
    [`${SHIP}/imo`, 'attribute', SHIP, 'TEST TANKER', 'imo', '9123456', '', '', 'doc_a'],
    [`${SHIP}/flag`, 'attribute', SHIP, 'TEST TANKER', 'flag', 'Panama', '', '', 'doc_a'],
    [`${SHIP}/flag`, 'attribute', SHIP, 'TEST TANKER', 'flag', 'Panama', '', '', 'doc_b'],
    [`${TWIN}/built`, 'attribute', TWIN, 'TEST TWIN', 'built', '2001', '', '', 'doc_a'],
    [OWNS, 'relation', OWNER, 'TEST OWNER', '', '', 'owns', 'TEST TANKER', 'doc_a'],
  ],
  merges: [[OLD_MERGE, 'merge', SPLIT, SHIP, SHIP]],
};

// The new release: the twin merged into the ship, the earlier merge undone, a new entity, the
// owner renamed, a new source for the flag, the end of the owns relation, and one entity gone.
const AFTER: Folder = {
  entities: [
    entity(SHIP, 'TEST TANKER'),
    entity(OWNER, 'TEST OWNER RENAMED', 'CC-BY-NC 4.0'),
    entity(SPLIT, 'TEST SPLIT'),
    entity(NEW, 'TEST NEW'),
  ],
  relations: [
    [OWNS, 'owns', OWNER, 'TEST OWNER RENAMED', SHIP, 'TEST TANKER', '2026-11-20'],
    [FLAGS, 'flagged_in', SHIP, 'TEST TANKER', OWNER, 'TEST OWNER RENAMED', ''],
  ],
  claims: [
    [`${SHIP}/imo`, 'attribute', SHIP, 'TEST TANKER', 'imo', '9123456', '', '', 'doc_a'],
    [`${SHIP}/flag`, 'attribute', SHIP, 'TEST TANKER', 'flag', 'Panama', '', '', 'doc_b'],
    [`${SHIP}/flag`, 'attribute', SHIP, 'TEST TANKER', 'flag', 'Panama', '', '', 'doc_c'],
    [`${SHIP}/built`, 'attribute', SHIP, 'TEST TANKER', 'built', '2001', '', '', 'doc_a'],
    [`${SPLIT}/imo`, 'attribute', SPLIT, 'TEST SPLIT', 'imo', '9000001', '', '', 'doc_a'],
    [OWNS, 'relation', OWNER, 'TEST OWNER', '', '', 'owns', 'TEST TANKER', 'doc_a'],
  ],
  merges: [
    [OLD_MERGE, 'merge', SPLIT, SHIP, ''],
    [MERGE_ACT, 'merge', TWIN, SHIP, SHIP],
    [UNDO_ACT, 'undo', SPLIT, SHIP, ''],
  ],
};

const rowsOf = (file: ReleaseFile) => {
  const table = readReleaseTable(file.text);
  return table.rows.map((row) =>
    Object.fromEntries(table.header.map((name, at) => [name, row[at] ?? ''])),
  );
};

test('the changelog lists each entity, relation and claim that changed, by identifier', () => {
  const { file, summary } = releaseChangelog(previousOf(BEFORE), filesOf(AFTER), HEADING);
  expect(file.path).toBe('changelog.csv');
  expect(file.text).toContain('# GAB dataset, version 2.0 of 01/12/2026.');
  expect(file.text).toContain('# Changes since version 1.0 of 08/11/2026.');
  expect(file.text).toContain('# **About this data.** A test disclaimer.');

  expect(rowsOf(file)).toStrictEqual([
    {
      kind: 'entity',
      id: NEW,
      change: 'added',
      changed_columns: '',
      label: 'TEST NEW',
      survivor_id: '',
    },
    {
      kind: 'entity',
      id: OWNER,
      change: 'changed',
      changed_columns: 'label licence',
      label: 'TEST OWNER RENAMED',
      survivor_id: '',
    },
    {
      kind: 'entity',
      id: GONE,
      change: 'removed',
      changed_columns: '',
      label: 'TEST GONE',
      survivor_id: '',
    },
    // A merged entity shows as a merge into its survivor, and an undone merge as such.
    {
      kind: 'entity',
      id: TWIN,
      change: 'merged',
      changed_columns: '',
      label: 'TEST TWIN',
      survivor_id: SHIP,
    },
    {
      kind: 'entity',
      id: SPLIT,
      change: 'unmerged',
      changed_columns: '',
      label: 'TEST SPLIT',
      survivor_id: SHIP,
    },
    {
      kind: 'relation',
      id: OWNS,
      change: 'changed',
      changed_columns: 'valid_to',
      label: 'TEST OWNER RENAMED owns TEST TANKER',
      survivor_id: '',
    },
    {
      kind: 'relation',
      id: FLAGS,
      change: 'changed',
      changed_columns: 'from_id',
      label: 'TEST TANKER flagged_in TEST OWNER RENAMED',
      survivor_id: '',
    },
    {
      kind: 'claim',
      id: `${SHIP}/built`,
      change: 'added',
      changed_columns: '',
      label: 'TEST TANKER: built',
      survivor_id: '',
    },
    {
      kind: 'claim',
      id: `${SHIP}/flag`,
      change: 'changed',
      changed_columns: 'document_id',
      label: 'TEST TANKER: flag',
      survivor_id: '',
    },
    {
      kind: 'claim',
      id: `${TWIN}/built`,
      change: 'merged',
      changed_columns: '',
      label: 'TEST TWIN: built',
      survivor_id: SHIP,
    },
    {
      kind: 'claim',
      id: `${SPLIT}/imo`,
      change: 'unmerged',
      changed_columns: '',
      label: 'TEST SPLIT: imo',
      survivor_id: SHIP,
    },
  ]);
  expect(summary).toStrictEqual({
    path: 'changelog.csv',
    previous: { version: '1.0', date: '2026-11-08' },
    entities: { added: 1, changed: 1, removed: 1, merged: 1, unmerged: 1 },
    relations: { added: 0, changed: 2, removed: 0, merged: 0, unmerged: 0 },
    claims: { added: 1, changed: 1, removed: 0, merged: 1, unmerged: 1 },
  });
});

test('with no previous release, the changelog says "first release" and lists no change', () => {
  const { file, summary } = releaseChangelog(null, filesOf(AFTER), HEADING);
  expect(file.text).toContain('# First release: no earlier release to compare.');
  expect(rowsOf(file)).toStrictEqual([]);
  expect(summary).toMatchObject({ previous: null, entities: { added: 0 }, claims: { added: 0 } });
});

test('two equal releases give no change', () => {
  const { file } = releaseChangelog(previousOf(AFTER), filesOf(AFTER), HEADING);
  expect(rowsOf(file)).toStrictEqual([]);
});

test('with the NATO pair off, the changelog copies no letter and no digit from a release with the pair on', () => {
  const paired = (rows: readonly string[][]) => rows.map((row) => [...row, 'A', '3']);
  const before = previousOf({
    ...AFTER,
    claimHeader: [...CLAIM, ...NATO],
    claims: paired(AFTER.claims),
  });
  const { file } = releaseChangelog(before, filesOf(AFTER), HEADING);
  expect(rowsOf(file)).toStrictEqual([]);
  expect(file.text).not.toMatch(/nato|\bA3\b/iu);

  // The pair on in the new release and off in the old one: the new column is no change.
  const on = releaseChangelog(
    previousOf(AFTER),
    filesOf({ ...AFTER, claimHeader: [...CLAIM, ...NATO], claims: paired(AFTER.claims) }),
    HEADING,
  );
  expect(rowsOf(on.file)).toStrictEqual([]);
});

test('a value that two rows of a claim exchange is a change', () => {
  const header = [...CLAIM, 'page'];
  const claim = (document: string, page: string) => [
    `${SHIP}/imo`,
    'attribute',
    SHIP,
    'TEST TANKER',
    'imo',
    '9123456',
    '',
    '',
    document,
    page,
  ];
  const before = previousOf({
    ...AFTER,
    claimHeader: header,
    claims: [claim('doc_a', '1'), claim('doc_b', '2')],
  });
  const after = filesOf({
    ...AFTER,
    claimHeader: header,
    claims: [claim('doc_b', '1'), claim('doc_a', '2')],
  });
  expect(rowsOf(releaseChangelog(before, after, HEADING).file)).toMatchObject([
    { kind: 'claim', id: `${SHIP}/imo`, change: 'changed', changed_columns: 'page' },
  ]);
});

test('a name that a row copies from another entity is no change of the row', () => {
  const renamed = (rows: readonly string[][]) =>
    rows.map((row) => row.map((cell) => (cell === 'TEST TANKER' ? 'TEST TANKER II' : cell)));
  const after: Folder = {
    ...AFTER,
    entities: renamed(AFTER.entities),
    relations: renamed(AFTER.relations),
    claims: renamed(AFTER.claims),
  };
  expect(rowsOf(releaseChangelog(previousOf(AFTER), filesOf(after), HEADING).file)).toStrictEqual([
    {
      kind: 'entity',
      id: SHIP,
      change: 'changed',
      changed_columns: 'label',
      label: 'TEST TANKER II',
      survivor_id: '',
    },
  ]);
});

test('a column that only the previous release holds is no change', () => {
  const before = previousOf({
    ...AFTER,
    claimHeader: [...CLAIM, 'modality', 'transcribed'],
    claims: AFTER.claims.map((row) => [...row, 'asserts', 'false']),
  });
  expect(rowsOf(releaseChangelog(before, filesOf(AFTER), HEADING).file)).toStrictEqual([]);
});

test('two merges in a chain show each absorbed entity merged into the last survivor', () => {
  const before: Folder = {
    entities: [entity(SHIP, 'TEST A'), entity(OWNER, 'TEST B'), entity(NEW, 'TEST C')],
    relations: [],
    claims: [[`${SHIP}/imo`, 'attribute', SHIP, 'TEST A', 'imo', '1', '', '', 'doc_a']],
    merges: [],
  };
  const after: Folder = {
    entities: [entity(NEW, 'TEST C')],
    relations: [],
    claims: [[`${NEW}/imo`, 'attribute', NEW, 'TEST C', 'imo', '1', '', '', 'doc_a']],
    merges: [
      [MERGE_ACT, 'merge', SHIP, OWNER, NEW],
      [UNDO_ACT, 'merge', OWNER, NEW, NEW],
    ],
  };
  expect(
    rowsOf(releaseChangelog(previousOf(before), filesOf(after), HEADING).file).map((row) => [
      row['kind'],
      row['id'],
      row['change'],
      row['survivor_id'],
    ]),
  ).toStrictEqual([
    ['entity', SHIP, 'merged', NEW],
    ['entity', OWNER, 'merged', NEW],
    ['claim', `${NEW}/imo`, 'added', ''],
    ['claim', `${SHIP}/imo`, 'merged', NEW],
  ]);
});
