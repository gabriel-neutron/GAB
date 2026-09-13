import { SYMBOL_BOX, type NatoSymbol } from './nato-symbol';

export interface UnitSymbolProps {
  /** The marks the derivation read. Null for an entity that is not a unit, and it draws none. */
  readonly symbol: NatoSymbol | null;
}

// The stroke is heavier than the frame so that a row of dots reads as dots at 20px, and the
// round cap closes each stroke of a cross. Both are the whole graphic, so they sit on the root.
const STROKE = 1.2;

export function UnitSymbol({ symbol }: UnitSymbolProps) {
  if (symbol === null) return null;

  return (
    <svg
      role="img"
      aria-label={symbol.name}
      viewBox={SYMBOL_BOX}
      data-unit-symbol=""
      // An absence is a state a reader must be able to name, so the attribute is always here
      // and it says which of the two states holds.
      data-echelon-mark={symbol.echelon === null ? 'none' : 'drawn'}
      data-domain-mark={symbol.domain === null ? 'none' : 'drawn'}
      className="h-5 w-6 shrink-0 text-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={symbol.frame} />
      {symbol.echelon === null ? null : <path d={symbol.echelon} />}
      {symbol.domain === null ? null : <path d={symbol.domain} />}
    </svg>
  );
}
