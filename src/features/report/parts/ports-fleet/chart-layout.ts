export interface SankeyLink {
  readonly from: string;
  readonly to: string;
  readonly value: number;
}

export interface SankeyNode {
  readonly name: string;
  readonly column: number;
  readonly value: number;
  readonly y: number;
  readonly height: number;
}

export interface SankeyBand extends SankeyLink {
  readonly column: number;
  /** The top of the band at its source node and at its target node. */
  readonly y0: number;
  readonly y1: number;
  readonly thick: number;
}

/** Place the nodes of each column from the top, at one scale for all columns, and stack the bands
 * on each node in the order of the nodes at their other end. */
function sankey(
  columns: readonly (readonly string[])[],
  links: readonly SankeyLink[],
  height: number,
  gap: number,
) {
  const sum = (name: string, side: 'from' | 'to') =>
    links.filter((link) => link[side] === name).reduce((total, link) => total + link.value, 0);
  const valued = columns.map((names) =>
    names.map((name) => ({ name, value: Math.max(sum(name, 'from'), sum(name, 'to')) })),
  );
  const scale = Math.min(
    ...valued.map(
      (column) =>
        (height - gap * (column.length - 1)) /
        column.reduce((total, node) => total + node.value, 0),
    ),
  );
  const nodes = new Map<string, SankeyNode>();
  valued.forEach((column, index) => {
    let y = 0;
    for (const node of column) {
      nodes.set(node.name, { ...node, column: index, y, height: node.value * scale });
      y += node.value * scale + gap;
    }
  });
  const order = (name: string) => columns.flat().indexOf(name);
  const outTop = new Map<string, number>();
  const inTop = new Map<string, number>();
  const bands: SankeyBand[] = [...links]
    .sort((a, b) => order(a.from) - order(b.from) || order(a.to) - order(b.to))
    .map((link) => {
      const source = nodes.get(link.from);
      const target = nodes.get(link.to);
      if (source === undefined || target === undefined)
        throw new Error(`A flow names a node of no column: ${link.from} to ${link.to}`);
      const thick = link.value * scale;
      const y0 = source.y + (outTop.get(link.from) ?? 0);
      outTop.set(link.from, (outTop.get(link.from) ?? 0) + thick);
      return { ...link, column: source.column, y0, y1: 0, thick };
    })
    .sort((a, b) => order(a.to) - order(b.to) || order(a.from) - order(b.from))
    .map((band) => {
      const target = nodes.get(band.to);
      const y1 = (target?.y ?? 0) + (inTop.get(band.to) ?? 0);
      inTop.set(band.to, (inTop.get(band.to) ?? 0) + band.thick);
      return { ...band, y1 };
    });
  return { nodes: [...nodes.values()], bands, scale };
}

/** Move labels apart, in their order, so that two centres are at least `gap` apart and none
 * leaves the range. */
function spread(
  wanted: readonly number[],
  gap: number,
  min: number,
  max: number,
): readonly number[] {
  const out = [...wanted];
  for (let index = 1; index < out.length; index++)
    out[index] = Math.max(out[index] ?? 0, (out[index - 1] ?? 0) + gap);
  for (let index = out.length - 1; index >= 0; index--) {
    const below = index === out.length - 1 ? max : (out[index + 1] ?? max) - gap;
    out[index] = Math.max(min, Math.min(out[index] ?? 0, below));
  }
  return out;
}

/** The two layouts of the figures of the part: the bands of a flow chart and the end labels. */
export const chartLayout = { sankey, spread };
