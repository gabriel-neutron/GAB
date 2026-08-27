import { Button } from '@/shared/ui/button';

export interface SaveBarProps {
  /** The one sentence of the act. It is derived before it arrives, and this file composes none. */
  readonly sentence: string;
  readonly canSave: boolean;
  readonly onSave: () => void;
}

// Two live regions stand on the detail page, and a reader needs to know which one spoke.
const SAYS = 'The saving of the claims';

export function SaveBar({ sentence, canSave, onSave }: SaveBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!canSave} onClick={onSave}>
        Save
      </Button>
      {/* The result of an act must reach a screen reader without a second look at the page. */}
      <p role="status" aria-label={SAYS} className="min-w-0 text-small/4 text-label">
        {sentence}
      </p>
    </div>
  );
}
