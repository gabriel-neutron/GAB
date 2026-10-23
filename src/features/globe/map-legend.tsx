import { pointRows } from './legend-rows';

/** The colour of a point on the map, in words. It reads the same stages as the canvas. */
export function MapLegend() {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-2 py-1"
    >
      {pointRows().map((one) => (
        <li key={one.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2 shrink-0 rounded-full"
            // External constraint: the hue of a stage is a hex that the canvas shares.
            style={{ backgroundColor: one.colour }}
          />
          {one.label}
        </li>
      ))}
    </ul>
  );
}
