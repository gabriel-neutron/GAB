// The supervisor tick in a temporary state folder, with a fake worker in place of the CLI. No test
// reaches the record, a live setting or the real state folder. Windows only: the tick is PowerShell.

import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, describe, expect, test } from 'vitest';

const LONG = 180_000;
// A fixed clock before the freeze, so a later date does not change a state move.
const CLOCK = '2026-11-10T12:00:00';
const after = (minutes: number) => new Date(Date.parse(CLOCK) + minutes * 60_000).toISOString();
const TICK = join(import.meta.dirname, 'supervisor-tick.ps1');
const root = mkdtempSync(join(tmpdir(), 'supervisor-tick-'));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// The fake worker: the prompt gives the plan of the ticket and the number of the run. A plan step
// names what the worker prints, as the CLI prints it.
const FAKE = join(root, 'fake-worker.cjs');
writeFileSync(
  FAKE,
  `const input = require('fs').readFileSync(0, 'utf8');
const plan = /PLAN:(\\S*)/.exec(input)[1].split(',');
const run = Number(/Run: (\\d+)/.exec(input)?.[1] ?? 1);
const step = plan[Math.min(run, plan.length) - 1];
const [word, extra] = step.split(':');
const good = (verdict) => console.log(JSON.stringify({ type: 'system', note: 'noise' }) + '\\n' + JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Done.\\n' + JSON.stringify(verdict) }));
const main = async () => {
  if (word === 'sleep') { await new Promise((r) => setTimeout(r, Number(extra))); return good({ result: 'pass' }); }
  if (word === 'pass' || word === 'close' || word === 'failed' || word === 'exhausted' || word === 'stop_source') return good({ result: word, newFacts: Number(extra ?? 1), reason: step });
  if (word === 'reopen') return good({ result: 'reopen', gaps: [extra], reason: step });
  if (word === 'hold') return good({ result: 'hold', hold: extra, reason: step });
  if (word === 'bad') return console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'An inner tool error.' }));
  if (word === 'signin') { console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'OAuth session expired' })); process.exit(1); }
  if (word === 'limit') { console.log(JSON.stringify({ type: 'result', is_error: true, result: 'Usage limit reached' })); process.exit(1); }
  if (word === 'exit') { console.log('{"type":"result","is_error":false,"result":"{\\\\"result\\\\":\\\\"pass\\\\"}"}'); process.exit(3); }
  if (word === 'noverdict') return console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Done.' }));
  if (word === 'baduntil') return good({ result: 'hold', hold: 'waiting_quota', until: 'soon' });
  if (word === 'farhold') return good({ result: 'hold', hold: 'waiting_quota', until: '2099-01-01' });
  if (word === 'badfacts') return good({ result: 'pass', newFacts: 'many' });
  if (word === 'prose') { console.log(JSON.stringify({ type: 'result', is_error: true, result: 'The rate limit of OAuth is the topic. '.repeat(20) })); return; }
  if (word === 'lines') return good({ result: 'stop_source', reason: 'one\\n- injected' });
  if (word === 'noresult') return console.log('plain text');
  if (word === 'rogue') {
    await new Promise((r) => setTimeout(r, 2000));
    let refused = 0;
    for (const f of process.env.ROGUE_TARGETS.split(';')) { try { require('fs').writeFileSync(f, '{}'); } catch { refused++; } }
    return good({ result: 'pass', reason: 'refused ' + refused });
  }
  throw new Error('no step ' + step);
};
main();
`,
);

interface Ticket {
  id: string;
  state: string;
  attempts: number;
  noPass: number;
  gaps: string[];
  worker: unknown;
  reason: string;
  until: string | null;
}
interface Status {
  running: number;
  alarms: string[];
  tickets: { id: string; state: string }[];
}
type Settings = Record<string, unknown>;

let serial = 0;

const folder = (settings: Settings = {}) => {
  const dir = join(root, `state-${String(++serial)}`);
  mkdirSync(join(dir, 'tickets'), { recursive: true });
  writeFileSync(
    join(dir, 'supervisor.json'),
    JSON.stringify({
      cap: 1,
      command: 'node',
      args: [FAKE],
      workDir: root,
      notifyFile: join(dir, 'notified.txt'),
      ...settings,
    }),
  );
  return dir;
};

const seed = (dir: string, id: string, plan: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(
    join(dir, 'tickets', `${id}.json`),
    JSON.stringify({ id, state: 'ready', prompt: `PLAN:${plan}`, ...fields }),
  );
};

const tickArguments = (dir: string, now = CLOCK) => [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  TICK,
  '-StateDir',
  dir,
  '-Now',
  now,
];

const ticket = (dir: string, id: string) =>
  JSON.parse(readFileSync(join(dir, 'tickets', `${id}.json`), 'utf8')) as Ticket;

const status = (dir: string) =>
  JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8')) as Status;

const workerFiles = (dir: string, end: string) =>
  existsSync(join(dir, 'workers'))
    ? readdirSync(join(dir, 'workers')).filter((f) => f.endsWith(end))
    : [];

// One tick must end by itself, inside the time limit of its scheduled task. Then this waits for
// each worker that the tick started, so the next tick sees an ended worker.
const tick = async (dir: string, now?: string) => {
  execFileSync('powershell.exe', tickArguments(dir, now), { timeout: 60_000 });
  const started = workerFiles(dir, '.spec.json').length;
  while (workerFiles(dir, '.exit').length < started)
    await new Promise((resolve) => setTimeout(resolve, 50));
};

const ticks = async (dir: string, count: number, now?: string) => {
  for (let i = 0; i < count; i++) await tick(dir, now);
};

const ask = (dir: string, name: string, body: unknown) => {
  mkdirSync(join(dir, 'inbox'), { recursive: true });
  writeFileSync(join(dir, 'inbox', `${name}.json`), JSON.stringify(body));
};

const statesOf = async (dir: string, id: string, count: number, now?: string) => {
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    await tick(dir, now);
    seen.push(ticket(dir, id).state);
  }
  return seen;
};

describe.skipIf(process.platform !== 'win32')('the supervisor tick', () => {
  test(
    '20 ticks walk the life cycle with one worker at a time, and each state move is right',
    async () => {
      const dir = folder();
      seed(dir, 'T-A', 'pass:2,pass:2,pass,reopen:gap1,pass:1,pass,close', {
        pilot: true,
        forecast: 5,
      });
      seed(dir, 'T-B', 'pass,pass,close', { dependsOn: ['T-A'] });
      const a: string[] = [];
      const b: string[] = [];
      for (let i = 0; i < 20; i++) {
        await tick(dir);
        a.push(ticket(dir, 'T-A').state);
        b.push(ticket(dir, 'T-B').state);
        expect(status(dir).running).toBeLessThanOrEqual(1);
      }
      expect(a).toEqual([
        'pilot',
        'working',
        'reviewing',
        'closing',
        'reopened',
        'working',
        'reviewing',
        'closing',
        ...Array<string>(12).fill('closed'),
      ]);
      expect(b).toEqual([
        ...Array<string>(9).fill('ready'),
        'working',
        'reviewing',
        'closing',
        'closed',
        ...Array<string>(7).fill('closed'),
      ]);
      expect(ticket(dir, 'T-A').gaps).toEqual(['gap1']);
      expect(ticket(dir, 'T-A').attempts).toBe(1);
      expect(readdirSync(join(dir, 'history'))).toHaveLength(13);
    },
    LONG,
  );

  test(
    'a second tick during a first tick exits at the lock and changes nothing',
    async () => {
      const dir = folder();
      seed(dir, 'T-L', 'pass');
      const first = promisify(execFile)('powershell.exe', tickArguments(dir), {
        env: { ...process.env, GAB_TICK_TEST_HOLD_MS: '8000' },
      });
      while (!existsSync(join(dir, 'tick.lock')))
        await new Promise((resolve) => setTimeout(resolve, 50));
      const second = execFileSync('powershell.exe', tickArguments(dir), { timeout: 30_000 });
      expect(second.toString()).toContain('lock held');
      expect(existsSync(join(dir, 'status.json'))).toBe(false);
      expect((await first).stdout).not.toContain('lock held');
      expect(ticket(dir, 'T-L').state).toBe('working');
      expect(workerFiles(dir, '.spec.json')).toHaveLength(1);
    },
    LONG,
  );

  test(
    'a result with success at the top and an error inside counts as failed',
    async () => {
      const dir = folder();
      seed(dir, 'T-E', 'bad,pass');
      await ticks(dir, 2);
      const t = ticket(dir, 'T-E');
      expect(t.state).toBe('working');
      expect(t.attempts).toBe(1);
      expect(t.reason).toContain('is_error True');
      await tick(dir);
      expect(ticket(dir, 'T-E').state).toBe('reviewing');
    },
    LONG,
  );

  test.each([
    ['exit', 'an exit that is not 0, with a good result'],
    ['noverdict', 'no verdict line'],
    ['noresult', 'no result line'],
    ['failed', 'a failed verdict'],
    ['close', 'a verdict that only a closer can give'],
    ['pass:0', 'no new counted fact on a ticket with a forecast'],
    ['baduntil', 'a hold with a false date'],
    ['badfacts', 'a count that is not a number'],
    ['prose', 'an error with long text that names a sign-in or a limit'],
  ])(
    'the failure %s (%s) costs one attempt',
    async (step) => {
      const dir = folder();
      seed(dir, 'T-F', step, { forecast: 3 });
      await ticks(dir, 2);
      expect(ticket(dir, 'T-F').state).toBe('working');
      expect(ticket(dir, 'T-F').attempts).toBe(1);
    },
    LONG,
  );

  test(
    'a failed sign-in gives waiting_token, costs no attempt, holds all workers and fires the alarm',
    async () => {
      const dir = folder();
      seed(dir, 'T-S', 'signin,pass');
      seed(dir, 'T-Z', 'pass');
      await ticks(dir, 2);
      const t = ticket(dir, 'T-S');
      expect(t.state).toBe('waiting_token');
      expect(t.attempts).toBe(0);
      expect(status(dir).alarms.join()).toContain('T-S is in waiting_token');
      expect(readFileSync(join(dir, 'notified.txt'), 'utf8')).toContain('T-S');
      await ticks(dir, 2);
      expect(ticket(dir, 'T-S').state).toBe('waiting_token');
      expect(ticket(dir, 'T-Z').state).toBe('ready');
      expect(workerFiles(dir, '.spec.json')).toHaveLength(1);

      const later = after(31);
      await tick(dir, later);
      expect(ticket(dir, 'T-S').state).toBe('working');
      expect(ticket(dir, 'T-S').attempts).toBe(0);
      await tick(dir, later);
      expect(ticket(dir, 'T-S').state).toBe('reviewing');
      expect(status(dir).alarms).toEqual([]);
    },
    LONG,
  );

  test(
    'a far date of a hold has a limit, and a reason stays one queue line',
    async () => {
      const dir = folder();
      seed(dir, 'T-D', 'farhold');
      await ticks(dir, 2);
      expect(ticket(dir, 'T-D').until).toContain('2026-11-17');

      const lines = folder();
      seed(lines, 'T-M', 'stop_source,lines');
      await ticks(lines, 3);
      expect(ticket(lines, 'T-M').state).toBe('parked');
      const queue = readFileSync(join(lines, 'operator-queue.md'), 'utf8');
      expect(queue.trim().split('\n')).toHaveLength(1);
    },
    LONG,
  );

  test(
    'a hung worker ends at the time limit and costs one attempt, and a tick that fails fires the alarm',
    () => {
      const dir = folder();
      seed(dir, 'T-O', 'sleep:40000,failed');
      execFileSync('powershell.exe', tickArguments(dir));
      const pid = (ticket(dir, 'T-O').worker as { pid: number }).pid;
      execFileSync('powershell.exe', tickArguments(dir, after(13 * 60)));
      expect(ticket(dir, 'T-O').attempts).toBe(1);
      expect(ticket(dir, 'T-O').reason).toContain('over the limit');
      expect(() => process.kill(pid, 0)).toThrow();

      const broken = folder({ cap: 'x' });
      seed(broken, 'T-C', 'pass');
      expect(() =>
        execFileSync('powershell.exe', tickArguments(broken), { stdio: 'pipe' }),
      ).toThrow();
      expect(status(broken).alarms.join()).toContain('the tick failed');
      expect(readFileSync(join(broken, 'notified.txt'), 'utf8')).toContain('the tick failed');
    },
    LONG,
  );

  test(
    'a usage limit gives waiting_limit and costs no attempt',
    async () => {
      const dir = folder();
      seed(dir, 'T-U', 'limit');
      await ticks(dir, 2);
      expect(ticket(dir, 'T-U').state).toBe('waiting_limit');
      expect(ticket(dir, 'T-U').attempts).toBe(0);
    },
    LONG,
  );

  test.each(['waiting_quota', 'waiting_source', 'waiting_ceiling', 'waiting_signature'])(
    'the hold %s costs no attempt and has its way out',
    async (hold) => {
      const dir = folder();
      seed(dir, 'T-H', `hold:${hold},pass`);
      await ticks(dir, 2);
      expect(ticket(dir, 'T-H').state).toBe(hold);
      expect(ticket(dir, 'T-H').attempts).toBe(0);
      const later = after(25 * 60);
      if (hold === 'waiting_signature') {
        await tick(dir, later);
        expect(ticket(dir, 'T-H').state).toBe(hold);
        ask(dir, 'signed', { id: 'T-H', to: 'release', reason: 'signed' });
      }
      await tick(dir, later);
      expect(ticket(dir, 'T-H').state).toBe('working');
    },
    LONG,
  );

  test(
    'two attempts with no pass go to the panel, and a third failure parks the ticket',
    async () => {
      const dir = folder();
      seed(dir, 'T-P', 'failed,failed,pass,failed,failed');
      expect(await statesOf(dir, 'T-P', 6)).toEqual([
        'working',
        'working',
        'needs_panel',
        'working',
        'parked',
        'parked',
      ]);
    },
    LONG,
  );

  test(
    'a panel that does not agree parks the ticket and adds one queue line; an answer returns it',
    async () => {
      const dir = folder();
      seed(dir, 'T-Q', 'stop_source,failed,pass');
      await ticks(dir, 3);
      expect(ticket(dir, 'T-Q').state).toBe('parked');
      expect(readFileSync(join(dir, 'operator-queue.md'), 'utf8')).toContain('T-Q is parked');
      expect(status(dir).alarms.join()).toContain('T-Q is parked');

      ask(dir, 'answer', { id: 'T-Q', to: 'ready', reason: 'operator answer' });
      await tick(dir);
      expect(ticket(dir, 'T-Q').state).toBe('ready');
      expect(ticket(dir, 'T-Q').attempts).toBe(0);
    },
    LONG,
  );

  test(
    'a gap that returns twice goes to the panel, and the last attempt parks the ticket',
    async () => {
      const dir = folder();
      seed(dir, 'T-G', 'pass,pass,reopen:same,pass,pass,reopen:same,pass');
      await ticks(dir, 8);
      expect(ticket(dir, 'T-G').state).toBe('needs_panel');
      expect(ticket(dir, 'T-G').attempts).toBe(2);
      await tick(dir);
      expect(ticket(dir, 'T-G').state).toBe('reopened');
    },
    LONG,
  );

  test(
    'an exhausted verdict ends the ticket, and the freeze ends a parked ticket',
    async () => {
      const dir = folder();
      seed(dir, 'T-X', 'exhausted');
      seed(dir, 'T-Y', 'pass', { state: 'parked' });
      await ticks(dir, 2);
      expect(ticket(dir, 'T-X').state).toBe('closed_exhausted');
      expect(ticket(dir, 'T-Y').state).toBe('parked');
      await tick(dir, '2026-11-20T00:00:00');
      expect(ticket(dir, 'T-Y').state).toBe('closed_parked');
    },
    LONG,
  );

  test(
    'the inbox adds a ticket and reopens a closed one, and it refuses each other request',
    async () => {
      const dir = folder();
      seed(dir, 'T-R', 'pass', { state: 'closed' });
      ask(dir, 'a', { ticket: { id: 'T-N', state: 'ready', prompt: 'PLAN:pass' } });
      ask(dir, 'b', { id: 'T-R', to: 'working' });
      ask(dir, 'c', { ticket: { id: '../evil', state: 'ready', prompt: 'PLAN:pass' } });
      ask(dir, 'c2', {
        ticket: { id: 'T-O', state: 'ready', prompt: 'PLAN:pass', outcome: { kind: 'verdict' } },
      });
      ask(dir, 'd', { id: 'T-R', to: 'reopened', gaps: ['g'] });
      await tick(dir);
      expect(ticket(dir, 'T-N').state).toBe('ready');
      expect(ticket(dir, 'T-R').state).toBe('closed');
      await tick(dir);
      expect(ticket(dir, 'T-O').state).toBe('ready');
      expect(JSON.stringify(ticket(dir, 'T-O'))).not.toContain('verdict');
      await tick(dir);
      expect(ticket(dir, 'T-R').state).toBe('reopened');
      await tick(dir);
      expect(ticket(dir, 'T-N').state).toBe('working');
      expect(ticket(dir, 'T-R').gaps).toEqual(['g']);
      expect(readdirSync(join(dir, 'inbox')).sort()).toEqual(['b.json.refused', 'c.json.refused']);
      expect(readdirSync(dir).join() + readdirSync(root).join()).not.toContain('evil');
    },
    LONG,
  );

  test(
    'the cap holds each extra worker, a worker that runs stays through a tick, and a lost worker fails',
    async () => {
      const dir = folder({ cap: 2 });
      seed(dir, 'T-1', 'sleep:15000');
      seed(dir, 'T-2', 'sleep:15000');
      seed(dir, 'T-3', 'pass');
      execFileSync('powershell.exe', tickArguments(dir));
      execFileSync('powershell.exe', tickArguments(dir));
      execFileSync('powershell.exe', tickArguments(dir));
      expect(status(dir).running).toBe(2);
      expect(ticket(dir, 'T-1').worker).not.toBeNull();
      expect(ticket(dir, 'T-2').worker).not.toBeNull();
      expect(ticket(dir, 'T-3').state).toBe('ready');
      expect(ticket(dir, 'T-1').attempts).toBe(0);
      expect(workerFiles(dir, '.spec.json')).toHaveLength(2);

      const lost = folder();
      seed(lost, 'T-4', 'pass', {
        state: 'working',
        // A pid that lives, with another start time: the pid has a new owner.
        worker: { pid: process.pid, started: 1, base: join(lost, 'workers', 'gone') },
      });
      await ticks(lost, 1);
      expect(ticket(lost, 'T-4').attempts).toBe(1);
      expect(ticket(lost, 'T-4').reason).toContain('worker lost');
      await ticks(dir, 1);
    },
    LONG,
  );

  test(
    'only the tick writes state: a stray write of a worker fails, and a broken file fires the alarm',
    async () => {
      const dir = folder();
      seed(dir, 'T-W', 'rogue,pass');
      const files = [join(dir, 'tickets', 'T-W.json'), join(dir, 'status.json')];
      process.env['ROGUE_TARGETS'] = files.join(';');
      const hash = () =>
        files.map((f) => createHash('sha256').update(readFileSync(f)).digest('hex')).join();
      execFileSync('powershell.exe', tickArguments(dir), { timeout: 60_000 });
      const before = hash();
      while (workerFiles(dir, '.exit').length < 1)
        await new Promise((resolve) => setTimeout(resolve, 50));
      expect(hash()).toBe(before);
      delete process.env['ROGUE_TARGETS'];
      await tick(dir);
      expect(ticket(dir, 'T-W').reason).toBe('refused 2');
      expect(ticket(dir, 'T-W').state).toBe('reviewing');

      writeFileSync(join(dir, 'tickets', 'T-BAD.json'), 'not json');
      await tick(dir);
      expect(status(dir).alarms.join()).toContain('T-BAD');
    },
    LONG,
  );

  test(
    'an open queue line sends a notification and shows in the status file, a closed line does not',
    async () => {
      const dir = folder();
      writeFileSync(join(dir, 'operator-queue.md'), '- one question\n');
      await tick(dir);
      expect(status(dir).alarms).toEqual(['- one question']);
      expect(readFileSync(join(dir, 'notified.txt'), 'utf8')).toContain('one question');
      writeFileSync(join(dir, 'operator-queue.md'), '- [x] one question\n');
      rmSync(join(dir, 'notified.txt'));
      await tick(dir);
      expect(status(dir).alarms).toEqual([]);
      expect(existsSync(join(dir, 'notified.txt'))).toBe(false);
    },
    LONG,
  );

  const staleState = (dir: string, body: unknown, minutes: number) => {
    const file = join(dir, 'wave-start.json');
    writeFileSync(file, JSON.stringify(body));
    const when = new Date(Date.parse(CLOCK) - minutes * 60_000);
    utimesSync(file, when, when);
    return file;
  };
  const waveFolder = (extra: Settings = {}) => {
    const dir = folder();
    const settings = JSON.parse(readFileSync(join(dir, 'supervisor.json'), 'utf8')) as Settings;
    writeFileSync(
      join(dir, 'supervisor.json'),
      JSON.stringify({
        ...settings,
        waveStart: {
          stateFile: join(dir, 'wave-start.json'),
          liveMatch: 'no-process-has-this-text',
          prompt: 'PLAN:sleep:1 Resume wave-start.',
          ...extra,
        },
      }),
    );
    return dir;
  };

  test(
    'a stale wave-start starts one resume worker and no second one',
    async () => {
      const dir = waveFolder();
      staleState(dir, { closed: [] }, 31);
      await ticks(dir, 4);
      expect(workerFiles(dir, '.spec.json')).toHaveLength(1);
      expect(status(dir).alarms.join()).toContain('wave-start has no change');
      const [prompt] = workerFiles(dir, '.prompt');
      expect(readFileSync(join(dir, 'workers', String(prompt)), 'utf8')).toContain(
        'Resume wave-start.',
      );
    },
    LONG,
  );

  test(
    'a wave-start with a fresh file, a closed file or a live driver starts no worker',
    async () => {
      const fresh = waveFolder();
      staleState(fresh, { closed: [] }, 29);
      await ticks(fresh, 2);
      expect(workerFiles(fresh, '.spec.json')).toHaveLength(0);

      const closed = waveFolder();
      staleState(closed, { end: 'closed' }, 90);
      await ticks(closed, 2);
      expect(workerFiles(closed, '.spec.json')).toHaveLength(0);

      const marker = `live-driver-${String(process.pid)}`;
      const live = waveFolder({ liveMatch: marker });
      staleState(live, { closed: [] }, 90);
      const driver = spawn('node', ['-e', 'setTimeout(() => {}, 60000)', marker]);
      await ticks(live, 2);
      expect(workerFiles(live, '.spec.json')).toHaveLength(0);
      driver.kill();
    },
    LONG,
  );

  test(
    'a resume worker that still runs gets no second one, and a missing live setting starts none',
    async () => {
      const dir = waveFolder();
      const settings = JSON.parse(readFileSync(join(dir, 'supervisor.json'), 'utf8')) as {
        waveStart: { prompt: string };
      };
      settings.waveStart.prompt = 'PLAN:sleep:6000';
      writeFileSync(join(dir, 'supervisor.json'), JSON.stringify(settings));
      staleState(dir, { closed: [] }, 31);
      execFileSync('powershell.exe', tickArguments(dir));
      execFileSync('powershell.exe', tickArguments(dir));
      expect(workerFiles(dir, '.spec.json')).toHaveLength(1);
      await tick(dir);

      const blind = folder({
        waveStart: { stateFile: join(root, 'blind.json'), prompt: 'PLAN:pass' },
      });
      writeFileSync(join(root, 'blind.json'), '{}');
      const when = new Date(Date.parse(CLOCK) - 90 * 60_000);
      utimesSync(join(root, 'blind.json'), when, when);
      await tick(blind);
      expect(workerFiles(blind, '.spec.json')).toHaveLength(0);
      expect(status(blind).alarms.join()).toContain('liveMatch');
    },
    LONG,
  );

  test(
    'a changed state file that goes stale again gets a new resume worker',
    async () => {
      const dir = waveFolder();
      staleState(dir, { closed: [] }, 31);
      await ticks(dir, 2);
      staleState(dir, { closed: ['BLD-01'] }, 40);
      await ticks(dir, 2);
      expect(workerFiles(dir, '.spec.json')).toHaveLength(2);
    },
    LONG,
  );

  test(
    'a resume worker with a failed sign-in does not spend the one try',
    async () => {
      const dir = waveFolder();
      const settings = JSON.parse(readFileSync(join(dir, 'supervisor.json'), 'utf8')) as {
        waveStart: { prompt: string };
      };
      settings.waveStart.prompt = 'PLAN:signin';
      writeFileSync(join(dir, 'supervisor.json'), JSON.stringify(settings));
      staleState(dir, { closed: [] }, 31);
      await ticks(dir, 3);
      expect(workerFiles(dir, '.spec.json')).toHaveLength(1);
      const later = after(31);
      await tick(dir, later);
      expect(workerFiles(dir, '.spec.json')).toHaveLength(2);
    },
    LONG,
  );
});
