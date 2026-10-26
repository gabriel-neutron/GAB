import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** These are sizes this repository declares, and the merge knows the built-in scale only. It
 * files an unknown `text-*` under colour, so a colour beside it deleted the size in silence. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: { 'font-size': ['text-small', 'text-body-sm', 'text-body', 'text-heading-sm'] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
