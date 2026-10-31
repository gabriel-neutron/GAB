import nodes from '../../nodes-data';

// One mark for each place: the three Ust-Luga terminals share one position, the first one names it.
const seen = new Set<string>();

/** The terminals of the report data that have a position. */
export const TERMINALS = nodes.flatMap((node) => {
  const place = `${node.lat},${node.lon}`;
  if (node.type !== 'terminal' || node.lat === '' || seen.has(place)) return [];
  seen.add(place);
  return [
    { id: node.node_id, label: node.short_label, lat: Number(node.lat), lon: Number(node.lon) },
  ];
});
