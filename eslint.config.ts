import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/build', '**/coverage'] },

  // The route tree is generated and carries its own banner. It is excluded by name, never by a
  // pattern that authored code can enter (ADR 0004 §8).
  { ignores: ['src/routeTree.gen.ts'] },

  // No file may suppress a rule. `gab-coder` requires zero suppressions, so an inline
  // directive is inert and an unused one is an error, not a warning.
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },

  // `jsx` is here because no other block names it. Without it a `.jsx` file under `src/` gets
  // no rule at all, and an adversarial test walked a cross-feature import through one.
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    extends: [js.configs.recommended],
  },

  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Neither `eslint:recommended` nor typescript-eslint turns this on.
      eqeqeq: ['error', 'always'],

      // Both rules below are correct in principle and produce suppressions in practice.
      // A number in a template string and a void arrow shorthand are not defects.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],

      // `noInlineConfig` above stops an ESLint directive. It cannot see a TypeScript one,
      // because that is a comment to the compiler and not to the linter. The default of this
      // rule permits `@ts-expect-error` when a description follows, and the rule tells an
      // author to write exactly that when it refuses `@ts-ignore`. A zero-suppression
      // repository must refuse all three. In this rule `true` means "report it".
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
      ],
    },
  },

  // Vendored shadcn source, which only the shadcn CLI writes. ADR 0004 §8 requires this
  // exemption to be a **path-scoped override in the flat configuration**, not an inline
  // directive, so `noInlineConfig` still holds and no file suppresses anything.
  //
  // Two facts about it, recorded on 10 August 2026 so that nobody has to rediscover them:
  //
  // - Today it exempts nothing. The four vendored components — button, input, select and badge
  //   — pass every rule below with the override removed. It stays because ADR 0004 §8 says the
  //   next component needs it, and because adding it later is answered with suppressions.
  // - `exactOptionalPropertyTypes` is a TypeScript flag and no lint rule reads it. A file that
  //   fails it fails `tsc`, which this override cannot reach. `tsconfig.app.json` compiles
  //   this folder with every strict flag on, and it passes.
  {
    files: ['src/shared/ui/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // The seam of ADR 0001 §1 and ADR 0004 §5, held by a rule and not by a convention.
  {
    // JavaScript is named as well as TypeScript. `allowJs` is off, so a `.js` file under a
    // feature does not compile, but a `.d.ts` beside it removes that limit and the import
    // then escapes every rule here.
    files: ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'],

    // The mount and the router instance, excluded **by name**. An element pattern matches a
    // folder, so neither file can be an element unless `src` itself becomes one — and `src` as
    // an element swallows every folder that nobody declared, which is the one thing
    // `no-unknown-files` below exists to catch. Two names is the smaller hole, and a name is
    // not a pattern that authored code can enter: a third file at the root of `src/` fails.
    ignores: ['src/main.tsx', 'src/router.tsx'],

    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // `partialMatch: false` makes each pattern read from the repository root, so a folder
        // that nobody declared matches nothing and fails loudly under `default: 'disallow'`.
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['feature'],
          partialMatch: false,
        },
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        { type: 'route', pattern: 'src/routes', partialMatch: false },
      ],

      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      // A file that belongs to no declared element is a new folder that nobody decided. It
      // fails here, loudly, instead of escaping every rule below in silence.
      'boundaries/no-unknown-files': 'error',

      // The same statement from the other side, and it is not optional. `boundaries/dependencies`
      // skips a dependency whose target belongs to no element, so without this rule `shared/`
      // could import `@/router`, and through it `routeTree.gen.ts`, every route and every
      // feature. That is the cycle that the leaf rule below claims to prevent.
      'boundaries/no-unknown-dependencies': 'error',

      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // The leaf rule, first. It names no feature, so it never needs an edit, and it
            // prevents every cycle: nothing that `shared/` imports can import `shared/` back.
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: ['feature', 'route'] } } },
              message: '`shared/` is a leaf. It imports no feature and no route.',
            },

            // A feature reaches the seam. An import of itself is a same-element dependency and
            // is not checked, so no rule is needed for it.
            {
              from: { element: { type: 'feature' } },
              allow: { to: { element: { type: 'shared' } } },
            },

            // ...and never another feature. Stated, although `default: 'disallow'` already
            // says it, so that flipping the default cannot silently open the seam.
            {
              from: { element: { type: 'feature' } },
              disallow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: { feature: '!{{ from.element.captured.feature }}' },
                  },
                },
              },
              message: 'A feature never imports another feature. The seam is `shared/`.',
            },

            // `routes/` is not a feature. It is the only folder that may import one.
            {
              from: { element: { type: 'route' } },
              allow: { to: { element: { types: ['feature', 'shared', 'route'] } } },
            },
          ],
        },
      ],
    },
  },
);
