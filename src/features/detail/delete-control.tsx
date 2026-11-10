import { useRef, useState } from 'react';

import { Button } from '@/shared/ui/button';

interface DeleteControlProps {
  /** What is destroyed, in the words of the record. The question names it, so a mis-click on a
   * row cannot destroy evidence that the analyst never read. */
  readonly name: string;
  readonly busy: boolean;
  readonly onDelete: () => void;
}

const ASKING = 'flex min-w-0 flex-wrap items-center gap-2';
const QUESTION = 'min-w-0 text-body-sm break-words text-destructive';

export function DeleteControl({ name, busy, onDelete }: DeleteControlProps) {
  // The question dies with the view. A confirmation that survived a reload would destroy a row
  // that the analyst never looked at.
  const [asked, setAsked] = useState(false);
  // The button that was clicked leaves the screen, so the focus moves to the button that takes its
  // place, and a keyboard does not fall back to the top of the page. Only a click moves it.
  const moveFocus = useRef(false);
  const takeFocus = (element: HTMLButtonElement | null): void => {
    if (element === null || !moveFocus.current) return;
    moveFocus.current = false;
    element.focus();
  };

  if (!asked) {
    return (
      <Button
        type="button"
        variant="destructive"
        disabled={busy}
        aria-label={`Delete ${name}`}
        ref={takeFocus}
        onClick={() => {
          moveFocus.current = true;
          setAsked(true);
        }}
      >
        Delete
      </Button>
    );
  }

  return (
    <span className={ASKING}>
      <span className={QUESTION}>{`Delete ${name}? No door brings it back.`}</span>
      <Button
        type="button"
        variant="destructive"
        disabled={busy}
        aria-label={`Confirm the deletion of ${name}`}
        onClick={() => {
          setAsked(false);
          onDelete();
        }}
      >
        Delete it
      </Button>
      <Button
        type="button"
        variant="secondary"
        aria-label={`Keep ${name}`}
        ref={takeFocus}
        onClick={() => {
          moveFocus.current = true;
          setAsked(false);
        }}
      >
        Keep it
      </Button>
    </span>
  );
}
