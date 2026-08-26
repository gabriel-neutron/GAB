import { Split } from 'lucide-react';

/** Two acts read one key, which is the case the subject was made the unit of review for. Three
 * places draw this mark, and the hue and the glyph of it are decided here once. */
export function ContestedGlyph() {
  return <Split size={14} aria-hidden="true" className="shrink-0 text-dissent" />;
}
