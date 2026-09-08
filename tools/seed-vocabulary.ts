// Writes the vocabulary rows of the seed file from the module that declares them. It reads no
// database and no network: the text of a row is a function of the declaration alone.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import type { SeededEntityType } from '../src/shared/vocabulary/declarations.ts';
import { seededVocabulary } from '../src/shared/vocabulary/declarations.ts';

const SEED = join(import.meta.dirname, '..', 'db', 'apply', '95_seed.sql');

type Cell = string | number | null;

// A single quote inside a SQL string literal is written twice.
const literal = (value: Cell): string => {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
};

const widths = (rows: readonly (readonly string[])[]): readonly number[] =>
  rows[0]?.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length))) ?? [];

/** The rows of one VALUES list, one row a line, each column as wide as its widest value. */
const valuesList = (rows: readonly (readonly Cell[])[], rightAligned: number): string => {
  const printed = rows.map((row) => row.map(literal));
  const width = widths(printed);
  return printed
    .map((row, index) => {
      const tail = index === printed.length - 1 ? ')' : '),';
      const cells = row.map((cell, column) => {
        const size = width[column] ?? 0;
        const last = column === row.length - 1;
        if (column >= rightAligned) return last ? cell.padStart(size) : `${cell.padStart(size)}, `;
        return last ? cell : `${cell},`.padEnd(size + 2);
      });
      return `  (${cells.join('')}${tail}`;
    })
    .join('\n');
};

const updateTail = (columns: readonly string[]): string => {
  const width = Math.max(...columns.map((column) => column.length));
  const lines = columns.map(
    (column, index) =>
      `  ${column.padEnd(width)} = EXCLUDED.${column}${index === columns.length - 1 ? ';' : ','}`,
  );
  return `ON CONFLICT (key) DO UPDATE SET\n${lines.join('\n')}`;
};

const statement = (
  table: string,
  columns: readonly string[],
  rows: readonly (readonly Cell[])[],
  rightAligned: number,
): string =>
  [
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES`,
    valuesList(rows, rightAligned),
    updateTail(columns.slice(1)),
    '',
  ].join('\n');

/** The one INSERT statement the seed carries. */
export const vocabularyStatement = (entityTypes: readonly SeededEntityType[]): string =>
  statement(
    'entity_type',
    ['key', 'label', 'colour_light', 'colour_dark', 'ord'],
    entityTypes.map((row) => [row.key, row.label, row.colourLight, row.colourDark, row.ord]),
    4,
  );

const spliced = (seed: string, table: string, body: string): string => {
  const open = `-- >>> GENERATED ${table}\n`;
  const close = `-- <<< GENERATED ${table}`;
  const start = seed.indexOf(open);
  const end = start === -1 ? -1 : seed.indexOf(close, start);
  if (start === -1 || end === -1) throw new Error(`the seed carries no marker for ${table}`);
  return seed.slice(0, start + open.length) + body + seed.slice(end);
};

/** The seed file with the marked region replaced. Every other line comes back unchanged. */
export const seedWithVocabulary = (
  seed: string,
  entityTypes: readonly SeededEntityType[],
): string => spliced(seed, 'entity_type', vocabularyStatement(entityTypes));

if (argv[1] === fileURLToPath(import.meta.url)) {
  const seed = await readFile(SEED, 'utf8');
  const written = seedWithVocabulary(seed, seededVocabulary.entityTypes);
  await writeFile(SEED, written, 'utf8');
  console.log(written === seed ? 'seed unchanged' : 'seed rewritten');
}
