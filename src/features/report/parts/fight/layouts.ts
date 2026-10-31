/** A box in pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One label to place: the point it names and the size of its text. */
export interface LabelIn {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// The offsets to try, nearest first: right, up, down, left, then the corners, at three distances.
const DIRECTIONS = [
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
] as const;
const DISTANCES = [12, 24, 38] as const;

const hits = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The box of each label, in the order given (the first labels win the room), or null when no
 * place near the point is free. A box never covers another box, a point, a reserved box, or the
 * edge. */
export function placeLabels(
  labels: readonly LabelIn[],
  width: number,
  height: number,
  reserved: readonly Box[] = [],
) {
  const taken: Box[] = [
    ...reserved,
    ...labels.map((label) => ({ x: label.x - 5, y: label.y - 5, w: 10, h: 10 })),
  ];
  return labels.map((label) => {
    for (const distance of DISTANCES)
      for (const [dx, dy] of DIRECTIONS) {
        const box: Box = {
          x: label.x + dx * distance - (dx < 0 ? label.w : dx === 0 ? label.w / 2 : 0),
          y: label.y + dy * distance - (dy < 0 ? label.h : dy === 0 ? label.h / 2 : 0),
          w: label.w,
          h: label.h,
        };
        if (box.x < 0 || box.y < 0 || box.x + box.w > width || box.y + box.h > height) continue;
        if (taken.some((other) => hits(box, other))) continue;
        taken.push(box);
        return box;
      }
    return null;
  });
}

/** One link of a flow between two columns. */
export interface FlowLink {
  readonly column: number;
  readonly from: string;
  readonly to: string;
  readonly value: number;
}

export interface FlowNode {
  readonly column: number;
  readonly name: string;
  readonly value: number;
  readonly y: number;
  readonly h: number;
}

export interface FlowBand {
  readonly link: FlowLink;
  /** The top of the band at its source and at its target. */
  readonly y0: number;
  readonly y1: number;
  readonly h: number;
}

/** A ranked flow: the nodes of each column stacked largest first, with a fixed gap, on one scale
 * for all columns; each link is a band from its source node to its target node. */
export function layoutFlow(links: readonly FlowLink[], height: number, gap: number) {
  const columns = Math.max(...links.map((link) => link.column)) + 2;
  const sums = Array.from({ length: columns }, () => new Map<string, number>());
  for (const link of links) {
    const out = sums[link.column];
    const into = sums[link.column + 1];
    // A node takes the larger of what comes in and what goes out.
    out?.set(link.from, (out.get(link.from) ?? 0) + link.value);
    into?.set(`>${link.to}`, (into.get(`>${link.to}`) ?? 0) + link.value);
  }
  const lists = sums.map((map) => {
    const names = new Set([...map.keys()].map((key) => key.replace(/^>/, '')));
    return [...names]
      .map((name) => ({ name, value: Math.max(map.get(name) ?? 0, map.get(`>${name}`) ?? 0) }))
      .sort((a, b) => b.value - a.value);
  });
  const scale = Math.min(
    ...lists.map(
      (list) => (height - gap * (list.length - 1)) / list.reduce((sum, n) => sum + n.value, 0),
    ),
  );
  const nodes: FlowNode[] = lists.flatMap((list, column) => {
    let y = 0;
    return list.map((node) => {
      const placed = { column, name: node.name, value: node.value, y, h: node.value * scale };
      y += placed.h + gap;
      return placed;
    });
  });
  const at = (column: number, name: string) =>
    nodes.find((node) => node.column === column && node.name === name);
  const rank = (column: number, name: string) => at(column, name)?.y ?? 0;
  const outUsed = new Map<FlowNode, number>();
  const inUsed = new Map<FlowNode, number>();
  const bands: FlowBand[] = [...links]
    .sort(
      (a, b) =>
        a.column - b.column ||
        rank(a.column, a.from) - rank(b.column, b.from) ||
        rank(a.column + 1, a.to) - rank(b.column + 1, b.to),
    )
    .flatMap((link) => {
      const source = at(link.column, link.from);
      const target = at(link.column + 1, link.to);
      if (source === undefined || target === undefined) return [];
      const h = link.value * scale;
      const y0 = source.y + (outUsed.get(source) ?? 0);
      outUsed.set(source, (outUsed.get(source) ?? 0) + h);
      return [{ link, y0, y1: 0, h, target }];
    })
    // The bands enter each target in the order of their sources.
    .sort((a, b) => a.link.column - b.link.column || a.y0 - b.y0)
    .map(({ link, y0, h, target }) => {
      const y1 = target.y + (inUsed.get(target) ?? 0);
      inUsed.set(target, (inUsed.get(target) ?? 0) + h);
      return { link, y0, y1, h };
    });
  return { nodes, bands, columns };
}

/** The tops of labels of height `h` in one column: each label stays as near its point as it can,
 * in the order of the points, with no overlap and inside 0..height. */
export function stackLabels(ys: readonly number[], h: number, height: number): number[] {
  const order = ys.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  const tops = order.map(({ y }) => y - h / 2);
  for (let k = 0; k < tops.length; k++)
    tops[k] = Math.max(tops[k] ?? 0, k === 0 ? 0 : (tops[k - 1] ?? 0) + h);
  // Push back up from the bottom edge.
  for (let k = tops.length - 1; k >= 0; k--)
    tops[k] = Math.min(tops[k] ?? 0, k === tops.length - 1 ? height - h : (tops[k + 1] ?? 0) - h);
  const out = new Array<number>(ys.length).fill(0);
  order.forEach(({ index }, k) => {
    out[index] = Math.max(0, tops[k] ?? 0);
  });
  return out;
}

/** True when the point is inside the ring of [lon, lat] points (even-odd rule). */
export function ringHolds(ring: readonly (readonly number[])[], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A crop of the map in degrees, and the size in pixels of the box that draws it. */
export interface FitCrop {
  readonly west: number;
  readonly east: number;
  readonly south: number;
  readonly north: number;
  readonly w: number;
  readonly h: number;
}

/** The crop that holds `need` and fills a box of `w` by `h` pixels at one scale for both axes.
 * The latitudes stay inside -66..84 and span at most `maxLat`; past that the box gets shorter. */
export function fitCrop(
  need: { west: number; east: number; south: number; north: number },
  w: number,
  h: number,
  maxLat = 150,
): FitCrop {
  let spanX = need.east - need.west;
  let spanY = need.north - need.south;
  const aspect = w / Math.max(h, 1);
  if (spanX / spanY > aspect) spanY = Math.min(spanX / aspect, maxLat);
  else spanX = spanY * aspect;
  const midX = (need.west + need.east) / 2;
  let south = (need.south + need.north) / 2 - spanY / 2;
  south = Math.max(-66, Math.min(south, 84 - spanY));
  return {
    west: midX - spanX / 2,
    east: midX + spanX / 2,
    south,
    north: south + spanY,
    w,
    h: Math.min(h, (w * spanY) / spanX),
  };
}
