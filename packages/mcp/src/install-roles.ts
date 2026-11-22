// Gives the tick its six worker roles, and sends each ticket of a second check to the first real
// closer. Only the operator or a coder runs it, once, after the gab server runs the code of this file.
//
//   node packages/mcp/src/install-roles.ts --state <folder> --gab <http://127.0.0.1:port> --checkout <folder>
//     [--model <id>] [--second-check <ticket>=<issue>,...]

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { writeRoles } from './role-settings.ts';

const { values: flags } = parseArgs({
  options: {
    state: { type: 'string' },
    gab: { type: 'string' },
    checkout: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    'second-check': { type: 'string', default: '' },
  },
});
const { state, gab, checkout, model } = flags;
if (state === undefined || gab === undefined || checkout === undefined)
  throw new Error('--state, --gab and --checkout are necessary');

// A server of older code gives 404 at a role address, and each worker would then hold for a service.
const answer = await fetch(`${gab}/mcp/proposer`);
if (answer.status === 404)
  throw new Error('This gab server has no role address. Restart it first.');

const stateDir = resolve(state);
const file = join(stateDir, 'supervisor.json');
const settings = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
settings['roles'] = writeRoles(stateDir, gab, resolve(checkout), model);
writeFileSync(file, JSON.stringify(settings, null, 1));

const inbox = join(stateDir, 'inbox');
mkdirSync(inbox, { recursive: true });
for (const pair of flags['second-check'].split(',').filter(Boolean)) {
  const [id, issue] = pair.split('=');
  if (id === undefined || issue === undefined) throw new Error(`bad pair: ${pair}`);
  const prompt = execFileSync('gh', ['issue', 'view', issue, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  });
  writeFileSync(
    join(inbox, `second-check-${id}.json`),
    JSON.stringify({ ticket: { id, state: 'ready', secondCheck: true, closer: 'build', prompt } }),
  );
}
console.log('the tick has its roles');
