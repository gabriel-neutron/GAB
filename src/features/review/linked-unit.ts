import type { UnitRead, UnitsRead } from './units';
import type { LinkedUnit } from './units-page';

/** The unit that the address names, beside the first page of the queue. None is read when the
 * address names none, or when the first page holds it, or when the queue itself is private. */
export async function linkedUnit(
  unitId: string,
  first: UnitsRead,
  read: (unitId: string) => Promise<UnitRead>,
): Promise<LinkedUnit> {
  if (unitId === '' || first.state !== 'held') return { state: 'none' };
  if (first.page.units.some((unit) => unit.id === unitId)) return { state: 'none' };
  const held = await read(unitId);
  switch (held.state) {
    case 'held':
      return held;
    case 'gone':
      return { state: 'gone', unitId };
    case 'failed':
      return { state: 'failed', unitId, why: held.why };
  }
}
