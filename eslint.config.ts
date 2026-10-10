import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// The workspace packages that run in Node: each one holds a secret, reaches the database, or
// writes files. The browser imports none of them.
const NODE_PACKAGES = ['writer', 'model', 'store', 'worker', 'tools', 'mcp', 'site'] as const;

const CANVAS =
  'No story mounts a live canvas: a browser drops the oldest WebGL context after about sixteen. Story the panels';

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/build',
      '**/coverage',
      '**/storybook-static',
      '.scratch',
      '.claude/worktrees',
      'src/routeTree.gen.ts',
    ],
  },

  // No file may suppress a rule.
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },

  { files: ['**/*.{js,mjs,cjs,jsx}'], extends: [js.configs.recommended] },

  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // `noInlineConfig` cannot see a directive to the compiler, so this rule refuses all three.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
      ],
      // With `verbatimModuleSyntax`, a type import without the word `type` loads its file at run
      // time.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // The import boundaries: a feature reaches only `shared/`, and the browser reaches no Node part.
  {
    files: [
      'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      '.storybook/**/*.{ts,tsx,mts,cts}',
    ],
    ignores: ['src/main.tsx', 'src/router.tsx'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'], partialMatch: false },
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        { type: 'route', pattern: 'src/routes', partialMatch: false },
        { type: 'contract', pattern: 'src/contract', partialMatch: false },
        { type: 'package', pattern: 'packages/*/src', capture: ['pkg'], partialMatch: false },
        // External constraint: the plugin reads a dot in the last segment as a file name.
        { type: 'storybook', pattern: '.storybook/**', partialMatch: false },
      ],
      'boundaries/ignore': ['src/index.css', 'tools/probe.ts', 'tools/author-fixture.ts'],
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      // External constraint: the last policy that matches an import decides it.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: ['feature', 'route'] } } },
              message: '`shared/` is a leaf. It imports no feature and no route.',
            },
            {
              from: { element: { type: 'feature' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'route' } },
              allow: { to: { element: { types: ['feature', 'shared', 'route'] } } },
            },
            {
              from: { element: { types: ['shared', 'feature', 'route'] } },
              allow: { to: { element: { types: ['contract', 'package'] } } },
            },
            {
              from: { element: { type: 'storybook' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { element: { type: 'package' } },
              allow: { to: { element: { type: 'package' } } },
            },
            {
              from: {
                element: {
                  types: ['shared', 'feature', 'route', 'storybook', 'contract', 'package'],
                },
              },
              disallow: {
                to: { element: { type: 'package', captured: { pkg: [...NODE_PACKAGES] } } },
              },
              message:
                'The browser and the shared packages import no Node part: a Node part holds a secret or reaches the database. Call the writer over the wire',
            },
            {
              from: { element: { type: 'package', captured: { pkg: [...NODE_PACKAGES] } } },
              allow: {
                to: { element: { type: 'package', captured: { pkg: [...NODE_PACKAGES] } } },
              },
            },
            // The MCP server reads untrusted web content, so no package that it can reach may
            // import the writer, which signs as the operator.
            {
              from: { element: { type: 'package', captured: { pkg: '!writer' } } },
              disallow: { to: { element: { type: 'package', captured: { pkg: 'writer' } } } },
              message:
                'Only the writer signs as the operator. No other package imports it, so the MCP server cannot reach it',
            },
          ],
        },
      ],
    },
  },

  // No story mounts a live canvas.
  {
    files: ['src/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'maplibre-gl', message: CANVAS },
            { name: 'sigma', message: CANVAS },
          ],
          patterns: [{ group: ['**/map-page', '**/graph-page'], message: CANVAS }],
        },
      ],
    },
  },

  { files: ['src/**/*.{ts,tsx}'], extends: [reactHooks.configs.flat.recommended] },

  {
    files: [
      '**/*.{test,db-test,e2e-test}.{ts,tsx}',
      'src/**/*.stories.tsx',
      'packages/site/src/**/*.stories.tsx',
    ],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/no-conditional-tests': 'error',
      'vitest/valid-expect': 'error',
      'vitest/valid-describe-callback': 'error',
      // A test with no assertion reports a safety that it does not give. A helper that holds the
      // `expect` is named here. An `afterAll` that counts the rows a suite left is an assertion too.
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'refusedGeom'] }],
      'vitest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['afterAll'] }],
    },
  },
);
