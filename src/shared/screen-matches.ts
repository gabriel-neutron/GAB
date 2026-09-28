import { nameHoldsQuery } from '@/shared/name-match';

interface Named {
  readonly id: string;
  readonly label: string;
}

export interface ScreenMatches {
  readonly shown: readonly Named[];
  readonly more: number;
}

// Origin: a tuning value. Eight rows fit under the header field on a laptop screen, and a longer
// list is the work of the rail.
const SHOWN_CAP = 8;

// Departure: an empty filter matches every name in the rail, and it matches none here, because
// a list under an empty field is a list that nobody asked for.
export function matchesNamed(named: readonly Named[], query: string): ScreenMatches {
  if (query.trim() === '') return { shown: [], more: 0 };
  const matching = named.filter((item) => nameHoldsQuery(item.label, query));
  return { shown: matching.slice(0, SHOWN_CAP), more: Math.max(0, matching.length - SHOWN_CAP) };
}

export function nextActive(active: number | null, step: 1 | -1, count: number): number | null {
  if (count === 0) return null;
  if (active === null) return step === 1 ? 0 : count - 1;
  return (active + step + count) % count;
}
