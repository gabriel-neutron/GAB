// Prints the comment census of `src/`, and gates one file for the edit hook.
// `src/routeTree.gen.ts` is excluded by name, because a generator writes it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { LIMITS, measure, ratio, type Measurement } from './comment-budget.ts';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'src');
const GENERATED = join('src', 'routeTree.gen.ts');

const posix = (path: string): string => path.split('\\').join('/');

const sources = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, found);
    else if (/\.tsx?$/.test(entry) && relative(ROOT, full) !== GENERATED) found.push(full);
  }
  return found;
};

const read = (path: string): Measurement => measure(readFileSync(path, 'utf8'));

const gate = (path: string): number => {
  const found = read(path);
  const faults = [
    ...found.overBlocks.map(
      (block) =>
        `${posix(relative(ROOT, path))}:${block.line}  A comment block is ${LIMITS.blockLines} lines. This one is ${block.lines}.`,
    ),
    ...found.longLines.map(
      (long) =>
        `${posix(relative(ROOT, path))}:${long.line}  A comment line is ${LIMITS.lineChars} characters. This one is ${long.chars}.`,
    ),
  ];
  faults.forEach((fault) => console.error(fault));
  return faults.length === 0 ? 0 : 1;
};

const census = (list: boolean): number => {
  const files = sources(SOURCE);
  const rows = files
    .map((path) => ({ path: posix(relative(ROOT, path)), ...read(path) }))
    .sort((a, b) => b.commentChars - a.commentChars);

  const commentLines = rows.reduce((sum, row) => sum + row.commentLines, 0);
  const codeLines = rows.reduce((sum, row) => sum + row.codeLines, 0);
  const overBlocks = rows.reduce((sum, row) => sum + row.overBlocks.length, 0);
  const longLines = rows.reduce((sum, row) => sum + row.longLines.length, 0);

  if (list)
    rows
      .slice(0, 15)
      .forEach((row) =>
        console.log(
          `${(ratio(row.commentLines, row.codeLines) * 100).toFixed(0).padStart(3)}%  ${String(row.commentLines).padStart(4)}c ${String(row.codeLines).padStart(4)}L  ${String(row.overBlocks.length).padStart(3)} over  ${row.path}`,
        ),
      );

  console.log(
    `census ${(ratio(commentLines, codeLines) * 100).toFixed(1)}% of ${files.length} files (${commentLines} comment, ${codeLines} code), ${overBlocks} blocks over ${LIMITS.blockLines} lines, ${longLines} lines over ${LIMITS.lineChars} characters`,
  );
  return 0;
};

const [, , ...argv] = process.argv;
const file = argv.indexOf('--file');
process.exitCode =
  file !== -1 ? gate(join(ROOT, argv[file + 1] ?? '')) : census(argv.includes('--list'));
