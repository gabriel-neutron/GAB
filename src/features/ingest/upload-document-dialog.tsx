import { useId, useState } from 'react';
import { Dialog } from 'radix-ui';

import type { DocumentProvider } from '@/shared/read/model';
import { ExtractionControl } from '@/shared/extraction-control';
import { SaidLine } from '@/shared/said-line';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import { sendUpload, uploadSaid, type UploadState } from './upload';
import { BLANK_UPLOAD, readUploadDraft, titleOf, type UploadForm } from './upload-draft';

interface UploadDocumentDialogProps {
  /** The providers a document may name. The route reads them, and this file reads nothing. */
  readonly providers: readonly DocumentProvider[];
  /** Read the record again, so every surface draws the new document. The route holds the router. */
  readonly onStored: (documentId: string) => Promise<void>;
}

const IDLE: UploadState = { step: 'idle' };

// The types the text door reads. The writer refuses any other, and the picker shows these first.
const READABLE = '.pdf,.html,.htm,.txt,.md,.csv';

// A modal is a true overlay, which is the one place the theme permits a shadow.
const OVERLAY = 'fixed inset-0 z-50 bg-background/80';
const PANEL =
  'fixed top-1/2 left-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 space-y-2 border border-border bg-popover p-2 text-popover-foreground shadow-md';

const BOX = 'h-6 rounded-none px-1.5 py-0 text-xs md:text-xs';
// The kit has no native select. The `focus-visible` recipe is the kit's own, copied whole.
const CHOOSER =
  'h-6 w-full min-w-0 rounded-none border border-input bg-transparent px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';
const CAPTION = 'block text-small/4 tracking-caps text-label uppercase';
const SENTENCE = 'block min-w-0 text-small/4 text-label';

const SAYS = 'The upload of the file';

export function UploadDocumentDialog({ providers, onStored }: UploadDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UploadForm>(BLANK_UPLOAD);
  const [state, setState] = useState<UploadState>(IDLE);
  const fileBox = useId();
  const titleBox = useId();
  const uriBox = useId();
  const dayBox = useId();
  const providerBox = useId();
  const costBox = useId();

  const draft = readUploadDraft(form);
  const working = state.step === 'working';
  const done = state.step === 'done';

  // Each opening starts at a blank form, so a file chosen days ago is never sent by mistake.
  const onOpenChange = (next: boolean): void => {
    setOpen(next);
    setForm(BLANK_UPLOAD);
    setState(IDLE);
  };

  // An edit after an answer starts a new upload, so the old answer leaves the screen.
  const edit = (next: UploadForm): void => {
    setForm(next);
    if (!working) setState(IDLE);
  };

  // A second click while one upload is in flight sends the file twice, so the step guards as
  // well as the button.
  const onUpload = (): void => {
    if (!draft.ready || working) return;
    setState({ step: 'working' });
    void sendUpload(draft.file, draft.fields).then(async (answer) => {
      setState(answer);
      if (answer.step === 'done' && answer.document === 'stored') await onStored(answer.documentId);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="xs">
          Upload a document
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={PANEL}>
          <Dialog.Title className="text-base">Upload a document</Dialog.Title>
          <Dialog.Description className={SENTENCE}>
            The file is stored once, with the day it was retrieved. A claim it holds is proposed
            later, and cites it.
          </Dialog.Description>

          <div className="space-y-0.5">
            <label htmlFor={fileBox} className={CAPTION}>
              File
            </label>
            <Input
              id={fileBox}
              type="file"
              accept={READABLE}
              className={BOX}
              disabled={working}
              onChange={(event) => {
                const file = event.target.files?.item(0) ?? null;
                const title = form.title === '' && file !== null ? titleOf(file) : form.title;
                edit({ ...form, file, title });
              }}
            />
          </div>

          <div className="space-y-0.5">
            <label htmlFor={titleBox} className={CAPTION}>
              Title
            </label>
            <Input
              id={titleBox}
              className={BOX}
              value={form.title}
              disabled={working}
              onChange={(event) => {
                edit({ ...form, title: event.target.value });
              }}
            />
          </div>

          <div className="space-y-0.5">
            <label htmlFor={uriBox} className={CAPTION}>
              Address where the file comes from
            </label>
            <Input
              id={uriBox}
              type="url"
              className={BOX}
              value={form.uri}
              disabled={working}
              onChange={(event) => {
                edit({ ...form, uri: event.target.value });
              }}
            />
          </div>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <label htmlFor={dayBox} className={CAPTION}>
                Retrieved on
              </label>
              <Input
                id={dayBox}
                type="date"
                className={BOX}
                value={form.retrievedAt}
                disabled={working}
                onChange={(event) => {
                  edit({ ...form, retrievedAt: event.target.value });
                }}
              />
            </div>

            <div className="w-28 space-y-0.5">
              <label htmlFor={costBox} className={CAPTION}>
                Cost in euros
              </label>
              <Input
                id={costBox}
                inputMode="decimal"
                className={BOX}
                value={form.cost}
                disabled={working}
                onChange={(event) => {
                  edit({ ...form, cost: event.target.value });
                }}
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <label htmlFor={providerBox} className={CAPTION}>
              Provider
            </label>
            <select
              id={providerBox}
              className={CHOOSER}
              value={form.providerId}
              disabled={working}
              onChange={(event) => {
                edit({ ...form, providerId: event.target.value });
              }}
            >
              <option value="">No provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.licence})
                </option>
              ))}
            </select>
          </div>

          <SaidLine said={uploadSaid(state, draft)} label={SAYS} />

          {state.step === 'done' ? (
            <ExtractionControl key={state.documentId} documentId={state.documentId} />
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              disabled={!draft.ready || working || done}
              onClick={onUpload}
            >
              Upload
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" size="xs">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
