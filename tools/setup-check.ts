// The read-only check of the operator setup of the tenfold wave. The operator connects once and then
// does nothing, so a silent missing item would look like a dead wave. It names each missing item of
// the person steps of the method, and it changes nothing. It prints no value of a setting: it can
// read a secret, and each line of its output is only a name and a status.

import { exec, execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, env, platform } from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { z } from 'zod';

const WAIT_MS = 30_000;

const LOGON = String.raw`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`;
const UPDATE_POLICY = String.raw`HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU`;
const RUN = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`;
const RUN_APPROVED = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run`;
const DOCKER_ENTRY = 'Docker Desktop';

// A draft can quote the words of the signature, so a quoted status or any draft status is not signed.
const SIGNED = /(?<!["'`])\bStatus: SIGNED\b(?![-/])/u;
const DRAFT = /\bStatus: DRAFT\b/u;
const NO_SETTING = 'no such setting';

const bothZero = (value: string | null) => value === '0 0';
const isSet = (value: string | null) => value !== null;

const freeKey = (name: string, need: string) => ({
  name,
  item: 6,
  source: { env: name },
  on: isSet,
  need,
});

type Source =
  | { env: string }
  | { reg: readonly [string, string] }
  | { power: readonly [string, string] }
  | { named: 'docker_logon' | 'docker_updates' | 'claude_signin' | 'openrouter_ceiling' }
  | { signedList: true };

interface Setting {
  name: string;
  item: number;
  source: Source;
  on: (value: string | null) => boolean;
  need: string;
  /** The status when the setting is off and this is not a fault. */
  notAFault?: 'waiting_signature' | 'not_set';
}

export const SETTINGS: readonly Setting[] = [
  {
    name: 'claude_signin',
    item: 1,
    source: { named: 'claude_signin' },
    on: (value) => value === 'true',
    need: 'Sign in to the Claude CLI, or create a long-life token.',
  },
  {
    name: 'auto_logon',
    item: 2,
    source: { reg: [LOGON, 'AutoAdminLogon'] },
    on: (value) => value === '1',
    need: 'Set automatic logon.',
  },
  {
    name: 'no_sleep',
    item: 2,
    source: { power: ['SUB_SLEEP', 'STANDBYIDLE'] },
    on: bothZero,
    need: 'Set sleep to never, on mains and on battery.',
  },
  {
    name: 'no_hibernate',
    item: 2,
    source: { power: ['SUB_SLEEP', 'HIBERNATEIDLE'] },
    on: bothZero,
    need: 'Set hibernate to never, on mains and on battery.',
  },
  {
    name: 'lid_action_none',
    item: 2,
    source: { power: ['SUB_BUTTONS', 'LIDACTION'] },
    // External constraint: a PC with no lid does not show this setting.
    on: (value) => value === NO_SETTING || bothZero(value),
    need: 'Set the lid action to "do nothing", on mains and on battery.',
  },
  {
    name: 'no_forced_restart',
    item: 2,
    source: { reg: [UPDATE_POLICY, 'NoAutoRebootWithLoggedOnUsers'] },
    on: (value) => value === '0x1',
    need: 'Set the update policy "no automatic restart with a user signed in".',
  },
  {
    name: 'docker_at_logon',
    item: 3,
    source: { named: 'docker_logon' },
    on: (value) => value === 'on',
    need: 'Start Docker Desktop at logon.',
  },
  {
    name: 'docker_updates_off',
    item: 3,
    source: { named: 'docker_updates' },
    // External constraint: with no saved value, Docker Desktop uses a default that can change.
    on: (value) => value === 'false',
    need: 'Turn off automatic updates in the settings of Docker Desktop, and save them.',
  },
  {
    name: 'openrouter_ceiling',
    item: 4,
    source: { named: 'openrouter_ceiling' },
    on: (value) => Number(value) > 0,
    need: 'Create the OpenRouter key, and set a credit limit on it.',
  },
  {
    name: 'signed_list',
    item: 5,
    source: { signedList: true },
    on: (value) => value !== null && SIGNED.test(value) && !DRAFT.test(value),
    need: 'On the notification, sign the list: write "Status: SIGNED" in its status line.',
    notAFault: 'waiting_signature',
  },
  freeKey('CLEARSPENDING_API_KEY', 'Create the key, with a researcher request.'),
  freeKey('BARENTSWATCH_CLIENT_ID', 'Create the client.'),
  freeKey('BARENTSWATCH_CLIENT_SECRET', 'Create the client.'),
  freeKey('COURTLISTENER_API_TOKEN', 'Create the token.'),
  freeKey('EARTHDATA_TOKEN', 'Create the token.'),
  freeKey('GFW_API_TOKEN', 'Create the token.'),
  {
    // Not a setup item of the method: section 11 of the method lists it as an event.
    name: 'BRIGHTDATA_API_KEY',
    item: 6,
    source: { env: 'BRIGHTDATA_API_KEY' },
    on: isSet,
    need: 'Only a ticket on the proxy fallback waits for this key.',
    notAFault: 'not_set',
  },
];

export const PERSON_ONLY = [
  { name: 'open_wave_start', item: 0, need: 'Open the session wave-start with its prompt.' },
  { name: 'funder_approval', item: 4, need: 'Get the written approval of the funder.' },
  { name: 'optional_mails', item: 7, need: 'Optional: send one e-mail each to GEM and to IACS.' },
  {
    name: 'sample_decision',
    item: 8,
    need: 'Decide: read 30 random facts, or the report says so.',
  },
] as const;

/** The two last hex values of a query of powercfg are the index on mains and on battery, in each language. */
export const powerIndexes = (output: string): string | null => {
  const found = output.match(/0x[0-9a-f]{8}/giu);
  return found === null || found.length < 2
    ? null
    : found
        .slice(-2)
        .map((hex) => Number(hex))
        .join(' ');
};

export const loggedIn = (output: string): string | null =>
  z.object({ loggedIn: z.boolean() }).safeParse(JSON.parse(output)).data?.loggedIn.toString() ??
  null;

const regValue = async (key: string, value: string): Promise<string | null> => {
  const { stdout } = await promisify(execFile)('reg', ['query', key, '/v', value], {
    timeout: WAIT_MS,
    windowsHide: true,
  }).catch(() => ({ stdout: '' }));
  return /\sREG_\w+\s+(.*\S)/u.exec(stdout)?.[1] ?? null;
};

const dockerLogon = async (): Promise<string | null> => {
  // External constraint: Task Manager turns off a Run entry with an odd first byte, and leaves it.
  const approved = await regValue(RUN_APPROVED, DOCKER_ENTRY);
  const turnedOff = approved !== null && Number.parseInt(approved.slice(0, 2), 16) % 2 === 1;
  return (await regValue(RUN, DOCKER_ENTRY)) !== null && !turnedOff ? 'on' : null;
};

const dockerUpdates = async (): Promise<string | null> => {
  const file = join(env['APPDATA'] ?? '', 'Docker', 'settings-store.json');
  const saved = z
    .object({ AutoDownloadUpdates: z.boolean().optional() })
    .parse(JSON.parse(await readFile(file, 'utf8'))).AutoDownloadUpdates;
  return saved === undefined ? null : saved.toString();
};

const openrouterLimit = async (): Promise<string | null> => {
  const key = env['OPENROUTER_API_KEY']?.trim() ?? '';
  if (key === '') return null;
  const answer = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(WAIT_MS),
  });
  const { data } = z
    .object({ data: z.object({ limit: z.number().nullable() }) })
    .parse(await answer.json());
  return data.limit === null ? null : data.limit.toString();
};

const NAMED = {
  docker_logon: dockerLogon,
  docker_updates: dockerUpdates,
  claude_signin: async () => {
    const { stdout } = await promisify(exec)('claude auth status', {
      timeout: WAIT_MS,
      windowsHide: true,
    });
    return loggedIn(stdout);
  },
  openrouter_ceiling: openrouterLimit,
};

/** The one function that reads a live setting. It only reads. A test gives a fake in its place. */
export const readSetting = async (setting: Setting, signedList: string): Promise<string | null> => {
  const { source } = setting;
  if ('env' in source) {
    const value = env[source.env]?.trim() ?? '';
    return value === '' ? null : value;
  }
  if ('reg' in source) return regValue(...source.reg);
  if ('named' in source) return NAMED[source.named]();
  if ('signedList' in source) return readFile(signedList, 'utf8');
  const [group, name] = source.power;
  const { stdout } = await promisify(execFile)(
    'powercfg',
    ['/query', 'SCHEME_CURRENT', group, name],
    { timeout: WAIT_MS, windowsHide: true },
  );
  return powerIndexes(stdout) ?? NO_SETTING;
};

interface Row {
  item: number;
  name: string;
  status: string;
  need?: string;
}

/** A setting that cannot be read counts as off: the operator must see it. */
export const checkSetup = async (read: (setting: Setting) => Promise<string | null>) => {
  const rows = await Promise.all(
    SETTINGS.map(async (setting): Promise<Row> => {
      const value = await read(setting).catch(() => null);
      const row = { item: setting.item, name: setting.name };
      return setting.on(value)
        ? { ...row, status: 'ok' }
        : { ...row, status: setting.notAFault ?? 'missing', need: setting.need };
    }),
  );
  const items = [
    ...rows,
    ...PERSON_ONLY.map(({ item, name, need }) => ({ item, name, status: 'a person only', need })),
  ].sort((a, b) => a.item - b.item);
  return { missing: items.filter((row) => row.status === 'missing').map((row) => row.name), items };
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  const [signedList] = argv.slice(2);
  if (signedList === undefined || platform !== 'win32')
    throw new Error('usage, on Windows: setup-check <signed list file>');
  const report = await checkSetup((setting) => readSetting(setting, signedList));
  console.log(JSON.stringify(report, null, 2));
  if (report.missing.length > 0) process.exitCode = 1;
}
