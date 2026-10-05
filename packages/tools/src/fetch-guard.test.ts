import { describe, expect, test } from 'vitest';

import { refusedAddress } from './fetch-guard.ts';

describe('refusedAddress', () => {
  test.each([
    '127.0.0.1',
    '127.8.9.10',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a00:1',
    '64:ff9b::7f00:1',
  ])('refuses %s, an address of the machine or of a private network', (address) => {
    expect(refusedAddress(address)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001::64'])(
    'admits %s, a public address',
    (address) => {
      expect(refusedAddress(address)).toBe(false);
    },
  );

  test('refuses a string that is no address, because nothing can be checked in it', () => {
    expect(refusedAddress('example.org')).toBe(true);
    expect(refusedAddress('')).toBe(true);
  });
});
