import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * The suite of `pnpm test`. `pnpm check` never runs it. ADR 0001 §3 and §4 keep the fast
 * command and the slow command apart.
 *
 * There is one project today, `storybook`. It is a project, and not the whole configuration,
 * because the suite will hold a second kind of test: a parser, a payload validator, or a query
 * against PostgreSQL. That kind runs in Node and not in a browser. Add the second project
 * beside this one, and this one does not move. See #21, which stays open for every level that
 * this file does not reach.
 */
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
    ],
  },
});
