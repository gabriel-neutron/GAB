import { readReleaseRows } from './release-table.ts';
import { SiteReleaseFault } from './site-release-fault.ts';
import { claimPage, entityPage, relationPage, SitePathFault, vesselPage } from './site-paths.ts';
import { siteManifestShape, type SiteManifest } from './site-manifest.ts';
import { imoOf } from './vessel-imo.ts';

/** The NATO pair of a claim. A release holds it only when its manifest shows the pair. */
export interface NatoPair {
  readonly letter: string;
  readonly digit: string;
}

export interface SitePassage {
  readonly page: string;
  readonly excerpt: string;
  readonly modality: string;
  readonly transcribed: boolean;
}

/** One public document of a claim, with the passages of the claim in it. */
export interface SiteSource {
  readonly documentId: string;
  readonly title: string;
  readonly address: string | null;
  readonly readOn: string | null;
  readonly passages: readonly SitePassage[];
}

export interface SiteEntity {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly originLabel: string;
  readonly licence: string;
}

export interface SiteRelation {
  readonly id: string;
  readonly type: string;
  readonly fromId: string;
  readonly fromLabel: string;
  readonly toId: string;
  readonly toLabel: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly originLabel: string;
  readonly licence: string;
}

interface ClaimTrust {
  readonly id: string;
  readonly originLabel: string;
  readonly licence: string;
  readonly sources: readonly SiteSource[];
  /** Null when the release does not show the pair, or when the claim has no full pair. */
  readonly pair: NatoPair | null;
}

/** A claim of the release: a value of an entity or of a relation, or a relation. */
export type SiteClaim = ClaimTrust &
  (
    | {
        readonly kind: 'attribute';
        readonly subjectKind: 'entity' | 'relation';
        readonly subjectId: string;
        readonly subjectLabel: string;
        readonly attribute: string;
        readonly value: string;
      }
    | {
        readonly kind: 'relation';
        readonly relation: SiteRelation;
      }
  );

export type ConditionState = 'sourced' | 'not sourced' | 'no tick';

export interface NodeCondition {
  readonly key: 'a' | 'b' | 'c';
  readonly state: ConditionState;
  readonly claimIds: readonly string[];
}

/** One row of the critical nodes table. */
export interface CriticalNode {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly controller: string;
  readonly bypassPattern: string;
  readonly conditions: readonly NodeCondition[];
  readonly ticks: number;
  readonly sourcedTicks: number;
  readonly retained: boolean;
}

/** What the static site shows of one release, read from its files. */
export interface SiteRelease {
  readonly manifest: SiteManifest;
  readonly entities: readonly SiteEntity[];
  readonly relations: readonly SiteRelation[];
  readonly claims: readonly SiteClaim[];
  readonly entityById: ReadonlyMap<string, SiteEntity>;
  readonly claimById: ReadonlyMap<string, SiteClaim>;
  /** The claims of each entity: its values, and each relation that starts or ends at it. */
  readonly claimsAbout: ReadonlyMap<string, readonly SiteClaim[]>;
  /** The value claims of each relation, such as the act that gives its end date. */
  readonly valuesOfRelation: ReadonlyMap<string, readonly SiteClaim[]>;
  /** The public vessels of each IMO number, in the order of the entities file. Two vessels share
   * a number while no merge joins them. */
  readonly vesselsByImo: ReadonlyMap<string, readonly SiteEntity[]>;
  /** The IMO number of each public vessel that has one. */
  readonly imoOfVessel: ReadonlyMap<string, string>;
  /** The survivor of each absorbed identifier while its merge stands. */
  readonly aliases: ReadonlyMap<string, string>;
  readonly criticalNodes: readonly CriticalNode[];
  /** The GeoJSON file of the release, as the release wrote it. */
  readonly geojson: string;
}

const MANIFEST = 'manifest.json';

const orNull = (text: string | undefined): string | null =>
  text === undefined || text === '' ? null : text;

const cell = (row: Readonly<Record<string, string>>, column: string): string => row[column] ?? '';

const addTo = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
};

const STATES: readonly ConditionState[] = ['sourced', 'not sourced', 'no tick'];

const stateOf = (path: string, text: string): ConditionState => {
  const state = STATES.find((one) => one === text);
  if (state === undefined) throw new SiteReleaseFault(`${path}: "${text}" is not a condition word`);
  return state;
};

const CONDITION_COLUMNS = [
  ['a', 'a_sanctions_exposure'],
  ['b', 'b_production_or_throughput'],
  ['c', 'c_bypass_routing'],
] as const;

const ids = (text: string): readonly string[] => text.split(' ').filter((one) => one !== '');

/** Reads one release from its files: the file manifest and each file that it lists. A file that
 * the manifest lists and that is missing, or a file that does not have its columns, stops the
 * read. */
export const readSiteRelease = (files: ReadonlyMap<string, string>): SiteRelease => {
  const fileOf = (path: string): string => {
    const text = files.get(path);
    if (text === undefined) throw new SiteReleaseFault(`${path}: the release has no such file`);
    return text;
  };
  let json: unknown;
  try {
    json = JSON.parse(fileOf(MANIFEST));
  } catch (fault) {
    if (fault instanceof SiteReleaseFault) throw fault;
    throw new SiteReleaseFault(`${MANIFEST}: the file is not JSON`);
  }
  const read = siteManifestShape.safeParse(json);
  if (!read.success)
    throw new SiteReleaseFault(`${MANIFEST}: the file is not the manifest of a release`);
  const manifest = read.data;
  for (const file of manifest.files) fileOf(file.path);
  const rows = (path: string, columns: readonly string[]) =>
    readReleaseRows(path, fileOf(path), columns);

  const entities = rows('entities.csv', ['id', 'type', 'label', 'origin_label', 'licence']).map(
    (row) => ({
      id: cell(row, 'id'),
      type: cell(row, 'type'),
      label: cell(row, 'label'),
      originLabel: cell(row, 'origin_label'),
      licence: cell(row, 'licence'),
    }),
  );

  const relations = rows('relations.csv', [
    'id',
    'type',
    'from_id',
    'from_label',
    'to_id',
    'to_label',
    'valid_from',
    'valid_to',
    'origin_label',
    'licence',
  ]).map((row) => ({
    id: cell(row, 'id'),
    type: cell(row, 'type'),
    fromId: cell(row, 'from_id'),
    fromLabel: cell(row, 'from_label'),
    toId: cell(row, 'to_id'),
    toLabel: cell(row, 'to_label'),
    validFrom: orNull(row['valid_from']),
    validTo: orNull(row['valid_to']),
    originLabel: cell(row, 'origin_label'),
    licence: cell(row, 'licence'),
  }));
  const relationOf = new Map(relations.map((one) => [one.id, one]));

  // The claims file has one row for each claim and each cited passage, so the rows of one claim
  // are joined back, in the order of the file.
  const claimRows = new Map<string, Readonly<Record<string, string>>[]>();
  for (const row of rows('claims.csv', [
    'claim_id',
    'claim_kind',
    'subject_kind',
    'subject_id',
    'subject_label',
    'attribute',
    'value',
    'origin_label',
    'licence',
    'document_id',
    'document_title',
    'document_address',
    'document_read_on',
    'page',
    'excerpt',
    'modality',
    'transcribed',
  ])) {
    addTo(claimRows, cell(row, 'claim_id'), row);
  }
  const claims = [...claimRows].map(([id, group]): SiteClaim => {
    const [first] = group;
    if (first === undefined) throw new SiteReleaseFault(`claims.csv: the claim ${id} has no row`);
    const sources = new Map<string, SiteSource>();
    for (const row of group) {
      const documentId = cell(row, 'document_id');
      const known = sources.get(documentId);
      const passage =
        cell(row, 'excerpt') === ''
          ? []
          : [
              {
                page: cell(row, 'page'),
                excerpt: cell(row, 'excerpt'),
                modality: cell(row, 'modality'),
                transcribed: cell(row, 'transcribed') === 'true',
              },
            ];
      sources.set(documentId, {
        documentId,
        title: cell(row, 'document_title'),
        address: orNull(row['document_address']),
        readOn: orNull(row['document_read_on']),
        passages: [...(known?.passages ?? []), ...passage],
      });
    }
    const letter = cell(first, 'nato_letter');
    const digit = cell(first, 'nato_digit');
    const trust: ClaimTrust = {
      id,
      originLabel: cell(first, 'origin_label'),
      licence: cell(first, 'licence'),
      sources: [...sources.values()],
      pair: manifest.showNatoPair && letter !== '' && digit !== '' ? { letter, digit } : null,
    };
    if (cell(first, 'claim_kind') === 'relation') {
      const relation = relationOf.get(id);
      if (relation === undefined)
        throw new SiteReleaseFault(`claims.csv: the relation ${id} is not in relations.csv`);
      return { ...trust, kind: 'relation', relation };
    }
    return {
      ...trust,
      kind: 'attribute',
      subjectKind: cell(first, 'subject_kind') === 'relation' ? 'relation' : 'entity',
      subjectId: cell(first, 'subject_id'),
      subjectLabel: cell(first, 'subject_label'),
      attribute: cell(first, 'attribute'),
      value: cell(first, 'value'),
    };
  });

  const aliases = new Map(
    rows('merges.csv', ['absorbed_id', 'resolves_to']).flatMap((row) =>
      cell(row, 'resolves_to') === ''
        ? []
        : [[cell(row, 'absorbed_id'), cell(row, 'resolves_to')] as const],
    ),
  );

  const NODES = 'critical-nodes.csv';
  const criticalNodes = rows(NODES, [
    'node_id',
    'node_label',
    'node_type',
    'controller',
    'bypass_pattern',
    'a_sanctions_exposure',
    'a_claim_ids',
    'b_production_or_throughput',
    'b_claim_ids',
    'c_bypass_routing',
    'c_claim_ids',
    'ticks',
    'sourced_ticks',
    'retained',
  ]).map((row) => ({
    id: cell(row, 'node_id'),
    label: cell(row, 'node_label'),
    type: cell(row, 'node_type'),
    controller: cell(row, 'controller'),
    bypassPattern: cell(row, 'bypass_pattern'),
    conditions: CONDITION_COLUMNS.map(([key, column]) => ({
      key,
      state: stateOf(NODES, cell(row, column)),
      claimIds: ids(cell(row, `${key}_claim_ids`)),
    })),
    ticks: Number(cell(row, 'ticks')),
    sourcedTicks: Number(cell(row, 'sourced_ticks')),
    retained: cell(row, 'retained') === 'true',
  }));

  const claimsAbout = new Map<string, SiteClaim[]>();
  const valuesOfRelation = new Map<string, SiteClaim[]>();
  const about = (id: string, claim: SiteClaim) => {
    addTo(claimsAbout, id, claim);
  };
  for (const claim of claims)
    if (claim.kind === 'relation') {
      about(claim.relation.fromId, claim);
      if (claim.relation.toId !== claim.relation.fromId) about(claim.relation.toId, claim);
    } else if (claim.subjectKind === 'entity') about(claim.subjectId, claim);
    else addTo(valuesOfRelation, claim.subjectId, claim);

  const vessels = new Set(entities.filter((one) => one.type === 'vessel').map((one) => one.id));
  const imoOfVessel = new Map<string, string>();
  for (const claim of claims)
    if (claim.kind === 'attribute' && claim.attribute === 'imo' && vessels.has(claim.subjectId)) {
      const imo = imoOf(claim.value);
      if (imo !== null && !imoOfVessel.has(claim.subjectId)) imoOfVessel.set(claim.subjectId, imo);
    }
  const vesselsByImo = new Map<string, SiteEntity[]>();
  for (const entity of entities) {
    const imo = imoOfVessel.get(entity.id);
    if (imo !== undefined) addTo(vesselsByImo, imo, entity);
  }

  // Each page is written before the first one, so an identifier that cannot be a path stops the
  // release before a file is written. Two paths that differ only by case are one file on Windows.
  const paths = [
    ...entities.map((one) => entityPage(one.id)),
    ...claims.map((one) => claimPage(one.id)),
    ...relations.map((one) => relationPage(one.id)),
    ...[...aliases].flatMap(([absorbed, survivor]) => [entityPage(absorbed), entityPage(survivor)]),
    ...criticalNodes.map((one) => entityPage(one.id)),
    ...[...vesselsByImo.keys()].map(vesselPage),
  ];
  const folded = new Map<string, string>();
  for (const path of new Set(paths)) {
    const other = folded.get(path.toLowerCase());
    if (other !== undefined)
      throw new SitePathFault(`The addresses ${other} and ${path} differ only by case.`);
    folded.set(path.toLowerCase(), path);
  }

  return {
    manifest,
    entities,
    relations,
    claims,
    entityById: new Map(entities.map((one) => [one.id, one])),
    claimById: new Map(claims.map((one) => [one.id, one])),
    claimsAbout,
    valuesOfRelation,
    vesselsByImo,
    imoOfVessel,
    aliases,
    criticalNodes,
    geojson: fileOf('entities.geojson'),
  };
};
