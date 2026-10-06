import { SaidLine } from '@/shared/said-line';
import type { Said } from '@/shared/said';
import { Button } from '@/shared/ui/button';

interface SaveBarProps {
  /** What the act said, and whether it interrupts. Both are derived before they arrive, and
   * this file composes neither. */
  readonly said: Said;
  readonly canSave: boolean;
  readonly onSave: () => void;
}

// Two live regions stand on the detail page, and a reader needs to know which one spoke.
const SAYS = 'The saving of the claims';

export function SaveBar({ said, canSave, onSave }: SaveBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={!canSave} onClick={onSave}>
        Save
      </Button>
      <SaidLine said={said} label={SAYS} />
    </div>
  );
}
