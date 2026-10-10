import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { CriticalNodesSheetFault, type SheetRow } from './critical-nodes-sheet.ts';
import type { ReleaseRecord } from './release-record.ts';

const CONDITIONS = ['a', 'b', 'c'] as const;
type Condition = (typeof CONDITIONS)[number];

// The fixed words of a condition cell. A tick shows "not sourced" when no public claim supports
// it, so a reader sees the gap.
const SOURCED = 'sourced';
const NOT_SOURCED = 'not sourced';
const NO_TICK = 'no tick';

const CONDITION_COLUMNS: Readonly<Record<Condition, string>> = {
  a: 'a_sanctions_exposure',
  b: 'b_production_or_throughput',
  c: 'c_bypass_routing',
};

const HEADER = [
  'node_id',
  'node_label',
  'node_type',
  'controller',
  'bypass_pattern',
  ...CONDITIONS.flatMap((one) => [CONDITION_COLUMNS[one], `${one}_claim_ids`]),
  'ticks',
  'sourced_ticks',
  'retained',
];

const NATO_HEADER = CONDITIONS.map((one) => `${one}_nato_pairs`);

// The rule of the investigation: a node that meets two conditions of three is retained.
const RETAINED_AT = 2;

// The mark of a claim of a tick that has no NATO pair, in the list of the pairs. A leading minus
// would read as a formula in a spreadsheet.
const NO_PAIR = 'none';

interface Tick {
  readonly claimIds: readonly string[];
}

interface Node {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly controller: string;
  readonly bypassPattern: string;
  readonly ticks: Readonly<Partial<Record<Condition, Tick>>>;
}

const tickCount = (node: Node): number => CONDITIONS.filter((one) => node.ticks[one]).length;
const sourcedCount = (node: Node): number =>
  CONDITIONS.filter((one) => (node.ticks[one]?.claimIds.length ?? 0) > 0).length;

const refuse = (row: SheetRow, why: string): never => {
  throw new CriticalNodesSheetFault(
    `The sheet of the candidate nodes is refused. Line ${String(row.line)}: ${why}.`,
  );
};

/** The one text of a node for one column, from all its rows. Two different texts are a fault. */
const textOf = (rows: readonly SheetRow[], take: (row: SheetRow) => string, name: string) => {
  let found = '';
  for (const row of rows) {
    const text = take(row);
    if (text === '' || text === found) continue;
    if (found !== '')
      refuse(row, `the node ${row.nodeId} has a different ${name} on an earlier line`);
    found = text;
  }
  return found;
};

const note = (sheet: boolean, nodes: readonly Node[], natoPair: boolean): string =>
  [
    'Critical nodes table.',
    'One row for each candidate node of the sheet that the operator keeps. A node is retained when it meets two conditions of three.',
    '(a) documented sanctions exposure: a public designation of the node itself, from the record, ended or not. A designation of an entity that the node controls does not count.',
    '(b) documented production or throughput in 2024-2026, and (c) presence in a bypass routing across jurisdictions: the operator ticks them, with the claims that support each tick.',
    `Each condition cell is "${SOURCED}" (a tick with at least one public claim of this release), "${NOT_SOURCED}" (a tick with no public claim) or "${NO_TICK}". The claim identifiers are claims of this release, separated by spaces. The release checks that each claim is public. It does not check that the claim supports the condition.`,
    'ticks counts each tick, sourced or not. sourced_ticks counts the ticks with a public claim. retained is true when ticks is two or more.',
    'controller and bypass_pattern are short texts of the operator.',
    ...(natoPair
      ? [
          `Each of a_nato_pairs, b_nato_pairs and c_nato_pairs gives the NATO pair (author letter, fact digit) of each claim of the tick, in the order of the claim identifiers, or ${NO_PAIR} for a claim with no full pair.`,
        ]
      : []),
    sheet
      ? `Candidate nodes: ${String(nodes.length)}. Retained: ${String(nodes.filter((one) => tickCount(one) >= RETAINED_AT).length)}.`
      : 'This release had no sheet of candidate nodes, so the table has no row.',
  ].join('\n');

/** The critical nodes table of a release, from the rows of the sheet of the candidate nodes, or
 * from no sheet. Condition (a) comes from the public designations of the node in the record. The
 * table refuses a sheet that names a node or a claim that is not public in the release. Retained
 * nodes come first, then by label. */
export const criticalNodes = (
  record: ReleaseRecord,
  sheet: readonly SheetRow[] | null,
  preamble: string,
): ReleaseFile => {
  const entities = new Map(record.entities.map((one) => [one.id, one]));
  const claims = new Set(record.claims.map((one) => one.claim_id));
  const relations = new Map(record.relations.map((one) => [one.id, one]));

  // Condition (a): the claims of the designations that start from the node.
  const designationsOf = new Map<string, string[]>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'relation' || claim.attribute !== null) continue;
    const relation = relations.get(claim.subject_id);
    if (relation?.type !== 'designated_by') continue;
    designationsOf.set(relation.src_id, [
      ...(designationsOf.get(relation.src_id) ?? []),
      claim.claim_id,
    ]);
  }

  const rowsOf = new Map<string, SheetRow[]>();
  for (const row of sheet ?? []) {
    if (!entities.has(row.nodeId))
      refuse(row, `the node ${row.nodeId} is not a public entity of this release`);
    for (const claimId of row.claimIds)
      if (!claims.has(claimId))
        refuse(row, `the claim ${claimId} is not a public claim of this release`);
    rowsOf.set(row.nodeId, [...(rowsOf.get(row.nodeId) ?? []), row]);
  }

  const nodes: Node[] = [...rowsOf].map(([id, rows]) => {
    const entity = entities.get(id);
    if (entity === undefined) throw new Error(`the release does not hold the element ${id}`);
    const ticks: Partial<Record<Condition, Tick>> = {};
    const designations = [...(designationsOf.get(id) ?? [])].sort();
    if (designations.length > 0) ticks.a = { claimIds: designations };
    for (const row of rows) if (row.condition !== null) ticks[row.condition] = row;
    return {
      id,
      label: entity.label,
      type: entity.type,
      controller: textOf(rows, (row) => row.controller, 'controller'),
      bypassPattern: textOf(rows, (row) => row.bypassPattern, 'bypass pattern'),
      ticks,
    };
  });
  nodes.sort(
    (one, two) =>
      Number(tickCount(two) >= RETAINED_AT) - Number(tickCount(one) >= RETAINED_AT) ||
      one.label.localeCompare(two.label, 'en') ||
      (one.id < two.id ? -1 : 1),
  );

  // S1: with the pair off, the file has no column of the pair, not even an empty one.
  const { natoPairs } = record;
  const pairsOf = (tick: Tick | undefined): string =>
    (tick?.claimIds ?? [])
      .map((claimId) => {
        const pair = natoPairs?.get(claimId);
        return pair === undefined ? NO_PAIR : `${pair.letter}${String(pair.digit)}`;
      })
      .join(' ');

  const rows = nodes.map((node) => [
    node.id,
    node.label,
    node.type,
    node.controller,
    node.bypassPattern,
    ...CONDITIONS.flatMap((one) => {
      const tick = node.ticks[one];
      if (tick === undefined) return [NO_TICK, ''];
      return [tick.claimIds.length > 0 ? SOURCED : NOT_SOURCED, tick.claimIds.join(' ')];
    }),
    String(tickCount(node)),
    String(sourcedCount(node)),
    String(tickCount(node) >= RETAINED_AT),
    ...(natoPairs === null ? [] : CONDITIONS.map((one) => pairsOf(node.ticks[one]))),
  ]);

  return {
    path: 'critical-nodes.csv',
    text: csvFile(
      `${preamble}\n\n${note(sheet !== null, nodes, natoPairs !== null)}`,
      natoPairs === null ? HEADER : [...HEADER, ...NATO_HEADER],
      rows,
    ),
  };
};
