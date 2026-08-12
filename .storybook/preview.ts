import type { Preview } from '@storybook/react-vite';

// The one stylesheet of ADR 0001 §1. It holds Tailwind, the shadcn layer and the theme
// variables, so a story paints as the application paints.
//
// `eslint.config.ts` ignores this import by name, under `boundaries/ignore`. An element pattern
// matches a folder and never a file, so the stylesheet can never be an element. This file stays
// under every other boundaries rule: it must not import a feature.
import '../src/index.css';

/**
 * There is no theme decorator, and no provider. `src/index.css` puts the light theme on `:root`
 * and the dark theme behind a `.dark` class. A component therefore renders correctly with
 * neither. `ThemeProvider` only reads `localStorage` and writes that class. A story that must
 * prove the dark paint sets the class itself.
 *
 * The design is a later discussion — ADR 0004, "Not decided here". A decorator written before
 * that discussion would be a guess.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
  },
};

export default preview;
