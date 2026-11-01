import raw from '../../data/critical-layers.csv?raw';
import { readCsv } from '../../line-panel';

const count = (value: string | undefined) => {
  const number = Number(value);
  if (value === undefined || value === '' || !Number.isInteger(number) || number < 0)
    throw new Error(`critical-layers: "${String(value)}" is not a count`);
  return number;
};

/** Reads the critical nodes of each layer: the nodes that meet the three conditions in the record,
 * and the nodes of the first list that the record does not link yet. A bad count, an empty or
 * repeated layer, or a row with no date stops the build. */
export function readLayers(text: string): ReadonlyMap<string, number> {
  const layers = new Map<string, number>();
  for (const row of readCsv(text)) {
    const layer = row['layer'] ?? '';
    if (layer === '' || layers.has(layer))
      throw new Error(`critical-layers: "${layer}" is empty or repeated`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row['date'] ?? ''))
      throw new Error(`critical-layers: ${layer} has no date`);
    layers.set(layer, count(row['record']) + count(row['list_only']));
  }
  return layers;
}

/** The count of critical nodes of each layer, by layer name. */
export const criticalLayers = readLayers(raw);
