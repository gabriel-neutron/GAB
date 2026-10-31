import { expect, test } from 'vitest';

import { toldFault } from './store-archive.ts';
import { ToolRefusal } from './tool.ts';

test('a refusal of a tool or of a rule of the record is told, and any other fault is not', () => {
  expect(toldFault(new ToolRefusal('the file is empty'))).toBe('the file is empty');
  expect(toldFault(Object.assign(new Error('a rule'), { code: '23514' }))).toBe('a rule');
  expect(toldFault(Object.assign(new Error('a door'), { code: 'P0001' }))).toBe('a door');
  expect(toldFault(Object.assign(new Error('role x'), { code: '28P01' }))).toBeNull();
  expect(toldFault(new Error('ENOENT: /home/someone/file'))).toBeNull();
  expect(toldFault('text')).toBeNull();
});
