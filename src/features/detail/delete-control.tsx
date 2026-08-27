import { useState } from 'react';

import { Button } from '@/shared/ui/button';

export interface DeleteControlProps {
  /** What is destroyed, in the words of the record. The question names it, so a mis-click on a
   * row cannot destroy evidence that the analyst never read. */
  readonly name: string;
  readonly busy: boolean;
  readonly onDelete: () => void;
}

const ASKING = 'flex min-w-0 items-center gap-2';
const QUESTION = 'min-w-0 truncate text-small/4 text-destructive';

export function DeleteControl({ name, busy, onDelete }: DeleteControlProps) {
  // The question dies with the view. A confirmation that survived a reload would destroy a row
  // that the analyst never looked at.
  const [asked, setAsked] = useState(false);

  if (!asked) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="xs"
        disabled={busy}
        aria-label={`Delete ${name}`}
        onClick={() => {
          setAsked(true);
        }}
      >
        Delete
      </Button>
    );
  }

  return (
    <span className={ASKING}>
      <span className={QUESTION} title={name}>
        {`Delete ${name}? No door brings it back.`}
      </span>
      <Button
        type="button"
        variant="destructive"
        size="xs"
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
        variant="outline"
        size="xs"
        aria-label={`Keep ${name}`}
        onClick={() => {
          setAsked(false);
        }}
      >
        Keep it
      </Button>
    </span>
  );
}
