import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-sm border border-input bg-transparent px-3 text-body-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted-foreground aria-invalid:border-destructive file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-body-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
