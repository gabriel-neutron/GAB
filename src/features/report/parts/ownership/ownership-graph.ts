import { figureTexts } from '../../content';
import figures from '../../data/publication-figures.json';
import nodes from '../../nodes-data';

const labels: Readonly<Record<string, string>> = figureTexts.dataLabels;
const figureLabels: Readonly<Record<string, string>> = figureTexts.figures['12'].labels;
/** The English words of a French label of figure 12. A label with no translation stays as it is. */
export const english = (french: string): string => labels[french] ?? figureLabels[french] ?? french;

// The figure names these nodes in French or with a longer name than the node.
const ALIASES: Readonly<Record<string, string>> = {
  'VTB Bank': 'N-M002',
  'South Fleet (Yuzhny Flot)': 'N-P052',
  'Invest Fleet (Invest Flot)': 'N-P053',
  Kalachnikov: 'N-F010',
  KTRV: 'N-F032',
  'Far Frontiers LLC': 'N-P054',
  'Global Seaway LLC': 'N-P055',
};
const byName = new Map(nodes.map((node) => [node.name, node.node_id]));

/** The four bands of the figure, from the State at the top to the intermediaries at the bottom. */
export const BANDS = [
  'État, holdings et sociétés d’État',
  'Président, cercle et actionnaires privés',
  'Sociétés et actionnaires étrangers',
  'Intermédiaires et propriétaires inconnus',
] as const;

const BAND_OF: Readonly<Record<string, number>> = {
  État: 0,
  'holding d’État': 0,
  'société d’État': 0,
  'société d’État (flotte)': 0,
  'société d’État (armement)': 0,
  'banque d’État': 0,
  'président (désigné)': 1,
  cercle: 1,
  dirigeant: 1,
  famille: 1,
  'famille (désignée)': 1,
  privé: 1,
  'société privée': 2,
  'holding privée': 2,
  'banque privée': 2,
  'société de négoce': 2,
  société: 2,
  assureur: 2,
  projet: 2,
  'raffineur (Inde)': 2,
  'actionnaire étranger': 2,
  intermédiaire: 3,
  'armateur ou gestionnaire': 3,
  'propriétaire inconnu': 3,
};
// Placeholders of the figure: the source names no owner.
const NOBODY = new Set(['propriétaire non nommé', 'propriétaire non publié']);
// A personal or management link does not put one entity above the other.
const PERSONAL = new Set([
  'proche',
  'fille',
  'mariage (février 2013)',
  'dirige',
  'cofondateur',
  'lié à',
  'même réseau',
]);

export interface Entity {
  readonly id: string;
  readonly name: string;
  /** The class of the entity, in the words of the page. */
  readonly kind: string;
  readonly band: number;
  /** The row of the entity in its band: an owner sits above what it owns. */
  readonly depth: number;
  /** The placeholder owner of the entity when the source names none, in French. */
  readonly unnamedOwner?: string | undefined;
  /** What the placeholder owner holds, in the words of the page, for example "11 vessels". */
  readonly holding?: string | undefined;
}

export interface Link {
  readonly from: string;
  readonly to: string;
  /** The relation and the share, in the words of the page, exactly as the figure gives them. */
  readonly relation: string;
  readonly share: string;
  readonly state: string;
  readonly proposed: boolean;
  readonly personal: boolean;
}

type Row = readonly string[];

/** The entities and links of figure 12, read from the data of the figure. A row whose owner is a
 * placeholder gives no link: it marks the entity it holds. `label` gives the words of the page
 * for a French label of the data (English by default). */
export function ownershipGraph(
  rows: readonly Row[],
  label: (french: string) => string = english,
): {
  readonly entities: readonly Entity[];
  readonly links: readonly Link[];
} {
  const idOf = (name: string): string => {
    const id = ALIASES[name] ?? byName.get(name) ?? byName.get(english(name));
    if (id === undefined) throw new Error(`Figure 12 names no node for ${name}`);
    return id;
  };
  const classes = new Map<string, string>();
  const order: string[] = [];
  const unnamed = new Map<string, { owner: string; holding: string }>();
  const links: Link[] = [];
  for (const [
    owner = '',
    ownerClass = '',
    owned = '',
    ownedClass = '',
    relation = '',
    share = '',
    state = '',
  ] of rows) {
    for (const [name, cls] of [
      [owner, ownerClass],
      [owned, ownedClass],
    ] as const) {
      if (NOBODY.has(name)) continue;
      if (!classes.has(name)) order.push(name);
      // "unknown owner" says less than any other class of the same entity.
      if (!classes.has(name) || classes.get(name) === 'propriétaire inconnu')
        classes.set(name, cls);
    }
    if (NOBODY.has(owner)) {
      unnamed.set(owned, { owner, holding: label(share) });
      continue;
    }
    links.push({
      from: idOf(owner),
      to: idOf(owned),
      relation: label(relation),
      share: label(share),
      state: label(state),
      proposed: state.startsWith('proposé'),
      personal: PERSONAL.has(relation),
    });
  }
  const bandOf = new Map(order.map((name) => [idOf(name), BAND_OF[classes.get(name) ?? ''] ?? 3]));
  const depth = new Map<string, number>();
  // An owner in the same band puts what it owns one row lower. The figure holds no cycle, and the
  // pass count caps a loop if one comes.
  let moved = true;
  for (let pass = 0; moved && pass < order.length; pass++) {
    moved = false;
    for (const link of links) {
      if (link.personal || bandOf.get(link.from) !== bandOf.get(link.to)) continue;
      const next = (depth.get(link.from) ?? 0) + 1;
      if (next > (depth.get(link.to) ?? 0)) {
        depth.set(link.to, next);
        moved = true;
      }
    }
  }
  const entities = order.map((name): Entity => {
    const id = idOf(name);
    const placeholder = unnamed.get(name);
    return {
      id,
      name: label(name),
      kind: label(classes.get(name) ?? ''),
      band: bandOf.get(id) ?? 3,
      depth: placeholder === undefined ? (depth.get(id) ?? 0) : 0,
      unnamedOwner: placeholder?.owner,
      holding: placeholder?.holding,
    };
  });
  return { entities, links };
}

/** Figure 12, built once from the data of the report. */
export const figure12 = ownershipGraph(figures.f12);
