import { expect, test } from 'vitest';

import { ToolRefusal } from './tool.ts';
import { parseTelegramAddress } from './telegram-address.ts';

const FORMS = [
  ['@specnazahmat', { handle: 'specnazahmat' }],
  ['specnazahmat', { handle: 'specnazahmat' }],
  ['SpecnazAkhmat', { handle: 'specnazakhmat' }],
  ['t.me/specnazahmat', { handle: 'specnazahmat' }],
  ['https://t.me/specnazahmat/2042', { handle: 'specnazahmat', message_id: 2042 }],
  ['http://t.me/s/specnazahmat', { handle: 'specnazahmat' }],
  ['https://t.me/s/specnazahmat/2042', { handle: 'specnazahmat', message_id: 2042 }],
  ['https://t.me/specnazahmat/2042?single', { handle: 'specnazahmat', message_id: 2042 }],
  ['tgstat.ru/@specnazahmat/2042', { handle: 'specnazahmat', message_id: 2042 }],
  ['https://tgstat.ru/channel/@specnazahmat/2042', { handle: 'specnazahmat', message_id: 2042 }],
  ['https://www.tgstat.ru/channel/@specnazahmat', { handle: 'specnazahmat' }],
] as const;

for (const [input, expected] of FORMS)
  test(`${input} gives the handle and the post id`, () => {
    expect(parseTelegramAddress(input)).toStrictEqual(expected);
  });

const REFUSED = [
  'https://example.org/specnazahmat/2042',
  'https://t.me/+AbCdEf123',
  'https://t.me/joinchat/AbCdEf123',
  'https://t.me/c/1234567890/12',
  'https://t.me/specnazahmat/0',
  'https://t.me/specnazahmat/12/34',
  'ab',
  '',
] as const;

for (const input of REFUSED)
  test(`"${input}" is no address of a public channel, and it is refused`, () => {
    expect(() => parseTelegramAddress(input)).toThrow(ToolRefusal);
  });
