// The emitted chunks, ruled after every build. A lint rule proves that nobody wrote a
// cross-import. Only a reading of the emitted files proves that nothing loaded, and the two
// heavy dependencies of this application are the reason that proof is owed: a map library of
// about 920 kB reached the entry chunk once, and every route paid for it in silence for three
// weeks. The failure is silent by nature, so a person cannot be the check.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '../dist');
const ASSETS = path.join(DIST, 'assets');

// A dependency that a route may load, and the chunk it is allowed to sit in. The name is the
// fingerprint: it survives minification because it is written in strings, in worker paths and
// in error messages inside the package. A fingerprint that disappears fails the run below, and
// it never passes quietly.
const HEAVY: Record<string, readonly string[]> = {
  maplibre: ['map'],
  sigma: ['graph'],
  graphology: ['graph'],
};

// Measured on 28 August 2026, and each ceiling is the measurement plus about a fifth. A number
// here is a gate and not a record: a chunk that grows past it stops the build, and the person
// who grew it either shrinks it again or writes a new number and says why. The build warning of
// the bundler is switched off in `vite.config.ts`, because it fired on every run and a warning
// that is always present is a warning nobody reads.
const CEILING: Record<string, number> = {
  index: 300_000, //           251 188
  'preload-helper': 220_000, //  184 744
  map: 1_100_000, //           942 697
  graph: 220_000, //           175 496
};

// The eager set of the four routes together: 448 170 bytes on the same day. A chunk under this
// floor needs no verdict. A chunk above it must be named in CEILING, so a new heavy dependency
// cannot land without one.
const EAGER_CEILING = 540_000;
const VERDICT_FLOOR = 100_000;

const faults: string[] = [];
const fault = (line: string): void => void faults.push(line);

// The base name is what a person reads and what survives a rebuild. The hash after it does not.
const baseOf = (file: string): string => file.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');

const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entry = /<script type="module"[^>]*src="\/assets\/([^"]+)"/.exec(html)?.[1];
const preloaded = [...html.matchAll(/modulepreload"[^>]*href="\/assets\/([^"]+)"/g)].flatMap(
  (match) => (match[1] === undefined ? [] : [match[1]]),
);

if (entry === undefined) throw new Error('dist/index.html names no entry module.');

// THE EAGER SET, and it is not the entry chunk alone. A modulepreload link loads its file on
// every route, whichever route the reader opened. A heavy dependency behind one of those links
// is as eager as one inside the entry, and the size of the first paint is their sum.
const eager = [entry, ...preloaded];

const chunks = readdirSync(ASSETS)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({
    file,
    base: baseOf(file),
    eager: eager.includes(file),
    text: readFileSync(path.join(ASSETS, file), 'utf8'),
    bytes: readFileSync(path.join(ASSETS, file)).byteLength,
  }));

for (const [name, allowed] of Object.entries(HEAVY)) {
  const carriers = chunks.filter((chunk) => chunk.text.includes(name));

  if (carriers.length === 0)
    fault(
      `${name} is in no chunk. Either the dependency left the application, and this table must ` +
        `lose its row, or the fingerprint stopped surviving the build and this whole guard now ` +
        `passes for the wrong reason.`,
    );

  for (const chunk of carriers) {
    if (chunk.eager)
      fault(`${name} is in ${chunk.file}, which every route loads. It must load with its route.`);
    else if (!allowed.includes(chunk.base))
      fault(`${name} is in ${chunk.file}. It is allowed in ${allowed.join(' and ')} only.`);
  }
}

for (const chunk of chunks) {
  const ceiling = CEILING[chunk.base];

  if (ceiling === undefined && chunk.bytes > VERDICT_FLOOR)
    fault(
      `${chunk.file} is ${chunk.bytes} bytes and no ceiling names it. A chunk this size is a ` +
        `decision: give it a ceiling, or make it smaller.`,
    );
  else if (ceiling !== undefined && chunk.bytes > ceiling)
    fault(`${chunk.file} is ${chunk.bytes} bytes, over its ceiling of ${ceiling}.`);
}

const eagerBytes = chunks
  .filter((chunk) => chunk.eager)
  .reduce((total, chunk) => total + chunk.bytes, 0);

if (eagerBytes > EAGER_CEILING)
  fault(
    `the eager set is ${eagerBytes} bytes over ${eager.length} files, past its ceiling of ` +
      `${EAGER_CEILING}. That weight loads before any route draws.`,
  );

if (faults.length > 0) {
  console.error(
    `The bundle guard refuses this build:\n${faults.map((f) => `  - ${f}`).join('\n')}`,
  );
  process.exit(1);
}

console.log(
  `bundle guard: ${chunks.length} chunks, ${eagerBytes} bytes eager, no heavy dependency on ` +
    `the eager path`,
);
