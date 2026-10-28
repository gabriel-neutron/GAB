// At the start of a research session, check that the database of the record answers, because the
// research server `gab` reads it. When it does not answer, start the stack once and check again.
// When it still does not answer, the session is told to stop before any research step.

const { execFileSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.GAB_DB_PORT ?? 5432);
const COMPOSE = path.join(__dirname, '..', '..', '..', 'infra', 'docker-compose.yml');

const answers = () =>
  new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

const start = () => {
  try {
    execFileSync('docker', ['compose', '-f', COMPOSE, 'up', '-d', '--wait', 'db'], {
      stdio: 'ignore',
      timeout: 120_000,
    });
  } catch {
    // Docker Desktop does not run, or the stack did not start: the second check says so.
  }
};

// Returns 'answers', 'started' or 'down'. The two steps are injected, so a test opens no socket.
const check = async (probe, startStack) => {
  if (await probe()) return 'answers';
  startStack();
  return (await probe()) ? 'started' : 'down';
};

const say = (context, message) =>
  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
    }),
  );

const main = async () => {
  const verdict = await check(answers, start);
  if (verdict === 'started')
    say('The stack of the record was stopped, and this hook started it.', 'GAB stack started.');
  if (verdict === 'down')
    say(
      `STOP. The database of the record does not answer on ${HOST}:${String(PORT)}, so the ` +
        'research server gab cannot read the record. Tell the operator in one line: "The GAB ' +
        'stack does not run: start Docker Desktop, then the stack." Do no research step, and ' +
        'write no client of your own to reach the record.',
      `GAB stack not running on ${HOST}:${String(PORT)}: start Docker Desktop, then the stack.`,
    );
};

module.exports = { check };

if (require.main === module) void main();
