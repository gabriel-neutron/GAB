import type { ProductKey } from './chain-product.ts';

interface TracedArc {
  readonly id: string;
  readonly product: ProductKey;
  readonly fromId: string;
  readonly toId: string;
  readonly inReview: boolean;
}

interface Traced {
  readonly arcs: readonly TracedArc[];
  readonly exits: readonly { readonly id: string; readonly assets: readonly string[] }[];
}

/** What the map puts forward. The map dims each other asset, arc and exit point. */
export interface Highlight {
  readonly assets: ReadonlySet<string>;
  readonly arcs: ReadonlySet<string>;
  readonly exits: ReadonlySet<string>;
}

const exitsOn = (flows: Traced, assets: ReadonlySet<string>): Set<string> =>
  new Set(
    flows.exits.filter((one) => one.assets.some((id) => assets.has(id))).map((one) => one.id),
  );

// The two functions give the two highlights of the map, a product chain and the chain of one
// asset, in one shape.

/** The arcs of one product and the assets on its accepted arcs. A link in review stays on the
 * map in its own style, but it puts no asset forward. */
export const productChain = (flows: Traced, product: ProductKey): Highlight => {
  const arcs = flows.arcs.filter((one) => one.product === product);
  const assets = new Set(
    arcs.filter((one) => !one.inReview).flatMap((one) => [one.fromId, one.toId]),
  );
  return { assets, arcs: new Set(arcs.map((one) => one.id)), exits: exitsOn(flows, assets) };
};

/** The full chain of one asset: each asset upstream and each asset downstream of it, along the
 * accepted physical links. */
export const chainOf = (flows: Traced, id: string): Highlight => {
  const accepted = flows.arcs.filter((one) => !one.inReview);
  const assets = new Set([id]);
  const arcs = new Set<string>();
  const walk = (start: string, downstream: boolean): void => {
    const next = [start];
    const seen = new Set([start]);
    for (let at = next.pop(); at !== undefined; at = next.pop())
      for (const arc of accepted) {
        const [here, there] = downstream ? [arc.fromId, arc.toId] : [arc.toId, arc.fromId];
        if (here !== at) continue;
        arcs.add(arc.id);
        assets.add(there);
        if (!seen.has(there)) {
          seen.add(there);
          next.push(there);
        }
      }
  };
  walk(id, true);
  walk(id, false);
  return { assets, arcs, exits: exitsOn(flows, assets) };
};
