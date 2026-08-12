import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Badge } from '@/shared/ui/badge';

/**
 * No surface document owns this file. `Badge` is a vendored part of the kit, and it is
 * documented upstream, so nothing here is a design decision.
 *
 * The file proves each step of the loop of #60: Vitest starts Chromium, `@storybook/addon-vitest`
 * makes this file a test, the stylesheet paints it, and a `play` function asserts on the result.
 * The composite components of #55 to #58 do not exist yet. When they do, this file already shows
 * the shape that each of their stories follows.
 */
const meta = {
  component: Badge,
  args: { children: 'candidate' },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The component renders, and `src/index.css` gives it the theme of the application. */
export const RendersUnderTheTheme: Story = {};

/**
 * PU1 asks for visible labelling of every candidate claim, and the review surface will carry it.
 * The assertion reads `data-variant`, and not a class name and not a colour. The attribute is
 * the contract of the component, and the classes are its interior.
 *
 * The `expect` of `storybook/test` is instrumented, so each matcher returns a promise and needs
 * `await`. It is not the `expect` of Vitest, which is synchronous. Remove the `await` and
 * `no-floating-promises` fails the check. Without that rule the assertion resolves after the
 * test has already passed.
 */
export const VariantReachesTheDom: Story = {
  args: { variant: 'destructive' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('candidate')).toHaveAttribute('data-variant', 'destructive');
  },
};
