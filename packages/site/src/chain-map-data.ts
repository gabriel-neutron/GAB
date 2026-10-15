import { arcLine } from './arc-line.ts';
import type { ChainFlows } from './chain-flows.ts';
import { PRODUCTS } from './chain-product.ts';
import { STAGES } from './chain-stage.ts';
import { volumeCard } from './volume-card.ts';

/** The largest flow of each unit among the accepted arcs, so a width compares only the flows of
 * one unit. A capacity is not a flow. */
const largestFlows = (flows: ChainFlows): ReadonlyMap<string, number> => {
  const largest = new Map<string, number>();
  for (const { volume, inReview } of flows.arcs)
    if (volume !== null && !inReview && volume.volumeClass !== 'capacity')
      largest.set(
        volume.unit,
        Math.max(largest.get(volume.unit) ?? 0, volume.maximum ?? volume.value),
      );
  return largest;
};

/** The data that the map script draws for the chain: the arcs and the exit points as GeoJSON, and
 * the links that the script follows for a highlight and for the card of an arc. The line of each
 * arc comes from its volume and its state. */
export const chainMapData = (flows: ChainFlows) => {
  const largest = largestFlows(flows);
  return {
    arcs: {
      type: 'FeatureCollection',
      features: flows.arcs.map((arc) => {
        const line = arcLine(arc, largest);
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: arc.path },
          properties: {
            id: arc.id,
            product: arc.product,
            colour: PRODUCTS.find((one) => one.key === arc.product)?.colour ?? '',
            width: line.width,
            halo: line.halo,
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
      arcs: flows.arcs.map(({ id, product, fromId, toId, inReview, volumes }) => ({
        id,
        product,
        fromId,
        toId,
        inReview,
        volumes: volumeCard(volumes, inReview),
      })),
      exits: flows.exits.map(({ id, assets }) => ({ id, assets })),
    },
  };
};
