import { expect, test } from 'vitest';

import { hasRefusedMetaCommand } from './db-sql-guard.ts';

test.each([
  '\\c gabriel\nDELETE FROM x;',
  'select 1; \\connect gabriel',
  '\\! id',
  '\\c',
  'select 1 \\g |id',
  '\\o |id',
  "\\copy t to program 'id'",
  '\\i other.sql',
])('the script %j is refused', (script) => {
  expect(hasRefusedMetaCommand(script)).toBe(true);
});

test.each([
  'select 1',
  "select E'a\\nb'",
  "select 'a' like '%\\c%'",
  '-- see \\c\nselect 1',
  '\\x\nselect 1',
  '\\dt+',
])('the script %j runs', (script) => {
  expect(hasRefusedMetaCommand(script)).toBe(false);
});
