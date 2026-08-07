import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/build', '**/coverage'] },

  // No file may suppress a rule. `gab-coder` requires zero suppressions, so an inline
  // directive is inert and an unused one is an error, not a warning.
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },

  {
    files: ['**/*.{ts,mts,cts}'],
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
    },
  },
);
