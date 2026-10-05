import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import { UploadDocumentDialog } from './upload-document-dialog';

const PROVIDERS = [
  { id: 'mca21', name: 'MCA21, India', licence: 'paid-filing' },
  { id: 'acra', name: 'ACRA BizFile+, Singapore', licence: 'paid-filing' },
] as const;

const KNOWN_ID = 'doc_4f1c2a9e7b30';

const onStored = fn(() => Promise.resolve());

const filing = (): File =>
  new File(['%PDF-1.7 the annual return of a company'], 'mgt-7.pdf', { type: 'application/pdf' });

// Origin of the number: one byte over the cap of the writer, which is 20 MiB.
const tooLarge = (): File =>
  new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'scan.pdf', { type: 'application/pdf' });

const doorAnswering = (body: unknown, status = 200): void => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

// The dialog is portalled to the body, so its content stands outside the canvas element.
const panel = () => within(document.body);

const openIt = async (): Promise<void> => {
  await userEvent.click(panel().getByRole('button', { name: 'Upload a document' }));
};

const fillAll = async (file: File): Promise<void> => {
  await userEvent.upload(panel().getByLabelText('File'), file);
  await userEvent.type(
    panel().getByLabelText('Purchase or source page'),
    'https://www.mca.gov.in/x',
  );
  await userEvent.type(panel().getByLabelText('Retrieved on'), '2026-10-01');
  await userEvent.selectOptions(panel().getByLabelText('Provider'), 'mca21');
  await userEvent.type(panel().getByLabelText('Cost in euros'), '12.50');
};

const meta = {
  component: UploadDocumentDialog,
  args: { providers: PROVIDERS, onStored },
  // A story that takes the door gives it back, so a play that fails leaves no stub behind.
  beforeEach: () => () => {
    restoreAllMocks();
  },
} satisfies Meta<typeof UploadDocumentDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnEmptyFormSendsNothing: Story = {
  play: async () => {
    await openIt();
    await expect(panel().getByRole('button', { name: 'Upload' })).toBeDisabled();
    await expect(panel().getByRole('status')).toHaveTextContent('Choose the file to upload.');
  },
};

// The name of the file proposes the title, and every field the row records is filled.
export const AFilledFormIsReady: Story = {
  play: async () => {
    await openIt();
    await fillAll(filing());
    await expect(panel().getByLabelText('Title')).toHaveValue('mgt-7.pdf');
    await expect(panel().getByRole('status')).toHaveTextContent('Ready to upload.');
    await expect(panel().getByRole('button', { name: 'Upload' })).toBeEnabled();
  },
};

export const AFormWithNoDateIsRefused: Story = {
  play: async () => {
    await openIt();
    await userEvent.upload(panel().getByLabelText('File'), filing());
    await expect(panel().getByRole('status')).toHaveTextContent(
      'Write the day the file was retrieved.',
    );
    await expect(panel().getByRole('button', { name: 'Upload' })).toBeDisabled();
  },
};

export const AFileOverTheCapIsRefused: Story = {
  play: async () => {
    await openIt();
    await userEvent.upload(panel().getByLabelText('File'), tooLarge());
    await userEvent.type(panel().getByLabelText('Retrieved on'), '2026-10-01');
    await expect(panel().getByRole('status')).toHaveTextContent('larger than 20 MiB');
    await expect(panel().getByRole('button', { name: 'Upload' })).toBeDisabled();
  },
};

// The same bytes are one document. The answer names the row that holds them, and writes nothing.
export const AKnownFileNamesItsDocument: Story = {
  play: async () => {
    doorAnswering({ state: 'known', documentId: KNOWN_ID, emptyPages: [] });
    onStored.mockClear();
    await openIt();
    await fillAll(filing());
    await userEvent.click(panel().getByRole('button', { name: 'Upload' }));

    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent(
        `The file is already in the record as document ${KNOWN_ID}.`,
      );
    });
    await expect(onStored).not.toHaveBeenCalled();
  },
};

// A scan holds no text that can be read. It is stored, and its empty pages are named.
export const AStoredScanNamesItsEmptyPages: Story = {
  play: async () => {
    doorAnswering({ state: 'stored', documentId: KNOWN_ID, emptyPages: [1, 2] });
    onStored.mockClear();
    await openIt();
    await fillAll(filing());
    await userEvent.click(panel().getByRole('button', { name: 'Upload' }));

    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent(
        'Pages 1, 2 hold no text that can be read.',
      );
    });
    await expect(onStored).toHaveBeenCalledWith(KNOWN_ID);
  },
};

// The writer refused the file. Its sentence reaches the screen, and no document is named.
export const ARefusalOfTheWriterIsShown: Story = {
  play: async () => {
    doorAnswering({ refusal: 'providerId: the record holds no provider of that name' }, 422);
    await openIt();
    await fillAll(filing());
    await userEvent.click(panel().getByRole('button', { name: 'Upload' }));

    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent(
        'No document was stored: providerId: the record holds no provider of that name.',
      );
    });
  },
};
