import { X } from 'lucide-react';
import type { RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { returnPanelFocus } from '@/shared/panel-focus';

// Two exports, one job: a card that is a column on a wide screen and a bottom sheet on a phone.
// The class holds the phone half, and the control closes the card at every width. A phone has no
// column to read the card in, so the card takes the foot of the screen over the map. A true
// overlay may carry a shadow.
export const PHONE_SHEET = cn(
  'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:max-h-[60svh]',
  'max-md:border-t max-md:border-border max-md:bg-background max-md:shadow-md',
);

interface SheetCloseProps {
  /** The reader closed the sheet. */
  readonly onClose: () => void;
  /** Where the focus goes when the control that opened the card is gone. The card, if absent. */
  readonly fallback?: RefObject<HTMLElement | null> | undefined;
}

/** The close control of a panel. It shows at every width. A panel that a key opened gives the
 * focus back to the control that opened it. */
export function SheetClose({ onClose, fallback }: SheetCloseProps) {
  return (
    <div className="sticky top-0 z-10 flex justify-end border-b border-border bg-background p-1">
      <button
        type="button"
        onClick={(event) => {
          const card = event.currentTarget.closest<HTMLElement>('[role="region"]');
          onClose();
          const back = fallback?.current ?? card;
          if (card !== null && back === card) card.tabIndex = -1;
          returnPanelFocus(back);
        }}
        className={cn(
          'flex h-6 items-center gap-1 border border-input bg-background px-1.5 text-small/4',
          'transition-colors duration-100 hover:bg-muted',
          'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      >
        <X size={14} aria-hidden="true" />
        Close panel
      </button>
    </div>
  );
}
