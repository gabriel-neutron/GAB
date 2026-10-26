import { cn } from '@/shared/lib/utils';

// The shapes of design/system/components/EntityGlyph, in a 14px box centred on 0,0. The chrome
// session should move this file and `family.ts` to `src/shared` once a second feature needs them.
const SHAPE: Readonly<Record<string, string>> = {
  vessel: 'M0,-6 L6,5 L-6,5Z',
  port: 'M-5.5,-5.5 H-2 V-2.5 H2 V-5.5 H5.5 V5.5 H-5.5Z',
  facility: 'M-5,-5 H5 V5 H-5Z',
  bank: 'M0,-6.5 L6.5,-2.5 H-6.5Z M-5.5,-1 H5.5 V5.5 H-5.5Z',
  person: 'M0,-6 L5.2,-3 L5.2,3 L0,6 L-5.2,3 L-5.2,-3Z',
  state_body: 'M0,-6 L5.7,-1.9 L3.5,4.9 L-3.5,4.9 L-5.7,-1.9Z',
  legal_act: 'M-4.5,-6 H2 L4.5,-3.5 V6 H-4.5Z',
  military_unit: 'M0,-6.5 L6.5,0 L0,6.5 L-6.5,0Z',
  event: 'M0,-6.5 L1.8,-1.8 L6.5,0 L1.8,1.8 L0,6.5 L-1.8,1.8 L-6.5,0 L-1.8,-1.8Z',
};

// Whole class names, so Tailwind finds each one.
const HUE: Readonly<Record<string, string>> = {
  vessel: 'text-entity-vessel',
  port: 'text-entity-port',
  facility: 'text-entity-facility',
  company: 'text-entity-company',
  bank: 'text-entity-bank',
  person: 'text-entity-person',
  state_body: 'text-entity-state-body',
  legal_act: 'text-entity-legal-act',
  military_unit: 'text-entity-military-unit',
  event: 'text-entity-event',
};

export interface EntityGlyphProps {
  /** The type key of the vocabulary. A key the design system has no shape for reads as unknown. */
  readonly type: string;
  /** Hollow marks a candidate, filled marks promoted evidence. */
  readonly candidate?: boolean;
}

export function EntityGlyph({ type, candidate = false }: EntityGlyphProps) {
  const shape = SHAPE[type];
  const paint = {
    fill: candidate ? 'none' : 'currentColor',
    stroke: 'currentColor',
    strokeWidth: candidate ? 1.5 : 0,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="-7 -7 14 14"
      className={cn('size-3.5 shrink-0 overflow-visible', HUE[type] ?? 'text-entity-unknown')}
    >
      {type === 'company' ? (
        <circle r="5.5" {...paint} />
      ) : shape === undefined ? (
        <circle r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
      ) : (
        <path d={shape} {...paint} />
      )}
    </svg>
  );
}
