import { beforeEach, expect, test } from 'vitest';

import { ReadServiceDown } from './http';
import { forgetReadMode, readFrom, readMode } from './read-mode';

beforeEach(() => {
  forgetReadMode();
});

const down = (): Promise<string> => Promise.reject(new ReadServiceDown('down'));

test('a service that answers is the mode, and the release is not read', async () => {
  expect(
    await readFrom(
      () => Promise.resolve('service'),
      () => Promise.resolve('release'),
    ),
  ).toBe('service');
  expect(readMode()).toBe('service');
});

test('a service that is down gives the release, and the mode stays until a retry', async () => {
  expect(await readFrom(down, () => Promise.resolve('release'))).toBe('release');
  expect(readMode()).toBe('release');
  expect(
    await readFrom(
      () => Promise.resolve('service'),
      () => Promise.resolve('release'),
    ),
  ).toBe('release');
  forgetReadMode();
  expect(
    await readFrom(
      () => Promise.resolve('service'),
      () => Promise.resolve('release'),
    ),
  ).toBe('service');
});

test('another fault passes through, and the release is not read', async () => {
  await expect(
    readFrom(
      () => Promise.reject(new Error('refused')),
      () => Promise.resolve('release'),
    ),
  ).rejects.toThrow('refused');
  expect(readMode()).toBeNull();
});

test('a release that cannot be read leaves the mode unset', async () => {
  await expect(readFrom(down, () => Promise.reject(new Error('no files')))).rejects.toThrow(
    'no files',
  );
  expect(readMode()).toBeNull();
});
