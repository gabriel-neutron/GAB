import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * The suite of `pnpm test`, which the fast check command never runs. A project that reaches the
 * local stack is collected only when the password of `gabriel_app` is in the environment, and
 * that password is the one signal which says the compose file is up.
 */
const databaseIsReachable = (process.env['GABRIEL_APP_PASSWORD'] ?? '') !== '';

// The dot in `.db-test.ts` is what holds the two halves apart: `*.test.ts` does not match it.
// A file renamed to `.db.test.ts` joins the offline half and opens a socket on a machine that
// has no stack at all.
const writerProject = {
  test: {
    name: 'writer',
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
    environment: 'node',
    include: ['packages/worker/src/**/*.db-test.ts'],
  },
};

/**
 * The closed sets of the base tables, against the enums the read client states. A CHECK reaches
 * no generated type and therefore no drift check, so this project reads `pg_constraint` itself.
 */
const schemaProject = {
  test: {
    name: 'schema',
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
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },

      {
        // The read client parses a literal row of the read API. It touches no database and no
        // network, so it runs in Node. The alias is stated here, because this project needs no
        // plugin of the application.
        test: {
          name: 'read',
          environment: 'node',
          include: ['src/shared/read/**/*.test.ts'],
        },
        resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
      },

      {
        // The door of the writer, against a stubbed answer. It reaches no write service, so it
        // runs in Node beside the read client.
        test: {
          name: 'write',
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
          environment: 'node',
          include: ['packages/proposal/src/**/*.test.ts'],
        },
      },

      ...(databaseIsReachable
        ? [
            writerProject,
            workerProject,
            contractProject,
            schemaProject,
            perimeterProject,
            corpusProject,
            serviceProject,
          ]
        : []),
    ],
  },
});
