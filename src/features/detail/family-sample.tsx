import type { FamilyLook } from './family';

/** A 24px sample of the dash pattern of one relation family. */
export function FamilySample({ look }: { readonly look: FamilyLook }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 4" className={`h-1 w-6 shrink-0 ${look.hue}`}>
      <line
        x1="0"
        y1="2"
        x2="24"
        y2="2"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray={look.dash === '' ? undefined : look.dash}
      />
    </svg>
  );
}
