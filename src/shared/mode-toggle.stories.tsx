import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { ModeToggle } from '@/shared/mode-toggle';

const meta = {
  component: ModeToggle,
  args: { theme: 'light', onThemeChange: fn() },
} satisfies Meta<typeof ModeToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheThemeInForceIsNamed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleName('Theme: light. Change to dark.');
  },
};

export const SystemIsOneOfTheThreeStates: Story = {
  args: { theme: 'system' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveAccessibleName(
      'Theme: system. Change to light.',
    );
  },
};

export const TheCycleReachesDark: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('dark');
  },
};

export const TheCycleReachesSystem: Story = {
  args: { theme: 'dark' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('system');
  },
};

export const TheCycleReturnsToLight: Story = {
  args: { theme: 'system' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onThemeChange).toHaveBeenCalledWith('light');
  },
};
