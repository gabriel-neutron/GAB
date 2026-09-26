import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * The suite of `pnpm test`, which the fast check command never runs. The password of
 * `gabriel_app` is the one signal which says the compose file is up.
 */
const databaseIsReachable = (process.env['GABRIEL_APP_PASSWORD'] ?? '') !== '';

// The object store is a second service with a second credential, and it is up and down on its
// own. The secret the store client signs with is the one signal that says the bucket is ready.
const bucketIsReachable = (process.env['RAW_STORE_SECRET_KEY'] ?? '') !== '';

/**
 * A missing credential removed the projects that reach the stack, and the run then reported
 * green over the part of the suite it had dropped. A project that nobody registers has nothing
 * to report, so nothing was printed.
 *
 * A gate fails, or it is not a gate. `OFFLINE` is the one word that asks for the smaller suite.
 * Without it, an absent credential is a refusal and never a smaller run.
 */
const offlineWasAsked = (process.env['OFFLINE'] ?? '') !== '';

if (!offlineWasAsked && !(databaseIsReachable && bucketIsReachable))
  throw new Error(
    'The suite reaches the local stack, and this shell holds no credential for it. Start the ' +
      'compose file, and run the suite through `infra/.env` so GABRIEL_APP_PASSWORD and ' +
      'RAW_STORE_SECRET_KEY are set. To run the offline part on purpose, set OFFLINE=1 — that ' +
      'part proves no perimeter, no role, no grant and no row of the corpus.',
  );

// **The suite needs more than the five seconds Vitest gives a test, and the reason is the machine
// and not a socket.** Measured on 9 September 2026 over 1,178 entities: every view answers inside
// 100 ms in SQL, so nothing here is slow. Nine projects in parallel is what passes five seconds.
//
// **A project does not inherit this from the root**, so every project states it. An offline test
// starved of a core by a live project fails the same way a live one does, and a test that times
// out leaves its stubbed calls to land inside the next test, which then fails for a false reason.
const TEST_TIMEOUT = 30_000;

// The dot in `.db-test.ts` is what holds the two halves apart: `*.test.ts` does not match it.
// A file renamed to `.db.test.ts` joins the offline half and opens a socket on a machine that
// has no stack at all.
const writerProject = {
  test: {
    name: 'writer',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['packages/writer/src/**/*.db-test.ts'],
  },
};

/**
 * The claim loop against the live queue. Two clients claim at the same time, and each gesture
 * rolls back, so the suite leaves the queue it met.
 */
const workerProject = {
  test: {
    name: 'worker',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['packages/worker/src/**/*.db-test.ts'],
  },
};

/**
 * The raw store as the ingestion door meets it: the object goes in, the key comes back, the
 * bytes come back unchanged, and nothing reaches the object without a credential.
 */
const storeProject = {
  test: {
    name: 'store',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['packages/store/src/**/*.db-test.ts'],
  },
};

/**
 * The closed sets of the base tables, against the enums the read client states. A CHECK reaches
 * no generated type and therefore no drift check, so this project reads `pg_constraint` itself.
 */
const schemaProject = {
  test: {
    name: 'schema',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['tools/*.db-test.ts'],
  },
};

/**
 * The perimeter: the audit arms, the ownership of every table, and what each role may execute
 * and write. Every sentence of the write-authorisation model was a hand check before this.
 */
const perimeterProject = {
  test: {
    name: 'perimeter',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['tools/perimeter/*.db-test.ts'],
  },
};

/**
 * What the fixture loader put in the live database, and the two losses that load is known to
 * carry. A stated gap fails on the day somebody closes it, and a comment cannot.
 */
const corpusProject = {
  test: {
    name: 'corpus',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['tools/corpus/*.db-test.ts'],
  },
};

/**
 * The read service as a caller meets it: the counts, the paths it refuses, and a schema cache
 * that is fresh. It reads over HTTP and opens no database connection of its own.
 */
const serviceProject = {
  test: {
    name: 'service',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['tools/service/*.db-test.ts'],
  },
};

/**
 * The generated contract against the live views, read over HTTP. It stays out of the `read`
 * project because that project must pass with no database at all.
 */
const contractProject = {
  test: {
    name: 'contract',
    testTimeout: TEST_TIMEOUT,
    environment: 'node',
    include: ['src/shared/read/**/*.db-test.ts'],
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
};

export default defineConfig({
  test: {
    projects: [
      {
        // The `@/*` alias and the Tailwind plugin come from the application configuration. A
        // story therefore compiles under the same rules as the component it checks.
        extends: './vite.config.ts',

        // `storybookTest` reads `.storybook/`, makes each story a test with portable stories,
        // and supplies its own setup files. It returns a promise, so await it.
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

      {
        // The read client parses a literal row of the read API, the workspace store reads a record
        // of the browser, and a derivation of a feature reads a value. None touches a database or a
        // network, so all run in Node. The alias is stated here: this project needs no plugin.
        test: {
          name: 'read',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: [
            'src/shared/read/**/*.test.ts',
            'src/shared/*.test.ts',
            'src/features/**/*.test.ts',
          ],
        },
        resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
      },

      {
        // The door of the writer, against a stubbed answer. It reaches no write service, so it
        // runs in Node beside the read client.
        test: {
          name: 'write',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: ['src/shared/write/**/*.test.ts'],
        },
        resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
      },

      {
        // The schemas of a proposal. They read no row and open no socket, so they run in Node
        // and they run everywhere, beside the package that declares them.
        test: {
          name: 'proposal',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: ['packages/proposal/src/**/*.test.ts'],
        },
      },

      {
        // The client of the model service, against a stubbed answer. It opens no socket and it
        // reads no key of the operator, so it runs in Node and it runs everywhere.
        test: {
          name: 'model',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: ['packages/model/src/**/*.test.ts'],
        },
      },

      {
        // The committed seed against the module that declares its vocabulary. It reads one file
        // of the repository and no row of a database, so it runs in Node and it runs everywhere.
        test: {
          name: 'seed',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: ['tools/*.test.ts'],
        },
      },

      {
        // The layout of the graph, against the entities and relations it is given directly. It
        // opens no socket and reads no row, so it runs in Node beside the other pure packages.
        // The dot in `.db-test.ts` keeps this apart from the worker's live-queue project below.
        test: {
          name: 'layout',
          testTimeout: TEST_TIMEOUT,
          environment: 'node',
          include: ['packages/worker/src/**/*.test.ts'],
        },
      },

      // One list and one condition. Two conditions, one for the database and one for the bucket,
      // let a shell with one credential drop the projects of the other and say nothing. The
      // refusal above proves both credentials are here, so this list is whole or it is empty.
      ...(offlineWasAsked
        ? []
        : [
            storeProject,
            writerProject,
            workerProject,
            contractProject,
            schemaProject,
            perimeterProject,
            corpusProject,
            serviceProject,
          ]),
    ],
  },
});
