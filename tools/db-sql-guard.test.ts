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
  "-- it's\n\\! id\n-- don't",
  "select E'\\'';\n\\! id\nselect 'x'",
  'select "a\\c";\n\\! id',
  'select 1; -- x\r\\! id',
  "\\echo 'x\\'' \\! id",
  '\\echo hi -- \\! id\n',
  "/* /* */ ' */ \\! id\n-- '",
  '\\echo `id`',
  'select 1$$ x $$ \\! id',
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
  'select $$a\\c$$',
  'select $f$ \\! $f$',
  "select 'it''s \\c'",
  '\\echo done\nselect 1',
  'select /* a /* b */ \\c */ 1',
  'select a$$b, $q$ \\c $q$',
  "select E'a\\'b'",
])('the script %j runs', (script) => {
  expect(hasRefusedMetaCommand(script)).toBe(false);
});
