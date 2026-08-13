import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

/**
 * Every feature entry point that mounts a live canvas. **One list, and the two gates below both
 * read it**, so a third canvas feature is added at one point and cannot reach one gate and miss
 * the other.
 *
 * A hazard is a mount and not a name. These are the folders that mount MapLibre and Sigma today —
 * `CANVAS.md` holds the rule and names the same two.
 */
const CANVAS_PAGES = ['map', 'graph'] as const;

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/build', '**/coverage', '**/storybook-static'] },

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

  // `src/shared/ui/` takes **no exemption**, and `routeTree.gen.ts` above is the only one.
  // ADR 0004 §8 holds the decision, the two facts that disproved the premise of the override
  // that version 1 granted, and the hole it left. #39 removed it. Read §8 before you add it
  // back: `src/shared/ui/**` is a pattern that authored code can enter.
  //
  // The day a vendored file genuinely fails, the operator adds that **one file name** here.

  // The seam of ADR 0001 §1 and ADR 0004 §5, held by a rule and not by a convention.
  {
    // JavaScript is named as well as TypeScript. `allowJs` is off, so a `.js` file under a
    // feature does not compile, but a `.d.ts` beside it removes that limit and the import
    // then escapes every rule here.
    //
    // `.storybook/` is named as well as `src/`. Without it no rule below reaches that folder,
    // and nothing stops `.storybook/preview.ts` from importing a feature. Every feature would
    // then load into every story (#60).
    files: ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}', '.storybook/**/*.{ts,tsx}'],

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

        // The Storybook configuration. It has a target of its own, `tsconfig.storybook.json`.
        // It is not a feature, not the seam and not a route.
        //
        // The pattern is `.storybook/**`, and not `.storybook`. The plugin reads a dot in the
        // last segment of a pattern as a file name, and prints "element descriptors appear to
        // use file patterns" on each run. `.storybook/*` is worse: it then classifies no file,
        // and `no-unknown-files` fails. The two stars state the folder without doubt.
        { type: 'storybook', pattern: '.storybook/**', partialMatch: false },
      ],

      // The one stylesheet, ignored **as a dependency and by name**. `.storybook/preview.ts`
      // imports it, and an element pattern matches a folder and never a file, so the stylesheet
      // can never be an element and `no-unknown-dependencies` refuses the import.
      //
      // This setting removes that one import from the analysis. It does **not** remove
      // `preview.ts`: putting the file in `ignores` above would drop it from every rule in this
      // block, and the file that reaches for a feature is the very file this block exists to
      // hold. A second stylesheet fails here, which is the intended gate.
      'boundaries/ignore': ['src/index.css'],

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

            // Storybook reaches the seam, and **never a feature**. A story
            // lives beside its component and imports what that component may import; the
            // configuration folder is not a place to reach across the seam. `main.ts` names
            // the story files in a glob, which is not an import, so no rule is needed for it.
            {
              from: { element: { type: 'storybook' } },
              allow: { to: { element: { type: 'shared' } } },
            },
          ],
        },
      ],
    },
  },

  // No story mounts a live canvas. ADR 0004 §1 gives MapLibre and Sigma one element each, and
  // their own loop. ADR 0004 §3 keeps React state out of both. One story makes one live WebGL
  // context, and a browser removes the oldest context after approximately sixteen.
  //
  // A comment in `.storybook/main.ts` is not a gate. The glob `../src/**/*.stories.tsx` collects
  // such a file, and the run then makes the contexts one at a time until the browser removes
  // them. A negation in that glob is worse: it drops the file in silence.
  //
  // The entry points are named **by name**, from `CANVAS_PAGES`. A story for a panel inside these
  // folders is correct and must pass. `Program` always exists, so an empty file fails as well.
  {
    files: CANVAS_PAGES.map((page) => `src/features/${page}/${page}-page.stories.tsx`),
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'No story mounts a live canvas — ADR 0004 §1 and §3. A browser removes the oldest WebGL context after approximately sixteen. Delete this file, and write a story for each panel beside the canvas',
        },
      ],
    },
  },

  // The rule above names two files, and the hazard is the mount and not the name. A third story
  // that drives a canvas directly is the same fault under a different file name, so the import
  // is refused as well.
  //
  // A pattern is correct here, and ADR 0004 §8 does not bind. That rule governs an **exemption**,
  // where a pattern that authored code can enter opens a hole in silence. This is a prohibition:
  // a pattern that matches too much fails loudly, and the operator sees it at once.
  //
  // **It did match too much, and it failed loudly.** The group was `**/*-page`, so it caught
  // `detail-page` and `review-page` as well. Neither mounts a canvas, and neither reaches MapLibre
  // or Sigma through any import. The hazard is the mount, so the group now names the pages that
  // mount, from the same `CANVAS_PAGES` list as the block above. **Extend that list, and never
  // this group**: two lists of the canvas pages is how one gate falls behind the other.
  //
  // The gate is partial, and it is stated so that nobody reads more into it. A story that imports
  // a sibling, which then imports MapLibre, passes both blocks. `CANVAS.md` holds the rule; these
  // two blocks hold the two cases a rule can reach.
  {
    files: ['src/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'maplibre-gl',
              message: 'No story mounts a live canvas — ADR 0004 §1 and §3. Story the panels',
            },
            {
              name: 'sigma',
              message: 'No story mounts a live canvas — ADR 0004 §1 and §3. Story the panels',
            },
          ],
          patterns: [
            {
              group: CANVAS_PAGES.map((page) => `**/${page}-page`),
              message:
                'The map page and the graph page own a live canvas. Story the panels beside it, and not the page',
            },
          ],
        },
      ],
    },
  },
);
