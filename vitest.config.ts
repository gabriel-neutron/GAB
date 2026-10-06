import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { testRunDatabase } from './tools/test-database.ts';

// External constraint: the compose file sets the password of `gabriel_app` and the secret of the
// object store. Each one is the one signal that says its service is up.
const databaseIsReachable = (process.env['GABRIEL_APP_PASSWORD'] ?? '') !== '';
const bucketIsReachable = (process.env['RAW_STORE_SECRET_KEY'] ?? '') !== '';

// Departure: a project that nobody registers reports nothing, so a run without it shows green.
// Only `OFFLINE=1` asks for the smaller suite, and each other non-empty value stops the run,
// because `OFFLINE=0` or `OFFLINE=false` can mean "not offline".
const offlineWord = process.env['OFFLINE'] ?? '';

if (offlineWord !== '' && offlineWord !== '1')
  throw new Error(
    `OFFLINE is "${offlineWord}". Only OFFLINE=1 asks for the offline part of the suite. Unset ` +
      'OFFLINE to run the whole suite.',
  );

const offlineWasAsked = offlineWord === '1';

if (!offlineWasAsked && !(databaseIsReachable && bucketIsReachable))
  throw new Error(
    'The suite reaches the local stack, and this shell holds no credential for it. Start the ' +
      'compose file, and run the suite through `infra/.env` so GABRIEL_APP_PASSWORD and ' +
      'RAW_STORE_SECRET_KEY are set. To run the offline part on purpose, set OFFLINE=1 — that ' +
      'part proves no perimeter, no role, no grant and no row of the corpus.',
  );

// External constraint: the compose file publishes the read service of the test database on this
// port. The guard above runs first, so a refused run opens no socket.
const LIVE_TARGET = {
  GABRIEL_DATABASE: testRunDatabase(process.env),
  VITE_API_URL: 'http://127.0.0.1:3001',
};

// Origin: measured on 9 September 2026 over 1,178 entities. Each view answers inside 100 ms in
// SQL, and the projects that run in parallel pass the five seconds Vitest gives a test.
const TEST_TIMEOUT = 30_000;

const SOURCE_ROOT = path.resolve(import.meta.dirname, './src');

// External constraint: a project does not inherit `testTimeout` from the root, so each one states
// it. Vite matches the `@` alias only as `@` or `@/`, so the alias changes no `@gab/` import.
const nodeProject = (
  name: string,
  include: readonly string[],
  env: Readonly<Record<string, string>> = {},
  groupOrder = 0,
) => ({
  test: {
    name,
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    env,
    include: [...include],
    sequence: { groupOrder },
  },
  resolve: { alias: { '@': SOURCE_ROOT } },
});

// Departure: Vitest runs the projects of one group at the same time. The schema and the writer
// projects commit rows that the census tests count, so each one runs alone, after the census.
const SCHEMA_GROUP = 1;
const WRITER_GROUP = 2;

// Departure: the end-to-end test starts the runner in a child process on its own connection, so
// its rows commit, and the runner takes any queued job. It runs alone, after every other project.
const END_TO_END_GROUP = 3;

// Departure: the dot in `.db-test.ts` holds the two halves apart, because `*.test.ts` does not
// match it. The offline half takes each other test file, so no new test file falls outside it.
const offlineProject = nodeProject('offline', [
  'src/**/*.test.{ts,tsx}',
  'packages/*/src/**/*.test.ts',
  'tools/**/*.test.ts',
]);

// Departure: the store test reaches the object store and no database, so it gets no live target.
const liveProjects = [
  nodeProject('store', ['packages/store/src/**/*.db-test.ts']),
  nodeProject('writer', ['packages/writer/src/**/*.db-test.ts'], LIVE_TARGET, WRITER_GROUP),
  nodeProject('worker', ['packages/worker/src/**/*.db-test.ts'], LIVE_TARGET),
  nodeProject('tools', ['packages/tools/src/**/*.db-test.ts'], LIVE_TARGET),
  nodeProject('mcp', ['packages/mcp/src/**/*.db-test.ts'], LIVE_TARGET),
  nodeProject('contract', ['src/shared/read/**/*.db-test.ts'], LIVE_TARGET),
  nodeProject('schema', ['tools/*.db-test.ts'], LIVE_TARGET, SCHEMA_GROUP),
  nodeProject('perimeter', ['tools/perimeter/*.db-test.ts'], LIVE_TARGET),
  nodeProject('corpus', ['tools/corpus/*.db-test.ts'], LIVE_TARGET),
  nodeProject('service', ['tools/service/*.db-test.ts'], LIVE_TARGET),
  nodeProject('e2e', ['packages/*/src/**/*.e2e-test.ts'], LIVE_TARGET, END_TO_END_GROUP),
];

export default defineConfig({
  test: {
    projects: [
      {
        // Departure: the story project takes the application configuration, so a story compiles
        // under the same alias and the same Tailwind plugin as the component it checks.
        extends: './vite.config.ts',

        // External constraint: `storybookTest` returns a promise, and it sets the include itself.
        plugins: [await storybookTest({ configDir: '.storybook' })],

        test: {
          name: 'storybook',
          testTimeout: TEST_TIMEOUT,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },

      offlineProject,

      // Departure: one condition for both services. The guard above proves both credentials are
      // here, so this list is whole or it is empty.
      ...(offlineWasAsked ? [] : liveProjects),
    ],
  },
});
