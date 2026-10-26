import type { ReactNode, RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { landOnPanel, returnPanelFocus } from '@/shared/panel-focus';
import { PHONE_SHEET, SheetClose } from '@/shared/phone-sheet';

interface SelectionPanelProps {
  /** The key of what the panel shows, or null when nothing is selected and the panel is closed. */
  readonly shown: string | null;
  /** The reader closed the panel, with the close control or with Escape. */
  readonly onClose: () => void;
  /** Where the focus goes when the control that opened the panel is gone. The panel, if absent. */
  readonly fallback?: RefObject<HTMLElement | null> | undefined;
  /** The place of the panel in the grid of the page. */
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/** The card of the selection beside a canvas: a column on a wide screen, a bottom sheet on a phone.
 * The graph and the map share it, so the two pages close, focus and stack the same way. */
export function SelectionPanel({
  shown,
  onClose,
  fallback,
  className,
  children,
}: SelectionPanelProps) {
  return (
    <div
      role="region"
      aria-label="Card of the selection"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || shown === null) return;
        onClose();
        event.currentTarget.tabIndex = -1;
        returnPanelFocus(fallback?.current ?? event.currentTarget);
      }}
      className={cn(
        'min-h-0 min-w-0 overflow-y-auto overscroll-contain border-border bg-surface',
        PHONE_SHEET,
        shown === null ? 'hidden' : null,
        className,
      )}
    >
      {shown === null ? null : <SheetClose onClose={onClose} fallback={fallback} />}
      {children}
      {/* The key mounts a new marker for each selection, so the focus lands on each new card. */}
      {shown === null ? null : <span key={shown} ref={landOnPanel} hidden />}
    </div>
  );
}
