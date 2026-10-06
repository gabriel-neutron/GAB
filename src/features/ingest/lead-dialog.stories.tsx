import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import { LeadDialog } from './lead-dialog';

const LEAD = 'Intershipping and its vessels';
const JOB = '5b1e0c7a-2d43-4f8e-9a61-3c7d2e8f0b14';

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const leadsOf = (...leads: readonly Record<string, unknown>[]): Reply => ({
  status: 200,
  body: { leads },
});

const lead = (status: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: JOB,
  lead: LEAD,
  by: 'gabriel_app',
  status,
  reason: null,
  documents: [],
  ...extra,
});

const asked: { address: string; body: string }[] = [];

// The writer answers each door in turn, and a Response body is read once, so each answer is new.
const writerAnswers = (...replies: readonly Reply[]): void => {
  asked.length = 0;
  let next = 0;
  spyOn(globalThis, 'fetch').mockImplementation((address, init) => {
    asked.push({
      address: typeof address === 'string' ? address : '',
      body: typeof init?.body === 'string' ? init.body : '',
    });
    const reply = replies[Math.min(next, replies.length - 1)];
    next += 1;
    return Promise.resolve(
      new Response(JSON.stringify(reply?.body), {
        status: reply?.status ?? 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
};

const meta = {
  component: LeadDialog,
  beforeEach: () => () => {
    restoreAllMocks();
  },
} satisfies Meta<typeof LeadDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const opened = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Give a lead' }));
  return within(canvasElement.ownerDocument.body).findByRole('dialog');
};

export const TheOperatorGivesALead: Story = {
  play: async ({ canvasElement }) => {
    writerAnswers(leadsOf(), { status: 200, body: { jobId: JOB } }, leadsOf(lead('queued')));
    const dialog = within(await opened(canvasElement));
    await waitFor(async () => {
      await expect(dialog.getByRole('status')).toHaveTextContent('No lead was given.');
    });

    await userEvent.type(dialog.getByLabelText('Lead'), LEAD);
    await userEvent.click(dialog.getByRole('button', { name: 'Start the lead' }));

    await waitFor(async () => {
      await expect(dialog.getByRole('status')).toHaveTextContent(
        'The lead waits in the queue. 1 lead.',
      );
    });
    await expect(asked.map((one) => one.address)).toStrictEqual([
      '/private/leads',
      '/write/start-lead',
      '/private/leads',
    ]);
    await expect(asked[1]?.body).toBe(JSON.stringify({ lead: LEAD }));
    await expect(dialog.getByRole('list', { name: 'Leads' })).toHaveTextContent(
      'Waits in the queue.',
    );
  },
};

export const ALeadShowsThePagesItStored: Story = {
  play: async ({ canvasElement }) => {
    writerAnswers(
      leadsOf(
        lead('done', {
          documents: [
            { id: 'doc_4f1c2a9e7b30', title: 'Intershipping - UK sanctions list', url: null },
            { id: 'doc_9e2a4c617b05', title: 'Equasis - Nayara', url: null },
          ],
        }),
      ),
    );
    const dialog = within(await opened(canvasElement));

    const leads = await dialog.findByRole('list', { name: 'Leads' });
    await expect(leads).toHaveTextContent('Done. It stored 2 pages.');
    await expect(leads).toHaveTextContent('Intershipping - UK sanctions list');
    await expect(leads).toHaveTextContent('Equasis - Nayara');
  },
};

export const ALeadStoppedByItsBudgetSaysWhy: Story = {
  play: async ({ canvasElement }) => {
    writerAnswers(leadsOf(lead('failed', { reason: 'the token budget of this lead is spent' })));
    const dialog = within(await opened(canvasElement));

    const leads = await dialog.findByRole('list', { name: 'Leads' });
    await expect(leads).toHaveTextContent(
      'Stopped: the token budget of this lead is spent. It stored 0 pages.',
    );
  },
};

export const AnEmptyLeadCannotStart: Story = {
  play: async ({ canvasElement }) => {
    writerAnswers(leadsOf());
    const dialog = within(await opened(canvasElement));

    await expect(dialog.getByRole('button', { name: 'Start the lead' })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Lead'), '   ');
    await expect(dialog.getByRole('button', { name: 'Start the lead' })).toBeDisabled();
  },
};
