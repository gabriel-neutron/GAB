// Departure: the seed rows are written from the module that declares them, not by hand. It reads
// no database and no network, so the text of a row is a function of the declaration alone.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import type { SeededRelationType } from '../packages/proposal/src/relation-types.ts';
import { SEEDED_RELATION_TYPES } from '../packages/proposal/src/relation-types.ts';
import type { SeededEntityType } from '../src/shared/vocabulary/declarations.ts';
import { seededVocabulary } from '../src/shared/vocabulary/declarations.ts';

const SEED = join(import.meta.dirname, '..', 'db', 'apply', '95_seed.sql');

type Cell = string | number | boolean | null;

/** One marked region of the seed: the table, its columns, and the first column that is a number
 * and so is aligned on the right. */
interface Block {
  readonly table: string;
  readonly columns: readonly string[];
  readonly rightAligned: number;
  readonly rows: readonly (readonly Cell[])[];
}

// External constraint: a single quote inside a SQL string literal is written twice.
const literal = (value: Cell): string => {
  if (value === null) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
};

const widths = (rows: readonly (readonly string[])[]): readonly number[] =>
  rows[0]?.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length))) ?? [];

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

const entityTypeBlock = (entityTypes: readonly SeededEntityType[]): Block => ({
  table: 'entity_type',
  columns: ['key', 'label', 'colour_light', 'colour_dark', 'ord'],
  rightAligned: 4,
  rows: entityTypes.map((row) => [row.key, row.label, row.colourLight, row.colourDark, row.ord]),
});

// The update names no `retired`: a word taken out of service in the live table stays out of
// service when the seed runs again.
const relationTypeBlock = (relationTypes: readonly SeededRelationType[]): Block => ({
  table: 'relation_type',
  columns: ['key', 'label', 'inverse_label', 'takes_interval'],
  rightAligned: 4,
  rows: relationTypes.map((row) => [row.key, row.label, row.inverseLabel, row.takesInterval]),
});

const vocabularyStatement = (block: Block): string =>
  [
    `INSERT INTO ${block.table} (${block.columns.join(', ')}) VALUES`,
    valuesList(block.rows, block.rightAligned),
    updateTail(block.columns.slice(1)),
    '',
  ].join('\n');

const withBlock = (seed: string, block: Block): string => {
  const open = `-- >>> GENERATED ${block.table}\n`;
  const close = `-- <<< GENERATED ${block.table}`;
  const start = seed.indexOf(open);
  const end = start === -1 ? -1 : seed.indexOf(close, start);
  if (start === -1 || end === -1) throw new Error(`the seed carries no marker for ${block.table}`);
  return seed.slice(0, start + open.length) + vocabularyStatement(block) + seed.slice(end);
};

export const seedWithVocabulary = (
  seed: string,
  entityTypes: readonly SeededEntityType[],
  relationTypes: readonly SeededRelationType[],
): string =>
  withBlock(withBlock(seed, entityTypeBlock(entityTypes)), relationTypeBlock(relationTypes));

if (argv[1] === fileURLToPath(import.meta.url)) {
  const seed = await readFile(SEED, 'utf8');
  const written = seedWithVocabulary(seed, seededVocabulary.entityTypes, SEEDED_RELATION_TYPES);
  await writeFile(SEED, written, 'utf8');
  console.log(written === seed ? 'seed unchanged' : 'seed rewritten');
}
