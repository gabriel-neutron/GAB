import chainRaw from '../../data/chp-chain.csv?raw';
import figures from '../../data/publication-figures.json';
import { readCsv } from '../../line-panel';
import nodes from '../../nodes-data';

/** How a mark is inked: the accent for China and Hong Kong, the ink for the coalition, grey for
 * the rest. */
export type Tone = 'accent' | 'ink' | 'dim';

/** The side of a place label, so that close places do not cover each other. */
type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Place {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  readonly side: Side;
  readonly tone: Tone;
  /** The share of the place, as the data file writes it, when the data gives one. */
  readonly value?: string | undefined;
}

export interface Share {
  readonly group: string;
  readonly pct: number;
  /** The share as the data file writes it. */
  readonly text: string;
  readonly note: string;
  readonly tone: Tone;
  /** The number of cells of 100 that the group fills (largest remainder). */
  readonly cells: number;
}

export interface Stage {
  readonly name: string;
  readonly shares: readonly Share[];
  readonly document: string;
  readonly page: string;
  readonly places: readonly Place[];
}

export interface Arc {
  readonly from: Place;
  readonly to: Place;
  readonly state: string;
  readonly weight: number;
}

export interface Total {
  readonly name: string;
  readonly chains: number;
}

// The approximate centre of each place, for drawing only: these positions are not report data.
const ANCHORS: Readonly<Record<string, readonly [number, number, Side]>> = {
  'United States': [-98, 39, 'right'],
  Taiwan: [121, 24, 'right'],
  EU: [10, 51, 'top'],
  // On the point of the EU: the map merges the two names into one label.
  Europe: [10, 51, 'top'],
  UK: [-2, 54, 'left'],
  Switzerland: [8, 47, 'left'],
  China: [104, 35, 'top'],
  'Hong Kong': [114, 22, 'bottom'],
  Malaysia: [102, 4, 'left'],
  Vietnam: [106, 16, 'bottom'],
  Turkey: [35, 39, 'bottom'],
  UAE: [54, 24, 'bottom'],
  Iran: [53, 32, 'right'],
  'Central Asia': [67, 45, 'top'],
};
// The data files name one place in two ways.
const ALIAS: Readonly<Record<string, string>> = { US: 'United States' };

const COALITION = new Set(['United States', 'Taiwan', 'EU', 'UK', 'Switzerland', 'Europe']);
const ACCENT = new Set(['China', 'Hong Kong', 'China, Hong Kong']);

const toneOf = (name: string): Tone =>
  ACCENT.has(name) ? 'accent' : COALITION.has(name) || name === 'Coalition' ? 'ink' : 'dim';

/** The place of a name of the data, or nothing when the map has no anchor for it. */
export function placeOf(raw: string, value?: string): Place | undefined {
  const name = ALIAS[raw] ?? raw;
  const anchor = ANCHORS[name];
  if (anchor === undefined) return undefined;
  const [lon, lat, side] = anchor;
  return { name, lon, lat, side, tone: toneOf(name), value };
}

/** Whole cells of 100 for shares that add up to about 100: the largest remainders take the rest. */
export function cellsOf(pcts: readonly number[]): number[] {
  const total = pcts.reduce((sum, pct) => sum + pct, 0);
  const exact = pcts.map((pct) => (pct / total) * 100);
  const cells = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  const missing = 100 - cells.reduce((sum, n) => sum + n, 0);
  for (let k = 0; k < missing; k++) {
    const at = order[k % order.length]?.index ?? 0;
    cells[at] = (cells[at] ?? 0) + 1;
  }
  return cells;
}

/** The named parts of a note such as "US 25.5, Taiwan 7.0": a place with its share. A note of one
 * bare name ("China") names the place with no share. */
export function placesOfNote(note: string): Place[] {
  return note
    .split(',')
    .map((part) => /^\s*(.+?)(?:\s+(\d+(?:\.\d+)?))?\s*$/.exec(part))
    .flatMap((match) => {
      if (match === null) return [];
      const place = placeOf(match[1] ?? '', match[2] === undefined ? undefined : `${match[2]}%`);
      return place === undefined ? [] : [place];
    });
}

const rows = readCsv(chainRaw);

/** The three stages of the chain of Russian imports of CHP battlefield goods, from the brand to
 * the final seller, with the shares, the document and the page of each stage. */
export const stages: readonly Stage[] = [...new Set(rows.map((row) => row['stage'] ?? ''))]
  .filter((name) => name !== 'brand')
  .map((name) => {
    const own = rows.filter((row) => row['stage'] === name);
    const pcts = own.map((row) => Number(row['share_pct']));
    const cells = cellsOf(pcts);
    return {
      name,
      shares: own.map((row, index) => ({
        group: row['group'] ?? '',
        pct: pcts[index] ?? 0,
        text: row['share_pct'] ?? '',
        note: row['note'] === 'n/d' ? '' : (row['note'] ?? ''),
        tone: toneOf(row['group'] ?? ''),
        cells: cells[index] ?? 0,
      })),
      document: own[0]?.['document'] ?? '',
      page: own[0]?.['page'] ?? '',
      places: own.flatMap((row) => placesOfNote(row['note'] ?? '')),
    };
  });

/** The coalition brands of the first stage, in million US dollars. */
export const brands = rows
  .filter((row) => row['stage'] === 'brand')
  .map((row) => ({
    name: row['group'] ?? '',
    value: row['share_pct'] ?? '',
    document: row['document'] ?? '',
    page: row['page'] ?? '',
  }));

const f11 = figures.f11;
const links = f11.links.flatMap((link) => {
  const [stage, from, to, state, weight] = link;
  return typeof stage === 'number' &&
    typeof from === 'string' &&
    typeof to === 'string' &&
    typeof state === 'string' &&
    typeof weight === 'number'
    ? [{ stage, from, to, state, weight }]
    : [];
});

/** The chains of figure 11 at each name of one end of one step, largest first. Step 0 runs from
 * the manufacturer to the intermediary, step 1 to the buyer, step 2 to the end use. */
export function totalsAt(stage: number, end: 'from' | 'to' = 'to'): Total[] {
  const sums = new Map<string, number>();
  for (const link of links)
    if (link.stage === stage) sums.set(link[end], (sums.get(link[end]) ?? 0) + link.weight);
  return [...sums].map(([name, chains]) => ({ name, chains })).sort((a, b) => b.chains - a.chains);
}

/** The routes of figure 11 from the country of the manufacturer to the country of the
 * intermediary, one arc for each pair and state. A name with no place stays off the map. */
export const arcs: readonly Arc[] = (() => {
  const sums = new Map<string, Arc>();
  for (const link of links) {
    if (link.stage !== 0 || link.from === link.to) continue;
    const from = placeOf(link.from);
    const to = placeOf(link.to);
    if (from === undefined || to === undefined) continue;
    const key = `${from.name}|${to.name}|${link.state}`;
    const held = sums.get(key);
    sums.set(key, { from, to, state: link.state, weight: (held?.weight ?? 0) + link.weight });
  }
  return [...sums.values()];
})();

/** The chains of step 0 that the map draws as arcs, and all the chains of step 0. */
export const arcChains = {
  drawn: arcs.reduce((sum, arc) => sum + arc.weight, 0),
  all: links.filter((link) => link.stage === 0).reduce((sum, link) => sum + link.weight, 0),
};

/** The counts of figure 11: steps by state, chains shown and recorded, routes, documented steps. */
export const routeCounts = {
  hops: f11.hops,
  chains: f11.chains,
  all: f11.all,
  routes: f11.routes,
  steps: Object.values(f11.hops).reduce((a, b) => a + b, 0),
  doc: f11.doc,
};

/** The nodes of the Fight layer that have a known site, north first: the order of their numbers
 * on the map and in the list. */
export const sites = nodes
  .filter((node) => node.layer === 'Fight' && node.lat !== '' && node.lon !== '')
  .map((node) => ({
    id: node.node_id,
    name: node.short_label,
    lon: Number(node.lon),
    lat: Number(node.lat),
  }))
  .sort((a, b) => b.lat - a.lat);

/** The links of figure 11, summed for each step, source and target: the bands of the flow. */
export const flowLinks = (() => {
  const sums = new Map<string, { column: number; from: string; to: string; value: number }>();
  for (const link of links) {
    const key = `${String(link.stage)}|${link.from}|${link.to}`;
    const held = sums.get(key);
    sums.set(key, {
      column: link.stage,
      from: link.from,
      to: link.to,
      value: (held?.value ?? 0) + link.weight,
    });
  }
  return [...sums.values()];
})();

/** A count of chains as a reader reads it: the data splits a chain in parts, so 13.0001 is 13. */
export const chainCount = (value: number) => Number(value.toFixed(1)).toLocaleString('en-US');
