import { cn } from '@/shared/lib/utils';

// The dash patterns of `design/system/components/RelationLine`, in pixels along the line.
export const FAMILY_DASH = {
  ownership: undefined,
  designation: '12 5',
  operation: '5 4',
  transfer: '12 4 2 4',
  other: '2 5',
} as const;

export type RelationLineFamily = keyof typeof FAMILY_DASH;

export interface RelationLineProps {
  readonly family: RelationLineFamily;
  readonly className?: string | undefined;
}

/** The 32px sample of one relation family, for a legend or a rail row: the dash pattern and the
 * `relation-*` hue. The pattern carries the family alone where the hues are hard to tell apart. */
export function RelationLine({ family, className }: RelationLineProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 8"
      width={32}
      height={8}
      className={cn('shrink-0', className)}
    >
      <line
        x1={0}
        x2={32}
        y1={4}
        y2={4}
        fill="none"
        strokeWidth={2}
        stroke={`var(--relation-${family})`}
        strokeDasharray={FAMILY_DASH[family]}
      />
    </svg>
  );
}
