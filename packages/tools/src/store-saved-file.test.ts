// The name rule of a saved file, with no database: a name that Windows or a path could read as
// another file is refused before any read.

import { expect, test } from 'vitest';

import { nameFault } from './store-saved-file.ts';

test.each(['timeline.html', 'Regulation 2022-879.pdf', 'act.xhtml'])(
  '%s is a plain name',
  (name) => {
    expect(nameFault(name)).toBeNull();
  },
);

test.each([
  ['a parent folder', '../secret.html'],
  ['a folder', 'sub/timeline.html'],
  ['a Windows folder', 'sub\\timeline.html'],
  ['a drive', 'C:secret.html'],
  ['a data stream', 'a.txt:x.html'],
  ['a hidden file', '.hidden.html'],
  ['a final dot', 'page.html.'],
  ['a final space', 'page.html '],
  ['a device', 'CON.html'],
  ['a device in lower case', 'lpt1.pdf'],
  ['a forbidden character', 'what?.html'],
  ['an empty name', ''],
])('%s is refused', (_name, name) => {
  expect(nameFault(name)).not.toBeNull();
});
