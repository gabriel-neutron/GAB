// The tunnel of the record to the VPS, run on the PC in the main checkout. Read only, and it changes
// no row of the record. Run book: infra/vps/README.md, "The record through the tunnel".
//
// pnpm record-tunnel:open    start the database if it is down, give gabriel_audit a new password with
//                            an end time, check the role, open the tunnel, write the file of the VPS,
//                            and check the tunnel from the VPS
// pnpm record-tunnel:close   take LOGIN from gabriel_audit, end its sessions, delete the file of the
//                            VPS, and stop the tunnel. Each step runs also when another step fails.
//
// The verdict of the panel of 2026-11-26 (software-architect, skeptic): only the database goes through
// the tunnel, bound to the loopback address of the VPS; the role reads the two views of the schema
// audit (migration 0099); the one secret of the VPS stops when the tunnel stops.

import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { argv, env, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { z } from 'zod';

import { connectionString } from './db-runtime.ts';
import { AUDIT_ROLE, tunnelEnvText } from './record-tunnel-env.ts';

const ROOT = join(import.meta.dirname, '..');
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
// The state stays outside the checkout: it names the VPS.
const STATE = join(homedir(), '.gab-record-tunnel.json');
/** The secret file on the VPS, outside the checkout, beside the file of SearXNG. */
export const VPS_FILE = '~/gab-services/record-tunnel.env';

const absentWhenEmpty = (value: unknown): unknown => (value === '' ? undefined : value);
const settings = z.object({
  GAB_TUNNEL_SSH: z
    .string()
    .regex(/^[a-z_][a-z0-9_-]*@[A-Za-z0-9.-]+$/u, 'GAB_TUNNEL_SSH is <user>@<host> of the VPS'),
  GAB_TUNNEL_KEY: z.preprocess(absentWhenEmpty, z.string().optional()),
  GAB_TUNNEL_PORT: z.preprocess(
    absentWhenEmpty,
    z.coerce.number().int().min(1024).max(65_535).default(15_432),
  ),
  GAB_TUNNEL_HOURS: z.preprocess(
    absentWhenEmpty,
    z.coerce.number().int().min(1).max(24).default(8),
  ),
  GABRIEL_DB_PORT: z.preprocess(absentWhenEmpty, z.coerce.number().int().default(5432)),
});
export type Settings = z.infer<typeof settings>;

export const settingsOf = (environment: NodeJS.ProcessEnv): Settings => {
  const held = settings.safeParse(environment);
  if (!held.success)
    throw new Error(
      `Set the tunnel in infra/.env: ${held.error.issues.map((one) => one.message).join('; ')}.`,
    );
  return held.data;
};

const sshBase = (set: Settings): string[] => [
  '-o',
  'BatchMode=yes',
  '-o',
  'ConnectTimeout=15',
  ...(set.GAB_TUNNEL_KEY === undefined
    ? []
    : ['-i', set.GAB_TUNNEL_KEY, '-o', 'IdentitiesOnly=yes']),
];

/** The arguments of the tunnel: the VPS binds its loopback address only, and the tunnel stops when
 * the forward fails or the link is dead for 90 seconds. */
export const tunnelArgs = (set: Settings): string[] => [
  ...sshBase(set),
  '-N',
  '-o',
  'ExitOnForwardFailure=yes',
  '-o',
  'ServerAliveInterval=30',
  '-o',
  'ServerAliveCountMax=3',
  '-R',
  `127.0.0.1:${set.GAB_TUNNEL_PORT}:127.0.0.1:${set.GABRIEL_DB_PORT}`,
  set.GAB_TUNNEL_SSH,
];

/** The check of the VPS: each listener on the port is on the loopback address, and one exists. */
export const onlyLoopback = (listeners: string, port: number): boolean => {
  const local = listeners
    .split('\n')
    .map((line) => line.trim().split(/\s+/u)[3] ?? '')
    .filter((address) => address.endsWith(`:${port}`));
  return local.length > 0 && local.every((address) => /^(127\.0\.0\.1|\[::1\]):/u.test(address));
};

const onVps = (set: Settings, command: string, input?: string): string =>
  execFileSync('ssh', [...sshBase(set), set.GAB_TUNNEL_SSH, command], {
    encoding: 'utf8',
    ...(input === undefined ? {} : { input }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const asSuperuser = async <T>(work: (client: Client) => Promise<T>): Promise<T> => {
  const client = new Client({ connectionString: connectionString('superuser', 'gabriel') });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
};

const refuseSessionStack = (): void => {
  const project = env['COMPOSE_PROJECT_NAME'];
  if (project !== undefined && project !== 'gab')
    throw new Error('Run the tunnel in the main checkout: this checkout runs a session stack.');
};

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** The checks of the role, as the role, on the PC: it reads the views, and it reads no table of the
 * record and creates nothing. */
const checkRole = async (password: string, port: number): Promise<number> => {
  const client = new Client({
    connectionString: `postgresql://${AUDIT_ROLE}:${password}@127.0.0.1:${port}/gabriel`,
  });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM audit.document',
    );
    for (const refused of ['SELECT 1 FROM public.documents LIMIT 1', 'CREATE TABLE audit.probe ()'])
      try {
        await client.query(refused);
        throw new Error(`gabriel_audit ran "${refused}". Close the tunnel and check the grants.`);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error)) throw error;
      }
    return rows[0]?.n ?? 0;
  } finally {
    await client.end();
  }
};

const open = async (set: Settings): Promise<void> => {
  refuseSessionStack();
  if (existsSync(STATE)) await close(set);
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait', 'db'], {
    stdio: 'inherit',
  });
  const password = randomBytes(24).toString('hex');
  const until = new Date(Date.now() + set.GAB_TUNNEL_HOURS * 3_600_000).toISOString();
  await asSuperuser(async (client) => {
    const role = await client.query('SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1', [
      AUDIT_ROLE,
    ]);
    if (role.rowCount !== 1)
      throw new Error(`${AUDIT_ROLE} is absent. Run pnpm db:migrate and pnpm db:apply.`);
    // ALTER ROLE takes no bind parameter, so the values are escaped into the statement text.
    await client.query(
      `ALTER ROLE ${AUDIT_ROLE} LOGIN PASSWORD ${client.escapeLiteral(password)} ` +
        `VALID UNTIL ${client.escapeLiteral(until)}`,
    );
  });
  console.log(`role    ${AUDIT_ROLE} may log in until ${until}`);
  console.log(
    `check   ${AUDIT_ROLE} reads ${await checkRole(password, set.GABRIEL_DB_PORT)} export documents, and no table of the record`,
  );

  const tunnel = spawn('ssh', tunnelArgs(set), {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  tunnel.unref();
  const pid = tunnel.pid;
  writeFileSync(STATE, `${JSON.stringify({ pid, port: set.GAB_TUNNEL_PORT, until })}\n`);
  await new Promise((done) => setTimeout(done, 5_000));
  if (pid === undefined || !alive(pid))
    throw new Error('The tunnel stopped at once. Check the key and the port on the VPS.');
  console.log(`tunnel  127.0.0.1:${set.GAB_TUNNEL_PORT} on the VPS (ssh process ${pid})`);

  onVps(
    set,
    `umask 077 && mkdir -p ~/gab-services && cat > ${VPS_FILE} && chmod 600 ${VPS_FILE}`,
    tunnelEnvText(password, set.GAB_TUNNEL_PORT),
  );
  console.log(`file    ${VPS_FILE} on the VPS, mode 600`);
  const listeners = onVps(set, `ss -ltnH 'sport = :${set.GAB_TUNNEL_PORT}'`);
  if (!onlyLoopback(listeners, set.GAB_TUNNEL_PORT))
    throw new Error(
      `The VPS does not listen on 127.0.0.1:${set.GAB_TUNNEL_PORT} only. Close the tunnel.`,
    );
  onVps(set, `timeout 5 bash -c '</dev/tcp/127.0.0.1/${set.GAB_TUNNEL_PORT}'`);
  console.log('check   the VPS reaches the tunnel on its loopback address only');
};

// Each step runs when another step fails, so a half-open tunnel always closes.
const close = async (set: Settings | null): Promise<void> => {
  const failed: string[] = [];
  const step = async (name: string, work: () => Promise<void> | void): Promise<void> => {
    try {
      await work();
      console.log(`closed  ${name}`);
    } catch (error) {
      failed.push(name);
      console.error(`FAILED  ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  await step(`the login of ${AUDIT_ROLE}`, () =>
    asSuperuser(async (client) => {
      await client.query(`ALTER ROLE ${AUDIT_ROLE} NOLOGIN PASSWORD NULL VALID UNTIL '-infinity'`);
      await client.query(
        'SELECT pg_catalog.pg_terminate_backend(pid) FROM pg_catalog.pg_stat_activity WHERE usename = $1',
        [AUDIT_ROLE],
      );
    }),
  );
  if (set !== null)
    await step(`the file ${VPS_FILE} on the VPS`, () => {
      onVps(set, `rm -f ${VPS_FILE}`);
    });
  await step('the ssh process of the tunnel', () => {
    if (!existsSync(STATE)) return;
    const { pid } = z
      .object({ pid: z.number().int().optional() })
      .parse(JSON.parse(readFileSync(STATE, 'utf8')));
    if (pid !== undefined && alive(pid)) process.kill(pid);
    rmSync(STATE);
  });
  if (failed.length > 0)
    throw new Error('One step of the close failed. Read the lines above, and run it again.');
};

const main = async (): Promise<void> => {
  const command = argv[2];
  if (command === 'open') {
    const set = settingsOf(env);
    try {
      await open(set);
    } catch (error) {
      // A failed open leaves no login and no tunnel behind.
      await close(set).catch(() => undefined);
      throw error;
    }
  } else if (command === 'close') {
    // A close with no settings still takes the login and stops the process.
    let set: Settings | null = null;
    try {
      set = settingsOf(env);
    } catch {
      console.error(
        'No GAB_TUNNEL_SSH: the file on the VPS is not deleted, and it stops working now.',
      );
    }
    await close(set);
  } else throw new Error('Run record-tunnel.ts open or record-tunnel.ts close.');
};

if (argv[1] === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    exit(1);
  });
