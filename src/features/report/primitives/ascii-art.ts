// The glyphs from no ink to dense ink.
const RAMP = ' .:-=+*#%@';
// The gain on the distance from the median: a distance of 0.4 already gives the densest glyph.
const GAIN = 2.5;

/** Turn a grid of luminance values (0 to 1) into ASCII rows. The ink is the distance of a pixel
 * from the median of the grid, so the plain ground of a photograph stays blank in both themes. */
export function asciiRows(luminance: ArrayLike<number>, cols: number): string[] {
  const values = Array.from(luminance);
  const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  const rows: string[] = [];
  for (let start = 0; start < values.length; start += cols) {
    let row = '';
    for (const value of values.slice(start, start + cols)) {
      const ink = Math.min(1, Math.abs(value - median) * GAIN);
      row += RAMP.charAt(Math.min(RAMP.length - 1, Math.floor(ink * RAMP.length)));
    }
    rows.push(row);
  }
  return rows;
}
