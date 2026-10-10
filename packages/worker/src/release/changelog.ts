import { csvFile } from './csv-file.ts';
import type { ReleaseFile } from './csv-export.ts';
import type { PreviousRelease } from './previous-release.ts';
import { dayOfRelease, type ReleaseHeading } from './release-heading.ts';
import { readReleaseTables, type ReleaseTable, type ReleaseTableName } from './release-table.ts';

/** The path of the changelog in a release folder. The downloads page of the site links it. */
export const CHANGELOG_PATH = 'changelog.csv';

const HEADER = ['kind', 'id', 'change', 'changed_columns', 'label', 'survivor_id'];

type Kind = 'entity' | 'relation' | 'claim';
type Change = 'added' | 'changed' | 'removed' | 'merged' | 'unmerged';

const CHANGES: readonly Change[] = ['added', 'changed', 'removed', 'merged', 'unmerged'];

/** The number of rows of each change. */
export type ChangeCounts = Readonly<Record<Change, number>>;

/** What the file manifest says of the changelog. */
export interface ChangelogSummary {
  readonly path: string;
  /** The previous release, or null for the first release. */
  readonly previous: { readonly version: string; readonly date: string } | null;
  readonly entities: ChangeCounts;
  readonly relations: ChangeCounts;
  readonly claims: ChangeCounts;
}

interface Line {
  readonly kind: Kind;
  readonly id: string;
  readonly change: Change;
  readonly columns: readonly string[];
  readonly label: string;
  readonly survivor: string;
}

interface Side {
  readonly table: ReleaseTable;
  readonly rows: ReadonlyMap<string, readonly (readonly string[])[]>;
  readonly cell: (row: readonly string[], column: string) => string;
}

const sideOf = (table: ReleaseTable, key: string): Side => {
  const cell = (row: readonly string[], column: string): string => {
    const at = table.header.indexOf(column);
    return at < 0 ? '' : (row[at] ?? '');
  };
  const rows = new Map<string, (readonly string[])[]>();
  for (const row of table.rows) {
    const id = cell(row, key);
    rows.set(id, [...(rows.get(id) ?? []), row]);
  }
  return { table, rows, cell };
};

/** Each absorbed identifier of the merges that stand, with the survivor that it resolves to. */
const standingMerges = (merges: ReleaseTable): ReadonlyMap<string, string> => {
  const side = sideOf(merges, 'act_id');
  const standing = new Map<string, string>();
  for (const row of merges.rows) {
    const survivor = side.cell(row, 'resolves_to');
    if (survivor !== '') standing.set(side.cell(row, 'absorbed_id'), survivor);
  }
  return standing;
};

const sameValues = (one: readonly string[], two: readonly string[]): boolean =>
  JSON.stringify([...one].sort()) === JSON.stringify([...two].sort());

const TABLES: readonly {
  readonly kind: Kind;
  readonly name: ReleaseTableName;
  readonly key: string;
  readonly label: (cell: (column: string) => string) => string;
}[] = [
  { kind: 'entity', name: 'entities.csv', key: 'id', label: (cell) => cell('label') },
  {
    kind: 'relation',
    name: 'relations.csv',
    key: 'id',
    label: (cell) => `${cell('from_label')} ${cell('type')} ${cell('to_label')}`,
  },
  {
    kind: 'claim',
    name: 'claims.csv',
    key: 'claim_id',
    label: (cell) =>
      cell('claim_kind') === 'relation'
        ? `${cell('subject_label')} ${cell('relation_type')} ${cell('object_label')}`
        : `${cell('subject_label')}: ${cell('attribute')}`,
  },
];

/** The changelog of a release: each entity, relation and claim added, changed or removed since
 * the previous release, by identifier, read from the files of the two releases only. A changed
 * row names its changed columns. An entity that a merge absorbed shows as merged into its
 * survivor, and an entity that an undo restored as unmerged; the claims of that entity show the
 * same way. Only a column of both releases counts, so a column that only one release holds,
 * such as the NATO pair, is no change and the changelog copies none of its values. */
export const releaseChangelog = (
  previous: PreviousRelease | null,
  current: readonly ReleaseFile[],
  heading: ReleaseHeading,
): { file: ReleaseFile; summary: ChangelogSummary } => {
  const now = readReleaseTables((path) => current.find((file) => file.path === path)?.text);
  const lines: Line[] = [];
  if (previous !== null) {
    const mergedNow = standingMerges(now['merges.csv']);
    const mergedBefore = standingMerges(previous.tables['merges.csv']);
    for (const { kind, name, key, label } of TABLES) {
      const before = sideOf(previous.tables[name], key);
      const after = sideOf(now[name], key);
      const columns = after.table.header.filter(
        (column) => column !== key && before.table.header.includes(column),
      );
      const ids = new Set([...before.rows.keys(), ...after.rows.keys()]);
      for (const id of ids) {
        const old = before.rows.get(id);
        const fresh = after.rows.get(id);
        const shown = fresh ?? old ?? [];
        const [first] = shown;
        const side = fresh === undefined ? before : after;
        const line = (change: Change, changed: readonly string[] = [], survivor = '') =>
          lines.push({
            kind,
            id,
            change,
            columns: changed,
            label: first === undefined ? '' : label((column) => side.cell(first, column)),
            survivor,
          });
        // The subject of a claim is the identifier before its slash.
        const subject = id.split('/')[0] ?? id;
        if (old !== undefined && fresh !== undefined) {
          const changed = columns.filter(
            (column) =>
              !sameValues(
                old.map((row) => before.cell(row, column)),
                fresh.map((row) => after.cell(row, column)),
              ),
          );
          if (changed.length > 0) line('changed', changed);
        } else if (fresh !== undefined) {
          const survivor = mergedBefore.get(subject);
          if (survivor === undefined) line('added');
          else line('unmerged', [], survivor);
        } else {
          const survivor = mergedNow.get(subject);
          if (survivor === undefined) line('removed');
          else line('merged', [], survivor);
        }
      }
    }
  }

  const order = (one: Line): string =>
    `${String(TABLES.findIndex((table) => table.kind === one.kind))} ${String(CHANGES.indexOf(one.change))}`;
  lines.sort((one, two) => order(one).localeCompare(order(two)) || one.id.localeCompare(two.id));

  const counts = (kind: Kind): ChangeCounts => {
    const of = (change: Change) =>
      lines.filter((one) => one.kind === kind && one.change === change).length;
    return {
      added: of('added'),
      changed: of('changed'),
      removed: of('removed'),
      merged: of('merged'),
      unmerged: of('unmerged'),
    };
  };

  const since =
    previous === null
      ? 'First release: no earlier release to compare.'
      : `Changes since version ${previous.version} of ${dayOfRelease(previous.date)}.`;
  const preamble = `${heading.title}\n\n${since}\n\n${heading.disclaimer}`;
  const rows = lines.map((one) => [
    one.kind,
    one.id,
    one.change,
    one.columns.join(' '),
    one.label,
    one.survivor,
  ]);
  return {
    file: { path: CHANGELOG_PATH, text: csvFile(preamble, HEADER, rows) },
    summary: {
      path: CHANGELOG_PATH,
      previous: previous === null ? null : { version: previous.version, date: previous.date },
      entities: counts('entity'),
      relations: counts('relation'),
      claims: counts('claim'),
    },
  };
};
