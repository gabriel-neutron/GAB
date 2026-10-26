import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent text-body-sm whitespace-nowrap transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] outline-none select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:text-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/85 disabled:bg-surface-secondary',
        outline:
          'border-input bg-transparent text-foreground hover:bg-surface-secondary aria-expanded:bg-surface-secondary',
        secondary:
          'disabled:bg-surface-secondary bg-surface-secondary text-foreground hover:bg-border aria-expanded:bg-border',
        ghost: 'text-foreground hover:bg-surface-secondary aria-expanded:bg-surface-secondary',
        destructive:
          'border-destructive bg-transparent text-destructive hover:bg-surface-secondary',
        link: 'h-auto rounded-none border-0 border-b-border bg-transparent px-0 pb-0.5 text-foreground hover:border-b-foreground border-b',
      },
      size: {
        default: 'h-8 gap-2 px-3.5',
        xs: 'h-6 gap-1.5 px-2 text-data',
        sm: 'h-7 gap-1.5 px-2.5',
        lg: 'h-8 gap-2 px-3.5',
        icon: 'size-8',
        'icon-xs': 'size-6',
        'icon-sm': 'size-7',
        'icon-lg': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
