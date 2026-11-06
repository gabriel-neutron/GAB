// The setup check with a fake in place of the function that reads a setting. No test reads or changes
// a live setting of the PC.

import { describe, expect, test } from 'vitest';

import { checkSetup, loggedIn, PERSON_ONLY, powerIndexes, SETTINGS } from './setup-check.ts';

const SECRET = 'a-secret-value';

const GOOD: Readonly<Record<string, string>> = {
  claude_signin: 'true',
  auto_logon: '1',
  no_sleep: '0 0',
  no_hibernate: '0 0',
  lid_action_none: '0 0',
  no_forced_restart: '0x1',
  docker_at_logon: 'on',
  docker_updates_off: 'false',
  openrouter_ceiling: '50',
  signed_list: 'Date: 2026-11-20. Status: SIGNED by the operator.',
};

// Each value is one that the PC can really hold when the setting is off.
const OFF: Readonly<Record<string, string | null>> = {
  claude_signin: 'false',
  auto_logon: '0',
  no_sleep: '900 0',
  no_hibernate: '0 900',
  lid_action_none: '1 0',
  no_forced_restart: '0x0',
  docker_at_logon: null,
  docker_updates_off: 'true',
  openrouter_ceiling: null,
  signed_list: 'Date: 2026-11-06. Status: DRAFT for the signature of the operator.',
};

const fake =
  (off?: string) =>
  ({ name }: { name: string }): Promise<string | null> =>
    Promise.resolve(name === off ? (OFF[name] ?? null) : (GOOD[name] ?? SECRET));

const allOn = () => checkSetup(fake());

describe('the setup check', () => {
  test('with each setting on, it names no item', async () => {
    const { missing, items } = await allOn();
    expect(missing).toEqual([]);
    expect(items.filter((row) => row.status !== 'a person only').map((row) => row.status)).toEqual(
      SETTINGS.map(() => 'ok'),
    );
  });

  test('each item of the method has a check or the words "a person only"', async () => {
    const { items } = await allOn();
    expect([...new Set(items.map((row) => row.item))]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(items.filter((row) => row.status === 'a person only').map((row) => row.name)).toEqual(
      PERSON_ONLY.map((row) => row.name),
    );
  });

  test.each(SETTINGS.filter((setting) => setting.notAFault === undefined).map((s) => s.name))(
    'a fake "off" value of %s names that item and no other',
    async (name) => {
      const { missing, items } = await checkSetup(fake(name));
      expect(missing).toEqual([name]);
      expect(items.find((row) => row.name === name)?.status).toBe('missing');
    },
  );

  test('an unsigned list reports waiting_signature, and it is not a fault', async () => {
    const { missing, items } = await checkSetup(fake('signed_list'));
    expect(missing).toEqual([]);
    expect(items.find((row) => row.item === 5)?.status).toBe('waiting_signature');
  });

  test('a list file that is absent also reports waiting_signature', async () => {
    const { missing, items } = await checkSetup(({ name }) =>
      name === 'signed_list' ? Promise.reject(new Error('no file')) : fake()({ name }),
    );
    expect(missing).toEqual([]);
    expect(items.find((row) => row.item === 5)?.status).toBe('waiting_signature');
  });

  test('a missing proxy key is reported, and it is not a fault', async () => {
    const { missing, items } = await checkSetup(fake('BRIGHTDATA_API_KEY'));
    expect(missing).toEqual([]);
    expect(items.find((row) => row.name === 'BRIGHTDATA_API_KEY')?.status).toBe('not_set');
  });

  test('a setting that cannot be read counts as off', async () => {
    const { missing } = await checkSetup(({ name }) =>
      name === 'auto_logon' ? Promise.reject(new Error('no answer')) : fake()({ name }),
    );
    expect(missing).toEqual(['auto_logon']);
  });

  test('a PC with no lid does not fault on the lid action', async () => {
    const { missing } = await checkSetup(({ name }) =>
      Promise.resolve(name === 'lid_action_none' ? 'no such setting' : (GOOD[name] ?? SECRET)),
    );
    expect(missing).toEqual([]);
  });

  test('a failed read of the lid action counts as off', async () => {
    const { missing } = await checkSetup(({ name }) =>
      name === 'lid_action_none' ? Promise.reject(new Error('no answer')) : fake()({ name }),
    );
    expect(missing).toEqual(['lid_action_none']);
  });

  test('a power setting that the PC does not show counts as off', async () => {
    const { missing } = await checkSetup(({ name }) =>
      Promise.resolve(name === 'no_sleep' ? 'no such setting' : (GOOD[name] ?? SECRET)),
    );
    expect(missing).toEqual(['no_sleep']);
  });

  test('a draft that quotes the words of the signature is not signed', async () => {
    const { items } = await checkSetup(({ name }) =>
      name === 'signed_list'
        ? Promise.resolve('Status: DRAFT.\nTo sign, write "Status: SIGNED" in the status line.')
        : fake()({ name }),
    );
    expect(items.find((row) => row.item === 5)?.status).toBe('waiting_signature');
  });

  test('the report holds no value of a setting', async () => {
    expect(JSON.stringify(await allOn())).not.toContain(SECRET);
    expect(JSON.stringify(await checkSetup(fake('GFW_API_TOKEN')))).not.toContain(SECRET);
  });
});

describe('the reading of a live answer', () => {
  test('powercfg gives the index on mains and on battery, in each language', () => {
    const french = `GUID du mode de gestion de l'alimentation : 381b4222
    Paramètre minimal possible : 0x00000000
    Paramètre maximal possible : 0xffffffff
    Index actuel du paramètre de courant alternatif : 0x00000384
    Index actuel du paramètre de courant continu : 0x00000000`;
    const english = `Current AC Power Setting Index: 0x00000000
    Current DC Power Setting Index: 0x00000001`;
    expect(powerIndexes(french)).toBe('900 0');
    expect(powerIndexes(english)).toBe('0 1');
  });

  test('powercfg with no such setting gives no value', () => {
    expect(powerIndexes('GUID du mode : 381b4222\n  Alias de GUID : SCHEME_BALANCED')).toBeNull();
  });

  test('the sign-in comes from the field of the CLI', () => {
    expect(loggedIn('{"loggedIn":true,"authMethod":"claude.ai"}')).toBe('true');
    expect(loggedIn('{"loggedIn":false}')).toBe('false');
    expect(loggedIn('{"other":1}')).toBeNull();
  });
});
