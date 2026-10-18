/** A longitude and a latitude, in this order, as GeoJSON gives them. */
export type Position = readonly [number, number];

/** Each position of the coordinates of a GeoJSON geometry, at any depth. */
export const positions = (value: unknown): Position[] => {
  if (!Array.isArray(value)) return [];
  const first: unknown = value[0];
  const second: unknown = value[1];
  if (typeof first === 'number' && typeof second === 'number') return [[first, second]];
  return value.flatMap(positions);
};
