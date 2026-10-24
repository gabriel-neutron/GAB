import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent } from 'storybook/test';

import { ImageryControl } from './imagery-control';

const CAUTION = 'A day with no pass over this place draws nothing. A cloudy day draws clouds.';

const meta = {
  component: ImageryControl,
  args: { imagery: { kind: 'eox', year: 2019 }, onChange: fn() },
} satisfies Meta<typeof ImageryControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AYearOfTheCloudlessCompositeIsSelectedAndCited: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByLabelText('Year')).toHaveValue('2019');
    const citation = canvasElement.querySelector('[data-citation]');
    await expect(citation).toHaveTextContent('2019');
    await expect(citation).toHaveTextContent('10 m');
    await expect(citation).toHaveTextContent('CC BY-NC-SA 4.0');
    await expect(canvasElement.querySelector('[data-credit]')).toHaveTextContent(
      'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2019)',
    );
    await expect(canvas.queryByText(CAUTION)).toBeNull();
  },
};

export const TheTwoEarlyYearsCarryThePlainAttributionLicence: Story = {
  args: { imagery: { kind: 'eox', year: 2017 } },
  play: async ({ canvasElement }) => {
    const citation = canvasElement.querySelector('[data-citation]');
    await expect(citation).toHaveTextContent('CC BY 4.0');
    await expect(citation).not.toHaveTextContent('NC');
  },
};

export const ADayOfTheDailySourceIsSelectedAndWarnsOfAnEmptyPass: Story = {
  args: { imagery: { kind: 'gibs-s30', day: '2026-08-20' } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByLabelText('Day')).toHaveValue('2026-08-20');
    const citation = canvasElement.querySelector('[data-citation]');
    await expect(citation).toHaveTextContent('NASA GIBS HLS Sentinel-2');
    await expect(citation).toHaveTextContent('2026-08-20');
    await expect(citation).toHaveTextContent('30 m');
    await expect(canvasElement.querySelector('[data-credit]')).toHaveTextContent(
      "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).",
    );
    await expect(canvas.getByText(CAUTION)).toBeVisible();
  },
};

export const AStepMovesOneUnitAndTheBoundStopsIt: Story = {
  args: { imagery: { kind: 'eox', year: 2025 } },
  play: async ({ args, canvas }) => {
    // The kit takes the pointer away from a disabled control, so a user event cannot reach it.
    const next = canvas.getByRole('button', { name: 'Next year' });
    await expect(next).toBeDisabled();
    await fireEvent.click(next);
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Previous year' }));
    await expect(args.onChange).toHaveBeenCalledWith({ kind: 'eox', year: 2024 });
  },
};

export const AChangeOfSourceCarriesTheDateOver: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.selectOptions(canvas.getByLabelText('Imagery source'), 'gibs-l30');
    await expect(args.onChange).toHaveBeenCalledWith({ kind: 'gibs-l30', day: '2019-07-01' });
  },
};

// There is no theme decorator in the preview, so the story sets `.dark` itself.
export const TheDarkThemePaintsThePanel: Story = {
  render: (args) => (
    <div className="dark bg-background p-2 text-foreground">
      <ImageryControl {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const citation = canvasElement.querySelector('[data-citation]');
    await expect(citation).toBeVisible();
    await expect(citation).toHaveTextContent('EOX Sentinel-2 cloudless');
  },
};
