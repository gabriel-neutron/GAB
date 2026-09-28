import type { UnitHierarchy } from './fold-subordinates';

export interface UnitFolds {
  readonly open: ReadonlySet<string>;
  /** Departure: `true` means the open units changed, and the caller lists its rows again. */
  readonly reveal: (entity: string) => boolean;
  readonly setOpen: (unit: string, open: boolean) => boolean;
}

// Departure: every unit starts closed, so each rail list shows the tops of the hierarchy first.
export function foldEveryUnit(hierarchy: UnitHierarchy): UnitFolds {
  let open: ReadonlySet<string> = new Set();

  const settle = (next: ReadonlySet<string>): boolean => {
    if (next === open) return false;
    open = next;
    return true;
  };

  return {
    get open() {
      return open;
    },
    reveal: (entity) => settle(hierarchy.revealing(open, entity)),
    setOpen: (unit, wanted) => {
      if (hierarchy.subordinatesOf(unit).length === 0 || wanted === open.has(unit)) return false;
      return settle(wanted ? new Set([...open, unit]) : hierarchy.closing(open, unit));
    },
  };
}
