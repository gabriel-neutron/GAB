import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { ModeToggle } from '@/shared/mode-toggle';

/**
 * No surface document owns this file. The mode toggle is a shared control, so its contract is its
 * two callers and the rules of the `component` skill: the root route, which reads the theme and
 * passes it, and this file.
 *
 * **The three states are the three themes**, and each export below is one criterion of the
 * control: the state in force is named, `system` is one of the three, and the cycle reaches every
 * state and closes.
 *
 * The control is a button and it changes no theme itself, so a click is proved by what it
 * announces to the caller. The three change stories together prove that every state is reachable
 * from every other one.
 *
 * Each assertion reads a role, an accessible name or a callback. The glyph, the class list and
 * the hue are the interior, and they change with the theme.
 */
const meta = {
  component: ModeToggle,
  args: { theme: 'light', onThemeChange: fn() },
} satisfies Meta<typeof ModeToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The name says the state in force and what a click does. A glyph alone says neither. */
export const TheThemeInForceIsNamed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleName('Theme: light. Change to dark.');
  },
};

/**
 * `system` is a state like the other two, and it reads as one. It is the default of the provider,
 * so it is the state a first-time reader meets.
 */
export const SystemIsOneOfTheThreeStates: Story = {
  args: { theme: 'system' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleName(
      'Theme: system. Change to light.',
    );
  },
};

/** A callback names what happened. The control writes no theme: the caller inside the provider does. */
export const TheCycleReachesDark: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('dark');
  },
};

/** The second step of the cycle. `system` is two clicks from `light`, and it is never skipped. */
export const TheCycleReachesSystem: Story = {
  args: { theme: 'dark' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('system');
  },
};

/**
 * The cycle closes, so every state is reachable from every other one. Without this the control
 * would be a road with an end, and a reader who reached `system` could not return.
 */
export const TheCycleReturnsToLight: Story = {
  args: { theme: 'system' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('light');
  },
};
