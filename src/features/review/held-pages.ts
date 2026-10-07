import type { Unit, UnitPage } from './unit-page';

// Departure: two exports, one job. Both read the pages of the queue that the screen holds: the
// list that they make, and what the screen reads again after a decision.

/** The units of the pages in their order. A page read again after a decision can reach into the
 * page after it, so a unit shows once, on the first page that holds it. */
export function queueUnits(pages: readonly UnitPage[]): readonly Unit[] {
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.units.filter((unit) => {
      if (seen.has(unit.id)) return false;
      seen.add(unit.id);
      return true;
    }),
  );
}

/** What the screen does after a decision: the page it reads again, the key that page starts
 * after, and the unit it selects next. The rejection of one relation keeps its unit selected. */
export interface AfterDecision {
  readonly page: number;
  readonly after: readonly string[] | null;
  readonly next: string;
}

export function afterDecision(
  pages: readonly UnitPage[],
  decided: string,
  mode: 'unit' | 'relation',
): AfterDecision {
  const page = Math.max(
    0,
    pages.findIndex((held) => held.units.some((unit) => unit.id === decided)),
  );
  const after = page === 0 ? null : (pages[page - 1]?.next ?? null);
  if (mode === 'relation') return { page, after, next: decided };
  const units = queueUnits(pages);
  const at = units.findIndex((unit) => unit.id === decided);
  const next = units[at + 1] ?? units[at - 1];
  return { page, after, next: next === undefined || next.id === decided ? '' : next.id };
}
