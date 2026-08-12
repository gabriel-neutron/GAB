import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook is the authoring format for a component check. It is not a second test runner.
 * `@storybook/addon-vitest` makes each story a Vitest test, and runs it in Chromium. One runner
 * holds, which is what ADR 0001 §4 decided. See #60.
 *
 * This file does not repeat the Vite configuration. `@storybook/react-vite` reads
 * `vite.config.ts`, which holds the `@/*` alias and the Tailwind plugin.
 */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',

  // A story sits beside the component it checks. There is no `src/stories/` folder: a folder
  // that no boundaries element declares fails `pnpm check` on purpose (ADR 0001 §1). A story
  // inside a feature folder needs no lint rule. It gets the element of that folder, so it can
  // import `shared/` and no second feature.
  //
  // Write no story for `map-page.tsx`, and no story for `graph-page.tsx`. ADR 0004 §1 gives
  // MapLibre and Sigma one element each, and their own loop. ADR 0004 §3 keeps React state out
  // of both. One story makes one live WebGL context, and a browser removes the oldest context
  // after approximately sixteen. Write a story for each panel beside the canvas, and none for
  // the canvas.
  stories: ['../src/**/*.stories.tsx'],

  addons: ['@storybook/addon-vitest'],

  // Storybook sends anonymous usage data to its maintainers by default. One named operator runs
  // Gabriel (C2, C5), and the names of the components show what the investigation examines. No
  // data about this repository goes out unless the operator sends it.
  core: { disableTelemetry: true },
};

export default config;
