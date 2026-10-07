import type { GroupUnit, GroupUnits } from './groups';

/** One line of the tree of the clean units. `under` names the parent of a top line that the
 * action does not write: it is in the record already, or it stays in the queue. */
export interface TreeRow {
  readonly id: string;
  readonly name: string;
  readonly type: string | null;
  readonly kind: GroupUnit['kind'];
  readonly depth: number;
  readonly under: string | null;
}

/** What the confirmation of the group action shows, and the units that it sends. */
export interface GroupConfirmation {
  readonly said: string;
  readonly tree: readonly TreeRow[];
  /** The clean units, a parent before its child, as the screen showed them. */
  readonly unitIds: readonly string[];
}

const counted = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

/** Why a unit stays in the queue: a dispute first, then a wait for another group, then any other
 * fault. A clean unit that needs a unit that stays counts with a fault. Each unit counts once. */
const stayOf = (unit: GroupUnit): 'disputed' | 'waiting' | 'faulty' => {
  if (unit.faults.some((fault) => fault.kind === 'dispute')) return 'disputed';
  if (unit.faults.some((fault) => fault.kind === 'end_waits')) return 'waiting';
  return 'faulty';
};

// Origin of the number: the deepest tree of the v1 import has six levels. The guard stops a
// circle of parents, which the check of the faults blocks before it reaches this screen.
const DEEPEST = 40;

/** The clean units that the action can write: each unit that it needs is written by the same
 * action. A unit below a unit that stays in the queue stays too, as the database refuses it. */
const writableOf = (units: readonly GroupUnit[]): readonly GroupUnit[] => {
  let held = units.filter((unit) => unit.state === 'clean');
  for (;;) {
    const ids = new Set(held.map((unit) => unit.id));
    const next = held.filter((unit) => unit.needs.every((need) => ids.has(need)));
    if (next.length === held.length) return held;
    held = next;
  }
};

const treeOf = (clean: readonly GroupUnit[]): readonly TreeRow[] => {
  const ids = new Set(clean.map((unit) => unit.id));
  const parentIn = (unit: GroupUnit): string | null => {
    const parent = unit.parent?.unit ?? null;
    return parent !== null && ids.has(parent) ? parent : null;
  };
  const children = new Map<string, readonly GroupUnit[]>();
  for (const unit of clean) {
    const parent = parentIn(unit);
    if (parent !== null) children.set(parent, [...(children.get(parent) ?? []), unit]);
  }
  const rows: TreeRow[] = [];
  const placed = new Set<string>();
  const walk = (unit: GroupUnit, depth: number): void => {
    if (placed.has(unit.id) || depth > DEEPEST) return;
    placed.add(unit.id);
    rows.push({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      kind: unit.kind,
      depth,
      under: depth === 0 ? (unit.parent?.name ?? null) : null,
    });
    for (const child of children.get(unit.id) ?? []) walk(child, depth + 1);
  };
  for (const unit of clean) if (parentIn(unit) === null) walk(unit, 0);
  // A circle of parents has no top line, so each unit of it starts a line of its own.
  for (const unit of clean) walk(unit, 0);
  return rows;
};

/** The sentence, the tree and the list of the group action, from the units of the group that the
 * screen shows. Only a clean unit is sent. */
export function groupConfirmation(group: GroupUnits): GroupConfirmation {
  const clean = writableOf(group.units);
  const written = new Set(clean.map((unit) => unit.id));
  const stays = group.units.filter((unit) => !written.has(unit.id)).map(stayOf);
  const subject = group.subject ?? 'with no subject';
  const stay =
    `${String(stays.length)} stay in the queue: ` +
    `${String(stays.filter((why) => why === 'disputed').length)} disputed, ` +
    `${String(stays.filter((why) => why === 'faulty').length)} with a fault, ` +
    `${String(stays.filter((why) => why === 'waiting').length)} waiting for another group.`;
  const tree = treeOf(clean);
  if (clean.length === 0)
    return {
      said: `No unit of group ${subject} is clean, so the action writes nothing. ${stay}`,
      tree,
      unitIds: [],
    };
  const entities = clean.reduce((sum, unit) => sum + unit.entities, 0);
  const relations = clean.reduce((sum, unit) => sum + unit.relations, 0);
  return {
    said:
      `Writes ${counted(entities, 'entity', 'entities')} and ` +
      `${counted(relations, 'relation', 'relations')} of group ${subject}. ${stay} ` +
      'You cannot undo this.',
    tree,
    unitIds: tree.map((row) => row.id),
  };
}
