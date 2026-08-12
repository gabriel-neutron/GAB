import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

/**
 * Vendored from shadcn, in the `radix-nova` style of the other four parts of the kit. It is
 * added on the instruction of the operator for `docs/detail-surface.md` §4.5: the sidebar has no
 * room for a rail, so a mark opens its source in a popover.
 *
 * It takes **no** lint exemption. ADR 0004 §8: `src/shared/ui/` is a pattern that authored code
 * can enter, so the folder is excluded from nothing.
 *
 * The base classes below are the upstream ones. A caller corrects the scale and the radius at the
 * call site with `cn()`, as it does for `Input` and `Button`. **The shadow stays**: rule 6 of the
 * theme permits a shadow on a true overlay, and this is one.
 */
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * The content is portalled to the body, so a scrolling ancestor cannot clip it. That is what
 * makes a popover usable from inside the 24 rem sidebar, which holds its own scroll.
 */
function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/**
 * **`PopoverAnchor` is removed on purpose.** Upstream exports it and nothing here imports it.
 * ADR 0004 §8 gives this folder no lint exemption, so a vendored file carries no dead surface by
 * right. Vendor it again on the day a caller needs an anchor away from the trigger.
 */
export { Popover, PopoverTrigger, PopoverContent };
