import { expect, test } from 'vitest';

import { hasRefusedMetaCommand } from './db-sql-guard.ts';

test.each(['\\c gabriel\nDELETE FROM x;', 'select 1; \\connect gabriel', '\\! id', '\\c'])(
  'the script %j is refused',
  (script) => {
    expect(hasRefusedMetaCommand(script)).toBe(true);
  },
);

test.each(['select 1', "\\copy t to 'f.csv'", "select E'a\\nb'", '\\x\nselect 1'])(
  'the script %j runs',
  (script) => {
    expect(hasRefusedMetaCommand(script)).toBe(false);
  },
);
