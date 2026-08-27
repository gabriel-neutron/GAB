import { useId, useState } from 'react';
import { Dialog } from 'radix-ui';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import { createEntity, creationWords, type CreateState } from './creation';
import { readEntityDraft, type EntityForm } from './entity-draft';

export interface CreateEntityDialogProps {
  /** Read the record again, so every surface draws what landed. The route holds the router. */
  readonly onCreated: (entityId: string) => Promise<void>;
  /** Open the entity that was made. The route holds the router, and this file holds no address. */
  readonly onOpenEntity: (entityId: string) => void;
}

const BLANK: EntityForm = { type: '', label: '' };
const IDLE: CreateState = { step: 'idle' };

// A modal is a true overlay, which is the one place the theme permits a shadow.
const OVERLAY = 'fixed inset-0 z-50 bg-background/80';
const PANEL =
  'fixed top-1/2 left-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 space-y-2 border border-border bg-popover p-2 text-popover-foreground shadow-md';

const BOX = 'h-6 rounded-none px-1.5 py-0 text-xs md:text-xs';
const CAPTION = 'block text-small/4 tracking-caps text-label uppercase';
const SENTENCE = 'block min-w-0 text-small/4 text-label';

export function CreateEntityDialog({ onCreated, onOpenEntity }: CreateEntityDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntityForm>(BLANK);
  const [state, setState] = useState<CreateState>(IDLE);
  const typeBox = useId();
  const labelBox = useId();

  const draft = readEntityDraft(form);
  const working = state.step === 'working';
  const made = state.step === 'signed' ? state.entityId : null;

  // Each opening starts at a blank form. A name typed three days ago and left in a closed
  // dialog is worse than one that was lost, because nothing on the screen says how old it is.
  const onOpenChange = (next: boolean): void => {
    setOpen(next);
    setForm(BLANK);
    setState(IDLE);
  };

  // A create is an event handler and never an effect. A second click while one act is in flight
  // writes a second entity, so the step guards as well as the button.
  const onCreate = (): void => {
    if (!draft.ready || working) return;
    const act = draft.act;
    setState({ step: 'working' });
    void createEntity(act).then(async (answer) => {
      setState(answer);
      if (answer.step !== 'signed') return;
      await onCreated(answer.entityId);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="xs">
          New entity
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={PANEL}>
          <Dialog.Title className="text-base">New entity</Dialog.Title>
          <Dialog.Description className={SENTENCE}>
            The entity is signed manual, and it carries no geometry and no claim yet.
          </Dialog.Description>

          <div className="space-y-0.5">
            <label htmlFor={typeBox} className={CAPTION}>
              Type
            </label>
            <Input
              id={typeBox}
              className={BOX}
              value={form.type}
              disabled={working}
              onChange={(event) => {
                setForm({ type: event.target.value, label: form.label });
              }}
            />
          </div>

          <div className="space-y-0.5">
            <label htmlFor={labelBox} className={CAPTION}>
              Name
            </label>
            <Input
              id={labelBox}
              className={BOX}
              value={form.label}
              disabled={working}
              onChange={(event) => {
                setForm({ type: form.type, label: event.target.value });
              }}
            />
          </div>

          {/* The result of an act must reach a screen reader without a second look at the page. */}
          <p role="status" className={SENTENCE}>
            {creationWords(state, draft)}
          </p>

          <div className="flex items-center gap-2">
            {made === null ? (
              <Button type="button" size="xs" disabled={!draft.ready || working} onClick={onCreate}>
                Create
              </Button>
            ) : (
              <Button
                type="button"
                size="xs"
                onClick={() => {
                  onOpenChange(false);
                  onOpenEntity(made);
                }}
              >
                Open the new entity
              </Button>
            )}
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
