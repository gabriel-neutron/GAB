import { arcLine } from './arc-line.ts';
import type { ChainFlows } from './chain-flows.ts';
import { PRODUCTS } from './chain-product.ts';
import { STAGES } from './chain-stage.ts';

/** The data that the map script draws for the chain: the arcs and the exit points as GeoJSON, and
 * the links that the script follows for a highlight. The line of each arc comes from its volume
 * and its state. */
export const chainMapData = (flows: ChainFlows) => ({
  arcs: {
    type: 'FeatureCollection',
    features: flows.arcs.map((arc) => {
      const line = arcLine(arc);
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc.path },
        properties: {
          id: arc.id,
          product: arc.product,
          colour: PRODUCTS.find((one) => one.key === arc.product)?.colour ?? '',
          width: line.width,
          style: line.style,
          label: `${arc.fromLabel} to ${arc.toLabel}`,
        },
      };
    }),
  },
  exits: {
    type: 'FeatureCollection',
    features: flows.exits.flatMap((exit) =>
      exit.position === null
        ? []
        : [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: exit.position },
              properties: {
                id: exit.id,
                label: exit.label,
                why: exit.why,
                colour: STAGES.find((one) => one.key === 'exit')?.colour ?? '',
                inReview: exit.inReview,
              },
            },
          ],
    ),
  },
  links: {
    arcs: flows.arcs.map(({ id, product, fromId, toId, inReview }) => ({
      id,
      product,
      fromId,
      toId,
      inReview,
    })),
    exits: flows.exits.map(({ id, assets }) => ({ id, assets })),
  },
});
