import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor } from 'storybook/test';

import { ExtractionControl } from './extraction-control';

const DOCUMENT = 'doc_4f1c2a9e7b30';
const JOB = '5b1e0c7a-2d43-4f8e-9a61-3c7d2e8f0b14';
const AGAIN = '9e2a4c61-7b05-4d3f-8c12-6a0f1e5d3b27';

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const jobsOf = (...jobs: readonly Record<string, unknown>[]): Reply => ({
  status: 200,
  body: { jobs },
});

const job = (status: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: JOB,
  kind: 'extract_text',
  status,
  reason: null,
  refused: null,
  proposals: 0,
  ...extra,
});

const asked: string[] = [];

// The writer answers each door in turn, and a Response body is read once, so each answer is new.
const writerAnswers = (...replies: readonly Reply[]): void => {
  asked.length = 0;
  let next = 0;
  spyOn(globalThis, 'fetch').mockImplementation((address) => {
    asked.push(typeof address === 'string' ? address : '');
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
  component: ExtractionControl,
  args: { documentId: DOCUMENT },
  beforeEach: () => () => {
    restoreAllMocks();
  },
} satisfies Meta<typeof ExtractionControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheOperatorStartsAnExtraction: Story = {
  play: async ({ canvas }) => {
    writerAnswers({ status: 200, body: { jobId: JOB } }, jobsOf(job('queued')));
    await userEvent.click(canvas.getByRole('button', { name: 'Extract claims' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'The extraction waits in the queue.',
      );
    });
    await expect(asked).toStrictEqual(['/write/queue-extraction', '/write/document-jobs']);
  },
};

export const ARunningExtractionSaysSo: Story = {
  play: async ({ canvas }) => {
    writerAnswers(jobsOf(job('running')));
    await userEvent.click(canvas.getByRole('button', { name: 'Read the status' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('The extraction runs.');
    });
  },
};

export const ADoneExtractionCountsItsProposalsAndItsRefusedParts: Story = {
  play: async ({ canvas }) => {
    writerAnswers(
      jobsOf(
        job('done', { proposals: 3, refused: '2 parts refused: item a: the page has no excerpt' }),
      ),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Read the status' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'The extraction is done. It made 3 proposals. 2 parts refused: item a: the page has no ' +
          'excerpt.',
      );
    });
    // The record refuses a second open job, and a done document can be read again.
    await expect(canvas.getByRole('button', { name: 'Extract claims' })).toBeEnabled();
  },
};

export const AQueuedExtractionReadsItsStatusAgainByItself: Story = {
  play: async ({ canvas }) => {
    writerAnswers(jobsOf(job('queued')), jobsOf(job('running')), jobsOf(job('done')));
    await userEvent.click(canvas.getByRole('button', { name: 'Read the status' }));

    await waitFor(
      async () => {
        await expect(canvas.getByRole('status')).toHaveTextContent(
          'The extraction is done. It made 0 proposals.',
        );
      },
      { timeout: 15_000 },
    );
    await expect(asked).toStrictEqual([
      '/write/document-jobs',
      '/write/document-jobs',
      '/write/document-jobs',
    ]);
  },
};

export const ALostAnswerIsADoubt: Story = {
  play: async ({ canvas }) => {
    writerAnswers({
      status: 502,
      body: { doubt: 'the record gave no answer to read, and the act may have run whole' },
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Extract claims' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('alert')).toHaveTextContent(
        'The state of the extraction is not known. The write service did not confirm the act, ' +
          'and the act may have run whole.',
      );
    });
  },
};

export const AFailedExtractionShowsItsReasonAndIsQueuedAgain: Story = {
  play: async ({ canvas }) => {
    writerAnswers(
      jobsOf(job('failed', { reason: 'the model did not answer' })),
      { status: 200, body: { jobId: AGAIN } },
      jobsOf(job('queued', { id: AGAIN }), job('failed', { reason: 'the model did not answer' })),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Read the status' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'The extraction failed: the model did not answer.',
      );
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Queue again' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'The extraction waits in the queue.',
      );
    });
  },
};

export const ADocumentWithNoExtractionSaysSo: Story = {
  play: async ({ canvas }) => {
    writerAnswers(jobsOf());
    await userEvent.click(canvas.getByRole('button', { name: 'Read the status' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'No extraction ran for this document.',
      );
    });
    await expect(canvas.getByRole('button', { name: 'Extract claims' })).toBeEnabled();
  },
};

export const ARefusalOfTheWriterIsShown: Story = {
  play: async ({ canvas }) => {
    const refusal = `document ${DOCUMENT} has a job of kind extract_text that is queued or runs already`;
    writerAnswers({ status: 422, body: { refusal } });
    await userEvent.click(canvas.getByRole('button', { name: 'Extract claims' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        `Nothing was written. ${refusal}.`,
      );
    });
  },
};
