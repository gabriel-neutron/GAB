import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** These are sizes this repository declares, and the merge knows the built-in scale only. It
 * files an unknown `text-*` under colour, so a colour beside it deleted the size in silence. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-small',
        'text-body-sm',
        'text-body',
        'text-heading-sm',
        'text-heading',
        'text-heading-lg',
        'text-display',
        'text-caption',
        'text-data',
        'text-data-lg',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
