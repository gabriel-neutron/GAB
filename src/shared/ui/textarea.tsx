import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-sm border border-input bg-background px-3 py-2 text-body-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted-foreground aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
