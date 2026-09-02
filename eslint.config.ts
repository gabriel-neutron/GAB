import js from '@eslint/js';
import type { Rule } from 'eslint';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

import { LIMITS, measure } from './tools/comment-budget.ts';

/**
 * Every feature entry point that mounts a live canvas. **One list, and the two gates below both
 * read it**, so a third canvas feature is added at one point and cannot reach one gate and miss
 * the other.
 *
 * A hazard is a mount and not a name. These are the folders that mount MapLibre and Sigma today —
 * `CANVAS.md` holds the rule and names the same two.
 */
const CANVAS_PAGES = ['map', 'graph'] as const;

/**
 * **A comment records a reason, and never a reference.** A reason is a fact about the code, and it
 * cannot go stale: if the code changes, it changes with it. A reference is an address to something
 * outside the file, and it goes stale in silence when somebody else edits or deletes the thing it
 * names.
 *
 * **The defect this rule exists to not repeat.** Four surface documents were deleted on 17 August
 * 2026. Two days later, 67 paths under `src/` still named them and 578 section marks still pointed
 * into their sections. No check failed and nothing warned.
 *
 * **A colour is not a ticket, and the shape excludes the two hexadecimal lengths this repository
 * writes.** `#2971c6`, `#000000`, `#999` and `#abc` pass; `#89` and `#1234` are refused. Counting
 * digits was the first attempt and it was wrong twice: it refused the grey `#999`, and it went
 * blind above `#999`. **A colour never fails the build**, which is the safe direction of the one
 * ambiguity left: `#123456` could be either, and it is read as a colour.
 *
 * **A link is an address too.** A ticket written as `https://github.com/.../issues/89` defeated
 * the first shape completely, and it is the form a paste produces.
 *
 * **An entry of the locked register stays.** `M8` and `T5` carry no address, and a new decision
 * replaces an entry by name, so the name outlives even its replacement. They are domain words.
 *
 * **A use case of a deleted document is refused.** `UC1` to `UC5` were defined in the four surface
 * documents and nowhere else, and the same token named two different things in two of them. So the
 * shape had already rotted when it was added here. It is case sensitive, because the token was
 * only ever written in capitals.
 *
 * **A numbered rule is refused.** The rules of the visual language were cited by number from 34
 * places, and an inserted rule would have renumbered every citation after it in silence. The list
 * carries no numbers now, so a number here names nothing at all.
 *
 * **A numbered invariant stays, and no shape below matches one.** It is a name and not a position:
 * a number is given once and never given again, so no citation can rot. The one condition of the
 * locked register applies to it — the identifier never travels alone, and every site states the
 * invariant beside the number.
 *
 * **A module beside the file is an address too.** `./claims` names a file, and a rename or a
 * move leaves the comment pointing at nothing. The shape with an extension missed every one of
 * the ten that stood under `src/`, because a relative import carries no extension.
 *
 * **A stylesheet is out of reach, and it now carries nothing.** ESLint does not read
 * `src/index.css`, so a reference there is refused by nobody. Its rules are no longer numbered and
 * its comments cite none, so there is nothing left for this rule to miss.
 */
const SHAPES = [
  {
    pattern: /(?<!#)#(?:\s+\d+|(?!(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})(?![\w-]))\d+)\b/g,
    kind: 'a ticket number',
  },
  { pattern: /\b(?:issues?|pulls?|PR|ticket)[\s/#:-]*\d+\b/gi, kind: 'a ticket number' },
  { pattern: /https?:\/\/\S+/g, kind: 'a link' },
  { pattern: /\u00a7/g, kind: 'a section mark' },
  { pattern: /\b(?:section|sect\.?)\s*\d+(?:\.\d+)*\b/gi, kind: 'a section' },
  { pattern: /\badr[\s._-]*\d{1,4}\b/gi, kind: 'an ADR citation' },
  { pattern: /[\w./-]+\.(?:md|mdx|markdown)(?![\w-])/gi, kind: 'a path to a document' },
  { pattern: /\.{1,2}\/[\w.-]+/g, kind: 'a path to a file' },
  { pattern: /\bUC\s*\d+\b/g, kind: 'a use case of a deleted document' },
  { pattern: /\brules?\s*\d+\b/gi, kind: 'a numbered rule' },
] as const;

// The cap reads the same `measure()` the census reads, so the gate and the report cannot
// give two numbers. A comment that states a ruling of the operator belongs in the tracker.
const commentBudget: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      block:
        'A comment block is {{cap}} lines. This one is {{lines}}. Keep the reason a reader needs, and put the rest in the commit body or in the tracker',
      long: 'A comment line is {{cap}} characters. This one is {{chars}}',
    },
  },
  create(context) {
    return {
      Program() {
        const found = measure(context.sourceCode.getText());
        for (const block of found.overBlocks)
          context.report({
            loc: { line: block.line, column: 0 },
            messageId: 'block',
            data: { cap: String(LIMITS.blockLines), lines: String(block.lines) },
          });
        for (const line of found.longLines)
          context.report({
            loc: { line: line.line, column: 0 },
            messageId: 'long',
            data: { cap: String(LIMITS.lineChars), chars: String(line.chars) },
          });
      },
    };
  },
};

/**
 * **A length that the theme names is written once, in the theme.** `--text-small` and
 * `--tracking-caps` were declared in `:root`, where Tailwind does not read them, so no class
 * carried either value and 48 places wrote `text-[11px]/4` by hand. The theme said 11px and
 * could not enforce it: to move the floor of the text ladder, a person had to edit 48 lines and
 * hope that none was missed.
 *
 * The two values are in an `@theme` block now, under a name of the namespace that builds the
 * utility. This rule keeps them there.
 *
 * **An arbitrary value is not the defect.** `w-[17rem]` for one column and `h-[600px]` for one
 * story frame are correct: the value carries no meaning that repeats. The defect is a value that
 * the theme already names, written again in a class, where nothing keeps the two equal.
 *
 * `REPLACEMENTS` names the class to write, so each report is a rewrite and never a search.
 * `HAND_WRITTEN` has no single answer to give, so it names the ladder to read instead. A general
 * shape is skipped where a replacement already matched at the same place, and one hand-written
 * length gets one report.
 *
 * **The shapes read a string and not an attribute.** A class list reaches `className` through
 * `cn`, through `cva` and through a variant table, and a rule that reads the attribute alone
 * sees the last of these and misses the first two.
 */
const REPLACEMENTS = [
  { pattern: /\btext-\[11px\]/g, use: '`text-small`' },
  { pattern: /\btracking-\[0\.06em\]/g, use: '`tracking-caps`' },
] as const;

const TINTS =
  'slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PAINTS =
  'text|bg|border|fill|stroke|ring|shadow|outline|decoration|accent|caret|divide|from|via|to';

const HAND_WRITTEN = [
  {
    pattern: /\btext-\[[\d.]+px\]/g,
    use: 'a text size token of the theme',
  },
  {
    pattern: new RegExp(`\\b(?:${PAINTS})-\\[(?:#[0-9a-fA-F]{3,8}|(?:oklch|rgba?|hsla?)\\()`, 'g'),
    use: 'a colour token of the theme',
  },
  {
    pattern: new RegExp(`\\b(?:${PAINTS})-(?:${TINTS})-\\d{2,3}\\b`, 'g'),
    use: 'a colour token of the theme',
  },
] as const;

const noHandWrittenToken: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      value:
        'The theme names this value, and a class must read it: `{{text}}`. Write {{use}}, so that the value moves when the theme moves',
    },
  },
  create(context) {
    const source = context.sourceCode;

    const read = (text: string, start: number) => {
      const taken = new Set<number>();
      const report = (found: RegExpExecArray, use: string) => {
        const at = source.getLocFromIndex(start + found.index);
        context.report({
          loc: { start: at, end: at },
          messageId: 'value',
          data: { text: found[0], use },
        });
      };
      for (const shape of REPLACEMENTS) {
        shape.pattern.lastIndex = 0;
        let found = shape.pattern.exec(text);
        while (found !== null) {
          taken.add(found.index);
          report(found, shape.use);
          found = shape.pattern.exec(text);
        }
      }
      for (const shape of HAND_WRITTEN) {
        shape.pattern.lastIndex = 0;
        let found = shape.pattern.exec(text);
        while (found !== null) {
          if (!taken.has(found.index)) report(found, shape.use);
          found = shape.pattern.exec(text);
        }
      }
    };

    return {
      // `range[0]` is the opening quote of a string and the opening delimiter of a template, and
      // the text of both begins one character later.
      Literal(node) {
        if (typeof node.value !== 'string' || node.range === undefined) return;
        read(node.value, node.range[0] + 1);
      },
      TemplateElement(node) {
        if (node.range === undefined) return;
        read(node.value.raw, node.range[0] + 1);
      },
    };
  },
};

const noReferenceInComment: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      address:
        'A comment records a reason, and never a reference. `{{text}}` is {{kind}}. Write the fact the reader needs, and carry the reference in the commit message or in your report',
    },
  },
  create(context) {
    return {
      Program() {
        const source = context.sourceCode;
        for (const comment of source.getAllComments()) {
          const start = comment.range?.[0];
          if (start === undefined) continue;
          // `range[0]` is the first character of the delimiter, and `value` begins two characters
          // later for `//` and for `/*` alike.
          const body = start + 2;
          for (const shape of SHAPES) {
            shape.pattern.lastIndex = 0;
            let found = shape.pattern.exec(comment.value);
            while (found !== null) {
              const at = source.getLocFromIndex(body + found.index);
              context.report({
                loc: { start: at, end: at },
                messageId: 'address',
                data: { text: found[0], kind: shape.kind },
              });
              found = shape.pattern.exec(comment.value);
            }
          }
        }
      },
    };
  },
};

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/build',
      '**/coverage',
      '**/storybook-static',
      '.scratch',
    ],
  },

  // The route tree is generated and carries its own banner. It is excluded by name, never by a
  // pattern that authored code can enter (ADR 0004 §8).
  { ignores: ['src/routeTree.gen.ts'] },

  // The harness runs a workflow script inside an async function and supplies its globals, so a
  // top-level `return` and a top-level `await` are correct there. A parser that reads the file as
  // a module stops at the first one and reads nothing after it. Nothing here ships.
  { ignores: ['.claude/workflows/**'] },

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
    //
    // A workspace package is named as well. The `package` element was declared as a target of an
    // import only, so no rule below ran **from** a package: one could import a browser feature,
    // a route or the base tables, and nothing objected.
    //
    // `.mts` and `.cts` are named because they compile. A file with either extension belonged to
    // no element, so `no-unknown-files` passed it and every policy below missed it.
    files: [
      'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      '.storybook/**/*.{ts,tsx,mts,cts}',
    ],

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

        // The two generated folders. `contract` is read from the api schema and the user
        // interface imports it; `base-tables` is read from the public schema and nothing under
        // `src/` may import it. Both are declared, so a generated file is a known file.
        { type: 'contract', pattern: 'src/contract', partialMatch: false },
        { type: 'base-tables', pattern: 'src/db', partialMatch: false },

        // A workspace package. `@gab/proposal` resolves through a symlink in `node_modules`, and
        // the resolver follows it to the real path, so the target of the import is this folder.
        // The capture holds the folder name, which is the name of the package after the scope.
        { type: 'package', pattern: 'packages/*/src', capture: ['pkg'], partialMatch: false },

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

            // The contract is the shape of a read, and every part of the user interface reads.
            // It imports nothing of its own, so it opens no cycle and joins no two features. A
            // re-export through the seam would be a file that only passes on what it imports.
            {
              from: { element: { types: ['shared', 'feature', 'route'] } },
              allow: { to: { element: { type: 'contract' } } },
            },

            // Storybook reaches the seam, and **never a feature**. A story
            // lives beside its component and imports what that component may import; the
            // configuration folder is not a place to reach across the seam. `main.ts` names
            // the story files in a glob, which is not an import, so no rule is needed for it.
            {
              from: { element: { type: 'storybook' } },
              allow: { to: { element: { type: 'shared' } } },
            },

            // A workspace package holds a shape that both sides of the product import. It imports
            // nothing under `src/`, so it opens no cycle and joins no two features.
            {
              from: { element: { types: ['shared', 'feature', 'route'] } },
              allow: { to: { element: { type: 'package' } } },
            },

            // A package reaches another package, which is how the writer reads the shape of a
            // proposal. The refusal below still holds, so this opens no path to the writer.
            {
              from: { element: { type: 'package' } },
              allow: { to: { element: { type: 'package' } } },
            },

            // ...and nothing under `src/`. A package is a leaf: the browser and the writer both
            // import it, so a package that reaches into `src/` puts a browser feature inside the
            // Node backend, and puts `src/` inside every side that imports the package.
            {
              from: { element: { type: 'package' } },
              disallow: {
                to: {
                  element: {
                    types: ['feature', 'route', 'shared', 'contract', 'base-tables', 'storybook'],
                  },
                },
              },
              message:
                'A workspace package is a leaf, and it imports nothing under `src/`. Both sides of the product import the package, so what it imports lands in both. Move the shape you need into the package',
            },

            // ...and never a Node part. `@gab/writer` and `@gab/worker` each reach the database
            // and hold a secret, and a browser file that imports one ships both to the client.
            // Every side is named, and a package too: a package the browser imports is a browser
            // file by another name, so `@gab/proposal` reaching one ships the same secrets.
            //
            // ONE ENTRY PER PACKAGE, and never a brace inside the capture. A capture value that
            // the plugin reads as a literal name refuses nothing and reads as a working gate.
            {
              from: {
                element: {
                  types: [
                    'shared',
                    'feature',
                    'route',
                    'storybook',
                    'contract',
                    'base-tables',
                    'package',
                  ],
                },
              },
              disallow: { to: { element: { type: 'package', captured: { pkg: 'writer' } } } },
              message:
                'The writer is the Node backend, and the browser never imports it. It reaches the database and holds the secrets. Call it over the wire, and import a shared shape from another workspace package',
            },
            {
              from: {
                element: {
                  types: [
                    'shared',
                    'feature',
                    'route',
                    'storybook',
                    'contract',
                    'base-tables',
                    'package',
                  ],
                },
              },
              disallow: { to: { element: { type: 'package', captured: { pkg: 'worker' } } } },
              message:
                'The worker claims from the job queue, and the browser never imports it. It reaches the database and holds a secret. Call it over the wire, and import a shared shape from another workspace package',
            },
            {
              from: {
                element: {
                  types: [
                    'shared',
                    'feature',
                    'route',
                    'storybook',
                    'contract',
                    'base-tables',
                    'package',
                  ],
                },
              },
              disallow: { to: { element: { type: 'package', captured: { pkg: 'store' } } } },
              message:
                'The store writes the raw bucket, and the browser never imports it. It holds the key of the account that may put an object. Call it over the wire, and import a shared shape from another workspace package',
            },

            // The base tables, refused from every side and stated last, so a policy above can
            // never open it. `default: 'disallow'` already refuses it; a named rule with a
            // reason reads as a decision, and a silent default reads as an oversight.
            {
              from: { element: { types: ['shared', 'feature', 'route', 'storybook', 'contract'] } },
              disallow: { to: { element: { type: 'base-tables' } } },
              message:
                'The base tables are the shape of the storage, and the browser never reaches one. Import the contract, which is the shape of a read',
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

  // The rule above holds `src/`, each workspace package and the Storybook configuration, and it
  // takes no exception. `main.tsx` and `router.tsx` are outside the boundaries block and inside
  // this one on purpose: a reference rots in them exactly as it rots anywhere else. `.mts` and
  // `.cts` are named because they compile, and the boundaries block above names them too.
  {
    files: [
      'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      'packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
      '.storybook/**/*.{ts,tsx,js,mjs,cjs}',
    ],
    plugins: {
      local: {
        rules: {
          'no-reference-in-comment': noReferenceInComment,
          'no-hand-written-token': noHandWrittenToken,
        },
      },
    },
    rules: {
      'local/no-reference-in-comment': 'error',
      'local/no-hand-written-token': 'error',
    },
  },

  // A comment block is three lines and a comment line is 100 characters. Every file under `src/`
  // and under a workspace package is inside, and the kit takes no exemption — the day a vendored
  // file genuinely fails, the operator adds that one file name here.
  {
    files: ['src/**/*.{ts,tsx,mts,cts}', 'packages/*/src/**/*.{ts,tsx,mts,cts}'],
    plugins: { budget: { rules: { 'comment-budget': commentBudget } } },
    rules: { 'budget/comment-budget': 'error' },
  },
);
