import { useId, useState } from 'react';
import { Dialog } from 'radix-ui';

import { cn } from '@/shared/lib/utils';
import { SaidLine } from '@/shared/said-line';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

import { giveLead, leadScreen, readLeadView, type LeadView } from './lead';

const UNREAD: LeadView = { step: 'unread' };

// A modal is a true overlay, which is the one place the theme permits a shadow.
const OVERLAY = 'fixed inset-0 z-50 bg-background/80';
const PANEL =
  'fixed top-1/2 left-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 space-y-2 border border-border bg-popover p-2 text-popover-foreground shadow-md';

const BOX = 'min-h-12 rounded-none px-1.5 py-1 text-xs md:text-xs';
const CAPTION = 'block text-small/4 tracking-caps text-label uppercase';
const SENTENCE = 'block min-w-0 text-small/4 text-label';
const LIST = 'max-h-64 divide-y divide-border overflow-y-auto border-y border-border';

const SAYS = 'The leads';

/** The operator gives a lead to the worker, and reads what each lead stored. */
export function LeadDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [view, setView] = useState<LeadView>(UNREAD);
  const leadBox = useId();
  const screen = leadScreen(view, text);
  const working = view.step === 'working';

  // A second click while one request is in flight starts nothing twice: the step guards as well
  // as the button.
  const run = (work: () => Promise<LeadView>): void => {
    if (working) return;
    setView({ step: 'working' });
    void work().then(setView);
  };

  // Each opening reads the leads again, so the dialog shows what the worker stored since.
  const onOpenChange = (next: boolean): void => {
    setOpen(next);
    setText('');
    setView(UNREAD);
    if (next) run(() => readLeadView());
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="xs">
          Give a lead
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={PANEL}>
          <Dialog.Title className="text-base">Give a lead</Dialog.Title>
          <Dialog.Description className={SENTENCE}>
            The worker searches the web and the news, stores each new page and queues its
            extraction. It proposes nothing. The lead stays private.
          </Dialog.Description>

          <div className="space-y-0.5">
            <label htmlFor={leadBox} className={CAPTION}>
              Lead
            </label>
            <Textarea
              id={leadBox}
              className={BOX}
              value={text}
              maxLength={2000}
              disabled={working}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </div>

          <SaidLine said={screen.said} label={SAYS} />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              disabled={!screen.canStart}
              onClick={() => {
                run(() => giveLead(text));
              }}
            >
              Start the lead
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={working}
              onClick={() => {
                run(() => readLeadView());
              }}
            >
              Read the leads
            </Button>
          </div>

          {screen.lines.length > 0 ? (
            <ul aria-label="Leads" className={LIST}>
              {screen.lines.map((line) => (
                <li key={line.id} className="space-y-0.5 py-1 text-xs">
                  <p className="min-w-0 break-words">{line.lead}</p>
                  <p className={SENTENCE}>{line.state}</p>
                  {line.documents.length > 0 ? (
                    <ul aria-label="Stored pages" className="pl-2">
                      {line.documents.map((document) => (
                        <li
                          key={document.id}
                          title={document.title}
                          className={cn(SENTENCE, 'truncate')}
                        >
                          {document.title}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
