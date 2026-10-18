import type { SiteVolume } from '@gab/release/site-release';

/** How the map draws one arc: a line width in pixels, the width of the halo of a range (0 for no
 * halo), and a line style. */
export interface ArcLine {
  readonly width: number;
  readonly halo: number;
  readonly style: 'solid' | 'dashed' | 'in review' | 'observed' | 'estimated' | 'capacity';
}

// Origin of the numbers: at 2 pixels a line with no volume stays visible on the land, and at 12
// pixels the largest flow does not hide the points of its two assets.
const PLAIN = 2;
const THINNEST = 2.5;
const WIDEST = 12;
// The outer width of a hollow capacity line. The map draws a line of the ground inside it.
const CAPACITY = 4;

/** The line of an arc. A link in review keeps its own style, so the map never draws it as a fact.
 * With no volume, a link after the export stage is dashed. A flow has a width for its central
 * value against `largest`, the largest flow of the same unit, and an estimate has a halo for its
 * maximum. Two units are never compared. A capacity is a thin hollow line, with no width for its
 * value. */
export const arcLine = (
  arc: {
    readonly afterExport: boolean;
    readonly inReview: boolean;
    readonly volume: SiteVolume | null;
  },
  largest: ReadonlyMap<string, number>,
): ArcLine => {
  const { volume } = arc;
  if (arc.inReview) return { width: PLAIN, halo: 0, style: 'in review' };
  if (volume === null)
    return { width: PLAIN, halo: 0, style: arc.afterExport ? 'dashed' : 'solid' };
  if (volume.volumeClass === 'capacity') return { width: CAPACITY, halo: 0, style: 'capacity' };
  const top = largest.get(volume.unit) ?? 0;
  const scaled = (amount: number): number =>
    top <= 0 ? THINNEST : THINNEST + ((WIDEST - THINNEST) * Math.min(amount, top)) / top;
  return {
    width: scaled(volume.value),
    halo: volume.volumeClass === 'estimated' ? scaled(volume.maximum ?? volume.value) : 0,
    style: volume.volumeClass,
  };
};
