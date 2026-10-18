import { cn } from '@/shared/lib/utils';

// A control of the island. A state change stays under the 120 ms ceiling, and nothing else
// animates. The focus recipe is the one of the kit.
export const CONTROL = cn(
  'flex h-6 items-center gap-1.5 border border-input bg-background px-1.5 text-small/4',
  'transition-colors duration-100 hover:bg-muted',
  'aria-pressed:bg-foreground aria-pressed:text-background',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:opacity-100 disabled:text-muted-foreground',
);
