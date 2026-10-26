import { cn } from '@/shared/lib/utils';

// The paths are those of `design/system/components/EntityGlyph`, in a 14px box centred on 0,0.
const SHAPES = {
  vessel: 'M0,-6 L6,5 L-6,5Z',
  port: 'M-5.5,-5.5 H-2 V-2.5 H2 V-5.5 H5.5 V5.5 H-5.5Z',
  facility: 'M-5,-5 H5 V5 H-5Z',
  bank: 'M0,-6.5 L6.5,-2.5 H-6.5Z M-5.5,-1 H5.5 V5.5 H-5.5Z',
  person: 'M0,-6 L5.2,-3 L5.2,3 L0,6 L-5.2,3 L-5.2,-3Z',
  'state-body': 'M0,-6 L5.7,-1.9 L3.5,4.9 L-3.5,4.9 L-5.7,-1.9Z',
  'legal-act': 'M-4.5,-6 H2 L4.5,-3.5 V6 H-4.5Z',
  'military-unit': 'M0,-6.5 L6.5,0 L0,6.5 L-6.5,0Z',
  event: 'M0,-6.5 L1.8,-1.8 L6.5,0 L1.8,1.8 L0,6.5 L-1.8,1.8 L-6.5,0 L-1.8,-1.8Z',
} as const;

type ShapedType = keyof typeof SHAPES;

const isShaped = (type: string): type is ShapedType => type in SHAPES;

/** A vocabulary key (`state_body`) or a token name (`state-body`) reads the same. */
const normal = (type: string): string => type.replaceAll('_', '-');

export interface EntityGlyphProps {
  /** The vocabulary key of the type. A type with no shape draws the dashed circle of `unknown`. */
  readonly type: string;
  /** Hollow is a candidate: fill means evidence, outline means machine. */
  readonly candidate?: boolean | undefined;
  /** Pixels. The list size is 14; a canvas legend may ask for more. */
  readonly size?: number | undefined;
  readonly className?: string | undefined;
}

/** The mark of one entity type: its shape and its hue, the same on every surface. The hue is the
 * `entity-*` token, so it follows the theme. The glyph is decoration: the name stands beside it. */
export function EntityGlyph({ type, candidate = false, size = 14, className }: EntityGlyphProps) {
  const key = normal(type);
  const shape = isShaped(key) ? key : null;
  const round = key === 'company';
  const hue = `var(--entity-${shape !== null || round ? key : 'unknown'})`;
  const hollow = candidate || (shape === null && !round);
  const common = { stroke: hue, strokeWidth: hollow ? 1.5 : 0, fill: hollow ? 'none' : hue };
  return (
    <svg
      aria-hidden="true"
      viewBox="-7 -7 14 14"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
    >
      {shape !== null ? <path d={SHAPES[shape]} {...common} /> : null}
      {round ? <circle r={5.5} {...common} /> : null}
      {shape === null && !round ? <circle r={5} strokeDasharray="2 2" {...common} /> : null}
    </svg>
  );
}
